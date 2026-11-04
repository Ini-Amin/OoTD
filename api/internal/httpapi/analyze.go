package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strings"
	"time"
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
	reply, err := s.ai.StylistReply(history, text)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"reply": strings.TrimSpace(reply)})
}
