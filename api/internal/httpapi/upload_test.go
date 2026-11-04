package httpapi

import (
	"bytes"
	"encoding/binary"
	"hash/crc32"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func solidJPEG(t *testing.T, w, h int) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.Set(x, y, color.RGBA{200, 100, 50, 255})
		}
	}
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, nil); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func solidPNG(t *testing.T, w, h int) []byte {
	t.Helper()
	img := image.NewNRGBA(image.Rect(0, 0, w, h))
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

// fakeDimsPNG builds a PNG whose IHDR claims w x h without the pixel cost,
// so dimension limits stay cheap to test.
func fakeDimsPNG(w, h uint32) []byte {
	var buf bytes.Buffer
	buf.Write([]byte{137, 80, 78, 71, 13, 10, 26, 10}) // signature
	ihdr := make([]byte, 13)
	binary.BigEndian.PutUint32(ihdr[0:4], w)
	binary.BigEndian.PutUint32(ihdr[4:8], h)
	ihdr[8], ihdr[9], ihdr[10], ihdr[11], ihdr[12] = 8, 2, 0, 0, 0 // 8-bit truecolor
	writeChunk(&buf, "IHDR", ihdr)
	writeChunk(&buf, "IEND", nil)
	return buf.Bytes()
}

func writeChunk(buf *bytes.Buffer, typ string, data []byte) {
	var lenBytes [4]byte
	binary.BigEndian.PutUint32(lenBytes[:], uint32(len(data)))
	buf.Write(lenBytes[:])
	buf.WriteString(typ)
	buf.Write(data)
	crc := crc32.Checksum(append([]byte(typ), data...), crc32.MakeTable(crc32.IEEE))
	var crcBytes [4]byte
	binary.BigEndian.PutUint32(crcBytes[:], crc)
	buf.Write(crcBytes[:])
}

func TestValidateImage(t *testing.T) {
	jpg := solidJPEG(t, 64, 64)
	png := solidPNG(t, 64, 64)
	cases := []struct {
		name    string
		data    []byte
		wantFmt string
		wantErr string
	}{
		{"jpeg ok", jpg, "jpeg", ""},
		{"png ok", png, "png", ""},
		{"empty", nil, "", "between 1 byte"},
		{"oversize", make([]byte, maxUploadBytes+1), "", "between 1 byte"},
		{"text is not an image", []byte("hello world, this is not an image at all"), "", "unsupported image type"},
		{"gif rejected", []byte("GIF89a" + strings.Repeat("x", 64)), "", "unsupported image type"},
		{"too small", solidJPEG(t, 8, 8), "", "dimensions must be"},
		{"too big", fakeDimsPNG(5000, 100), "", "dimensions must be"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := validateImage(tc.data)
			if tc.wantErr == "" {
				if err != nil {
					t.Fatalf("expected ok, got %v", err)
				}
				if got.format != tc.wantFmt {
					t.Fatalf("format = %q, want %q", got.format, tc.wantFmt)
				}
				return
			}
			if err == nil || !strings.Contains(err.Error(), tc.wantErr) {
				t.Fatalf("error = %v, want containing %q", err, tc.wantErr)
			}
		})
	}
}

func TestValidateImageStripsJPEGMetadata(t *testing.T) {
	// A JPEG with an APP1 (EXIF) marker must come back without it.
	raw := solidJPEG(t, 64, 64)
	marker := []byte{0xFF, 0xE1, 0x00, 0x10}
	marker = append(marker, bytes.Repeat([]byte{'E'}, 14)...)
	withEXIF := append(append([]byte{}, raw[:2]...), append(marker, raw[2:]...)...)
	clean, err := validateImage(withEXIF)
	if err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
	if bytes.Contains(clean.data, bytes.Repeat([]byte{'E'}, 14)) {
		t.Fatal("re-encoded JPEG still contains the injected marker payload")
	}
}

func TestUploadImage503WithoutStorage(t *testing.T) {
	s := &server{aiLimiter: newLimiter(), storage: nil}
	req := httptest.NewRequest(http.MethodPost, "/v1/uploads", nil)
	rr := httptest.NewRecorder()
	s.uploadImage(rr, req, &authClaims{Sub: "00000000-0000-0000-0000-000000000000"})
	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503", rr.Code)
	}
}

func TestUploadImageHappyPath(t *testing.T) {
	var gotPath, gotCT, gotKey string
	var gotBytes []byte
	fake := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath, gotCT, gotKey = r.URL.Path, r.Header.Get("Content-Type"), r.Header.Get("apikey")
		gotBytes, _ = io.ReadAll(r.Body)
		w.WriteHeader(http.StatusOK)
	}))
	defer fake.Close()

	s := &server{
		aiLimiter: newLimiter(),
		storage:   &storageClient{baseURL: fake.URL, serviceKey: "test-key", bucket: "bkt", http: fake.Client()},
	}

	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	part, err := mw.CreateFormFile("file", "photo.jpg")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := part.Write(solidJPEG(t, 64, 64)); err != nil {
		t.Fatal(err)
	}
	if err := mw.Close(); err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodPost, "/v1/uploads", &body)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	rr := httptest.NewRecorder()
	s.uploadImage(rr, req, &authClaims{Sub: "00000000-0000-0000-0000-000000000001"})

	if rr.Code != http.StatusCreated {
		t.Fatalf("status = %d, body = %s", rr.Code, rr.Body.String())
	}
	if !strings.HasPrefix(gotPath, "/storage/v1/object/bkt/00000000-0000-0000-0000-000000000001/") {
		t.Fatalf("storage path = %q", gotPath)
	}
	if !strings.HasSuffix(gotPath, ".jpg") {
		t.Fatalf("storage path missing .jpg ext: %q", gotPath)
	}
	if gotCT != "image/jpeg" || gotKey != "test-key" {
		t.Fatalf("ct = %q key = %q", gotCT, gotKey)
	}
	if len(gotBytes) == 0 {
		t.Fatal("empty upload body")
	}
	if !strings.Contains(rr.Body.String(), `"imageUrl":"`+fake.URL) {
		t.Fatalf("response missing public URL: %s", rr.Body.String())
	}
}

func TestUploadImageRejectsMissingFile(t *testing.T) {
	s := &server{
		aiLimiter: newLimiter(),
		storage:   &storageClient{baseURL: "http://example.test", serviceKey: "k", bucket: "b", http: http.DefaultClient},
	}
	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	if err := mw.Close(); err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodPost, "/v1/uploads", &body)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	rr := httptest.NewRecorder()
	s.uploadImage(rr, req, &authClaims{Sub: "00000000-0000-0000-0000-000000000000"})
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rr.Code)
	}
}
