package httpapi

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"image"
	"image/jpeg"
	_ "image/png"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	_ "golang.org/x/image/webp"
)

const (
	maxUploadBytes = 8 << 20
	maxImageSide   = 4096
	minImageSide   = 32
)

// storageClient uploads validated images to Supabase Storage over its REST
// API and returns public URLs. It is configured entirely from the
// environment:
//
//	SUPABASE_URL          e.g. https://<project>.supabase.co (already required)
//	SUPABASE_SERVICE_KEY  service_role key; never exposed to the browser
//	STORAGE_BUCKET        bucket name, default "ootd-images" (must exist, public read)
type storageClient struct {
	baseURL    string
	serviceKey string
	bucket     string
	http       *http.Client
}

// NewStorageFromEnv returns nil when uploads are not configured (no service
// key), letting the handler answer 503 instead of crashing.
func NewStorageFromEnv() *storageClient {
	base := strings.TrimRight(os.Getenv("SUPABASE_URL"), "/")
	key := os.Getenv("SUPABASE_SERVICE_KEY")
	if base == "" || key == "" {
		return nil
	}
	bucket := os.Getenv("STORAGE_BUCKET")
	if bucket == "" {
		bucket = "ootd-images"
	}
	return &storageClient{
		baseURL:    base,
		serviceKey: key,
		bucket:     bucket,
		http:       &http.Client{Timeout: 30 * time.Second},
	}
}

// validatedImage is an upload that passed every check and is ready to store.
type validatedImage struct {
	data   []byte
	format string // jpeg, png, or webp
	ext    string
	mime   string
	width  int
	height int
}

// validateImage checks size, sniffs the MIME type from the content (never the
// filename), decodes dimensions, and strips JPEG metadata by re-encoding.
// JPEG carries the real-world EXIF/GPS risk (phone photos); PNG/WebP pass
// through unchanged.
func validateImage(data []byte) (validatedImage, error) {
	var out validatedImage
	if len(data) == 0 || len(data) > maxUploadBytes {
		return out, fmt.Errorf("image must be between 1 byte and %d bytes", maxUploadBytes)
	}
	mime := strings.SplitN(http.DetectContentType(data), ";", 2)[0]
	var format, ext string
	switch mime {
	case "image/jpeg":
		format, ext = "jpeg", "jpg"
	case "image/png":
		format, ext = "png", "png"
	case "image/webp":
		format, ext = "webp", "webp"
	default:
		return out, fmt.Errorf("unsupported image type %s: use JPEG, PNG, or WebP", mime)
	}
	cfg, decodedFormat, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		return out, fmt.Errorf("cannot decode image: %v", err)
	}
	if decodedFormat != format {
		return out, fmt.Errorf("image content does not match its type")
	}
	if cfg.Width < minImageSide || cfg.Height < minImageSide ||
		cfg.Width > maxImageSide || cfg.Height > maxImageSide {
		return out, fmt.Errorf("image dimensions must be between %d and %d px per side", minImageSide, maxImageSide)
	}
	out = validatedImage{data: data, format: format, ext: ext, mime: mime, width: cfg.Width, height: cfg.Height}
	if format == "jpeg" {
		img, err := jpeg.Decode(bytes.NewReader(data))
		if err != nil {
			return validatedImage{}, fmt.Errorf("cannot decode image: %v", err)
		}
		var clean bytes.Buffer
		if err := jpeg.Encode(&clean, img, &jpeg.Options{Quality: 85}); err != nil {
			return validatedImage{}, fmt.Errorf("cannot process image: %v", err)
		}
		out.data = clean.Bytes()
	}
	return out, nil
}

func truncateErr(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}

func randomHex(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// put stores data and returns its public URL.
func (c *storageClient) put(path string, img validatedImage) (string, error) {
	url := c.baseURL + "/storage/v1/object/" + c.bucket + "/" + path
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(img.data))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", img.mime)
	req.Header.Set("apikey", c.serviceKey)
	req.Header.Set("Authorization", "Bearer "+c.serviceKey)
	resp, err := c.http.Do(req)
	if err != nil {
		return "", fmt.Errorf("storage upload: %w", err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 64<<10))
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("storage status %d: %s", resp.StatusCode, truncateErr(string(raw), 200))
	}
	return c.baseURL + "/storage/v1/object/public/" + c.bucket + "/" + path, nil
}

func (s *server) uploadImage(w http.ResponseWriter, r *http.Request, claims *authClaims) {
	if s.storage == nil {
		writeError(w, http.StatusServiceUnavailable, "uploads not configured")
		return
	}
	if !s.checkLimit(w, "upload:"+claims.Sub, 20, time.Hour) {
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxUploadBytes+ (1 << 20))
	if err := r.ParseMultipartForm(maxUploadBytes + (1 << 20)); err != nil {
		writeError(w, http.StatusBadRequest, "invalid multipart body")
		return
	}
	f, _, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "file field required")
		return
	}
	defer f.Close()
	data, err := io.ReadAll(io.LimitReader(f, maxUploadBytes+1))
	if err != nil {
		writeError(w, http.StatusBadRequest, "cannot read file")
		return
	}
	img, err := validateImage(data)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	name, err := randomHex(16)
	if err != nil {
		serverError(w, err)
		return
	}
	path := claims.Sub + "/" + name + "." + img.ext
	publicURL, err := s.storage.put(path, img)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{
		"imageUrl": publicURL,
		"width":    img.width,
		"height":   img.height,
	})
}
