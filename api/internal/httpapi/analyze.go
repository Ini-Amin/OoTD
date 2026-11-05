package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/ootd/ootd-api/internal/ai"
)

// Magic Tag + AI Stylist endpoints. Both require the AI client to be
// configured (AI_API_KEY etc.); otherwise they answer 503 so the frontend
// can hide the AI affordances gracefully.

var pieceCategories = map[string]bool{
	"hat": true, "top": true, "bottom": true,
	"shoes": true, "bag": true, "accessory": true,
}

type analyzeInput struct {
	ImageURL string `json:"image_url"`
}

type magicPiece struct {
	Category string `json:"category"`
	Label    string `json:"label"`
	Box      struct {
		X float64 `json:"x"`
		Y float64 `json:"y"`
		W float64 `json:"w"`
		H float64 `json:"h"`
	} `json:"box"`
}

type magicResult struct {
	Title        string     `json:"title"`
	Caption      string     `json:"caption"`
	StyleTags    []string   `json:"style_tags"`
	OccasionTags []string   `json:"occasion_tags"`
	Season       string     `json:"season"`
	Colors       []string   `json:"colors"`
	Pieces       []magicPiece `json:"pieces"`
}

func (s *server) analyzeOutfit(w http.ResponseWriter, r *http.Request, claims *authClaims) {
	if s.ai == nil {
		writeError(w, http.StatusServiceUnavailable, "ai not configured")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 64<<10)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	var in analyzeInput
	if err := dec.Decode(&in); err != nil {
		var maxBytesErr *http.MaxBytesError
		if errors.As(err, &maxBytesErr) {
			writeError(w, http.StatusRequestEntityTooLarge, "request body too large")
			return
		}
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	u, err := url.ParseRequestURI(strings.TrimSpace(in.ImageURL))
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") {
		writeError(w, http.StatusBadRequest, "image_url must be a valid http(s) URL")
		return
	}
	if !s.checkLimit(w, "analyze:"+claims.Sub, 30, time.Hour) {
		return
	}

	raw, err := s.ai.AnalyzeOutfit(u.String())
	if err != nil {
		serverError(w, err)
		return
	}
	cleaned := stripCodeFences(raw)
	var res magicResult
	if err := json.Unmarshal([]byte(cleaned), &res); err != nil {
		writeError(w, http.StatusBadGateway, "ai returned invalid JSON")
		return
	}
	// The model signals non-outfit photos with {"error": "not_an_outfit"}.
	var errCheck struct {
		Err string `json:"error"`
	}
	if err := json.Unmarshal([]byte(cleaned), &errCheck); err == nil && errCheck.Err != "" {
		writeError(w, http.StatusUnprocessableEntity, "photo does not look like an outfit")
		return
	}

	res.Pieces = sanitizePieces(res.Pieces)
	res.StyleTags = limitStrings(res.StyleTags, 4)
	res.OccasionTags = limitStrings(res.OccasionTags, 3)
	res.Colors = limitStrings(res.Colors, 5)
	writeJSON(w, http.StatusOK, res)
}

func sanitizePieces(in []magicPiece) []magicPiece {
	out := make([]magicPiece, 0, len(in))
	for _, p := range in {
		if !pieceCategories[p.Category] {
			continue
		}
		label := strings.TrimSpace(p.Label)
		if label == "" || len(label) > 80 {
			continue
		}
		p.Label = label
		b := p.Box
		if b.X < 0 || b.X > 1 || b.Y < 0 || b.Y > 1 ||
			b.W <= 0 || b.W > 1 || b.H <= 0 || b.H > 1 ||
			b.X+b.W > 1 || b.Y+b.H > 1 {
			continue
		}
		out = append(out, p)
	}
	return out
}

func limitStrings(in []string, n int) []string {
	out := make([]string, 0, n)
	seen := map[string]bool{}
	for _, s := range in {
		s = strings.TrimSpace(s)
		if s == "" || seen[s] {
			continue
		}
		seen[s] = true
		out = append(out, s)
		if len(out) >= n {
			break
		}
	}
	return out
}

