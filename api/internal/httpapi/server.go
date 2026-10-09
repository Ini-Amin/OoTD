package httpapi

import (
	"encoding/json"
	"net/http"
)

// Outfit is temporary seed data for the first frontend-to-API connection.
// It will move to PostgreSQL in the next milestone.
type Outfit struct {
	ID      string   `json:"id"`
	Creator string   `json:"creator"`
	Handle  string   `json:"handle"`
	Title   string   `json:"title"`
	Caption string   `json:"caption"`
	Tags    []string `json:"tags"`
	Accent  string   `json:"accent"`
	SavedBy int      `json:"savedBy"`
}

func NewServer() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", health)
	mux.HandleFunc("GET /v1/outfits", listOutfits)

	return withCORS(mux)
}

func health(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{
		"status":  "ok",
		"service": "ootd-api",
	})
}

func listOutfits(w http.ResponseWriter, r *http.Request) {
	outfits := []Outfit{
		{
			ID:      "look-001",
			Creator: "Nadya Aulia",
			Handle:  "@nadyaaulia",
			Title:   "Soft layers for a rainy campus day",
			Caption: "Comfort first: oversized shirt, wide-leg trousers, and one bright detail.",
			Tags:    []string{"Campus", "Minimal", "Rainy day"},
			Accent:  "#e8b86d",
			SavedBy: 128,
		},
		{
			ID:      "look-002",
			Creator: "Raka Pratama",
			Handle:  "@rakaprata",
			Title:   "One jacket, three moods",
			Caption: "A relaxed vintage layer that works for coffee, class, and a night out.",
			Tags:    []string{"Vintage", "Streetwear", "Layering"},
			Accent:  "#8da8c7",
			SavedBy: 94,
		},
		{
			ID:      "look-003",
			Creator: "Salsabila F.",
			Handle:  "@salsabilaf",
			Title:   "Everyday earth tones",
			Caption: "A calm palette for an easy, polished look without buying anything new.",
			Tags:    []string{"Modest", "Earth tones", "Everyday"},
			Accent:  "#a8a56d",
			SavedBy: 203,
		},
	}

	writeJSON(w, http.StatusOK, map[string][]Outfit{"outfits": outfits})
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "http://localhost:5173")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)

	if err := json.NewEncoder(w).Encode(value); err != nil {
		http.Error(w, "could not encode response", http.StatusInternalServerError)
	}
}