func stripCodeFences(s string) string {
	s = strings.TrimSpace(s)
	s = strings.TrimPrefix(s, "```json")
	s = strings.TrimPrefix(s, "```")
	s = strings.TrimSuffix(s, "```")
	return strings.TrimSpace(s)
}

type stylistInput struct {
	Message string `json:"message"`
	History []struct {
		Role    string `json:"role"`
		Content string `json:"content"`
	} `json:"history"`
	// Closet is client-supplied (localStorage closet, no server table):
	// category+label only. Optional; empty/missing degrades to generic advice.
	Closet []stylistClosetPiece `json:"closet,omitempty"`
}

type stylistClosetPiece struct {
	Category string `json:"category"`
	Label    string `json:"label"`
}

const (
	maxStylistClosetPieces = 30
	maxStylistClosetLabel  = 80 // runes
	maxStylistClosetChars  = 2000
)

// sanitizeCloset cleans client-supplied owned pieces for the stylist prompt.
// Order is preserved (the frontend sends worn-first); invalid rows are
// dropped silently so a dirty closet never breaks chat. Caps mirror the
// frontend serializer so history(20x2000)+closet stays within limits.
func sanitizeCloset(in []stylistClosetPiece) []ai.ClosetPiece {
	if len(in) == 0 {
		return nil
	}
	out := make([]ai.ClosetPiece, 0, len(in))
	seen := map[ai.ClosetPiece]bool{}
	// Seed with the rendered header+footer so the cap bounds the whole
	// block, not just the lines. Rendering with zero pieces keeps this
	// in sync with StylistClosetBlock by construction.
	chars := len(ai.StylistClosetBlock(nil))
	for _, p := range in {
		if !pieceCategories[p.Category] {
			continue
		}
		label := strings.Map(func(r rune) rune {
			if r < 0x20 || r == 0x7f {
				return -1
			}
			return r
		}, p.Label)
		label = strings.Join(strings.Fields(label), " ")
		if label == "" {
			continue
		}
		if utf8.RuneCountInString(label) > maxStylistClosetLabel {
			label = string([]rune(label)[:maxStylistClosetLabel])
			label = strings.TrimRight(label, " ")
		}
		if label == "" {
			continue
		}
		clean := ai.ClosetPiece{Category: p.Category, Label: label}
		if seen[clean] {
			continue
		}
		// Serialized line cost: `- [<cat>] "<label>"\n` as the prompt renders
		// it (the quotes are part of strconv.Quote's output, not overhead).
		cost := len("- [] \n") + len(clean.Category) + len(strconv.Quote(clean.Label))
		if len(out) >= maxStylistClosetPieces || chars+cost > maxStylistClosetChars {
			break
		}
		chars += cost
		seen[clean] = true
		out = append(out, clean)
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

func (s *server) stylistChat(w http.ResponseWriter, r *http.Request, claims *authClaims) {
	if s.ai == nil {
		writeError(w, http.StatusServiceUnavailable, "ai not configured")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 128<<10)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	var in stylistInput
	if err := dec.Decode(&in); err != nil {
		var maxBytesErr *http.MaxBytesError
		if errors.As(err, &maxBytesErr) {
			writeError(w, http.StatusRequestEntityTooLarge, "request body too large")
			return
		}
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	text := strings.TrimSpace(in.Message)
	if text == "" || len(text) > 2000 {
		writeError(w, http.StatusBadRequest, "message must be 1-2000 chars")
		return
	}
	if !s.checkLimit(w, "stylist:"+claims.Sub, 60, time.Hour) {
		return
	}
	history := make([][2]string, 0, len(in.History))
	for _, h := range in.History {
		if h.Role != "user" && h.Role != "assistant" {
			continue
		}
		c := strings.TrimSpace(h.Content)
		if c == "" || len(c) > 2000 {
			continue
		}
		if len(history) >= 20 {
			break
		}
		history = append(history, [2]string{h.Role, c})
	}
	reply, err := s.ai.StylistReply(history, text, sanitizeCloset(in.Closet))
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"reply": strings.TrimSpace(reply)})
}
