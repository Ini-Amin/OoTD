package httpapi

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Outfit struct {
	ID      string   `json:"id"`
	Creator string   `json:"creator"`
	Handle  string   `json:"handle"`
	Title   string   `json:"title"`
	Caption string   `json:"caption"`
	Tags    []string `json:"tags"`
	Accent  string   `json:"accent"`
	SavedBy int      `json:"savedBy"`
	Match   int      `json:"match"`
}

type Tag struct {
	Slug  string `json:"slug"`
	Name  string `json:"name"`
	Count int    `json:"count"`
}

type Theme struct {
	Slug    string `json:"slug"`
	Name    string `json:"name"`
	Bg      string `json:"bg"`
	Surface string `json:"surface"`
	Fg      string `json:"fg"`
	Accent  string `json:"accent"`
	Font    string `json:"font"`
	Radius  string `json:"radius"`
}

type User struct {
	Username    string `json:"username"`
	DisplayName string `json:"displayName"`
}

type server struct {
	db *pgxpool.Pool
}

func NewServer(db *pgxpool.Pool, allowedOrigin string) http.Handler {
	s := &server{db: db}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", s.health)
	mux.HandleFunc("GET /v1/tags", s.listTags)
	mux.HandleFunc("GET /v1/outfits", s.listOutfits)
	mux.HandleFunc("POST /v1/outfits", s.createOutfit)
	mux.HandleFunc("GET /v1/users", s.listUsers)
	mux.HandleFunc("GET /v1/themes", s.listThemes)
	return withCORS(mux, allowedOrigin)
}

func (s *server) health(w http.ResponseWriter, r *http.Request) {
	if err := s.db.Ping(r.Context()); err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "db_down", "service": "ootd-api"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "service": "ootd-api"})
}

func parseStyles(raw string) []string {
	parts := strings.Split(raw, ",")
	seen := make(map[string]bool)
	styles := []string{}
	for _, p := range parts {
		s := strings.ToLower(strings.TrimSpace(p))
		if s == "" || seen[s] {
			continue
		}
		seen[s] = true
		styles = append(styles, s)
		if len(styles) == 10 {
			break
		}
	}
	return styles
}

func (s *server) listTags(w http.ResponseWriter, r *http.Request) {
	rows, err := s.db.Query(r.Context(), `
		SELECT t.normalized_name, t.display_name, COUNT(o.id)::int AS count
		FROM tags t
		JOIN outfit_tags ot ON ot.tag_id = t.id
		JOIN outfits o ON o.id = ot.outfit_id AND o.visibility = 'public' AND o.status = 'published'
		GROUP BY t.id, t.normalized_name, t.display_name
		HAVING COUNT(o.id) >= 1
		ORDER BY count DESC, t.display_name ASC
		LIMIT 30`)
	if err != nil {
		serverError(w, err)
		return
	}
	defer rows.Close()

	tags := []Tag{}
	for rows.Next() {
		var t Tag
		if err := rows.Scan(&t.Slug, &t.Name, &t.Count); err != nil {
			serverError(w, err)
			return
		}
		tags = append(tags, t)
	}
	if err := rows.Err(); err != nil {
		serverError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string][]Tag{"tags": tags})
}

func (s *server) listOutfits(w http.ResponseWriter, r *http.Request) {
	styles := parseStyles(r.URL.Query().Get("styles"))

	rows, err := s.db.Query(r.Context(), `
		SELECT o.id::text, u.display_name, '@' || u.username, o.title, o.caption, o.accent, o.save_count,
		       COALESCE(array_agg(t.display_name ORDER BY t.display_name) FILTER (WHERE t.id IS NOT NULL), '{}'),
		       COUNT(t.id) FILTER (WHERE t.normalized_name = ANY($1))::int AS match
		FROM outfits o
		JOIN users u ON u.id = o.author_id
		LEFT JOIN outfit_tags ot ON ot.outfit_id = o.id
		LEFT JOIN tags t ON t.id = ot.tag_id
		WHERE o.visibility = 'public' AND o.status = 'published'
		GROUP BY o.id, u.id
		HAVING cardinality($1::text[]) = 0 OR COUNT(t.id) FILTER (WHERE t.normalized_name = ANY($1)) > 0
		ORDER BY match DESC, o.published_at DESC
		LIMIT 50`, styles)
	if err != nil {
		serverError(w, err)
		return
	}
	defer rows.Close()

	outfits := []Outfit{}
	for rows.Next() {
		var o Outfit
		if err := rows.Scan(&o.ID, &o.Creator, &o.Handle, &o.Title, &o.Caption, &o.Accent, &o.SavedBy, &o.Tags, &o.Match); err != nil {
			serverError(w, err)
			return
		}
		outfits = append(outfits, o)
	}
	if err := rows.Err(); err != nil {
		serverError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string][]Outfit{"outfits": outfits})
}

func (s *server) createOutfit(w http.ResponseWriter, r *http.Request) {
	// ponytail: username is trusted from request body; skipped: session/auth verification, add when auth phase lands.
	r.Body = http.MaxBytesReader(w, r.Body, 64<<10)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()

	var input newOutfitInput
	if err := dec.Decode(&input); err != nil {
		var maxBytesErr *http.MaxBytesError
		if errors.As(err, &maxBytesErr) {
			writeError(w, http.StatusRequestEntityTooLarge, "request body too large")
			return
		}
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	cleaned, err := validateNewOutfit(input)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	var authorID string
	err = s.db.QueryRow(r.Context(), `SELECT id::text FROM users WHERE username = $1`, cleaned.Username).Scan(&authorID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "unknown user")
			return
		}
		serverError(w, err)
		return
	}

	tx, err := s.db.Begin(r.Context())
	if err != nil {
		serverError(w, err)
		return
	}
	defer tx.Rollback(r.Context())

	var outfitID string
	err = tx.QueryRow(r.Context(), `
		INSERT INTO outfits (author_id, title, caption, accent)
		VALUES ($1::uuid, $2, $3, $4)
		RETURNING id::text
	`, authorID, cleaned.Title, cleaned.Caption, cleaned.Accent).Scan(&outfitID)
	if err != nil {
		serverError(w, err)
		return
	}

	for _, tag := range cleaned.Tags {
		normalized := strings.ReplaceAll(strings.ToLower(tag), " ", "-")
		var tagID string
		err = tx.QueryRow(r.Context(), `
			INSERT INTO tags (normalized_name, display_name)
			VALUES ($1, $2)
			ON CONFLICT (normalized_name) DO UPDATE SET display_name = tags.display_name
			RETURNING id::text
		`, normalized, tag).Scan(&tagID)
		if err != nil {
			serverError(w, err)
			return
		}

		_, err = tx.Exec(r.Context(), `
			INSERT INTO outfit_tags (outfit_id, tag_id)
			VALUES ($1::uuid, $2::uuid)
			ON CONFLICT DO NOTHING
		`, outfitID, tagID)
		if err != nil {
			serverError(w, err)
			return
		}
	}

	var out Outfit
	err = tx.QueryRow(r.Context(), `
		SELECT o.id::text, u.display_name, '@' || u.username, o.title, o.caption, o.accent, o.save_count,
		       COALESCE(array_agg(t.display_name ORDER BY t.display_name) FILTER (WHERE t.id IS NOT NULL), '{}')
		FROM outfits o
		JOIN users u ON u.id = o.author_id
		LEFT JOIN outfit_tags ot ON ot.outfit_id = o.id
		LEFT JOIN tags t ON t.id = ot.tag_id
		WHERE o.id = $1::uuid
		GROUP BY o.id, u.id
	`, outfitID).Scan(&out.ID, &out.Creator, &out.Handle, &out.Title, &out.Caption, &out.Accent, &out.SavedBy, &out.Tags)
	if err != nil {
		serverError(w, err)
		return
	}

	if out.Tags == nil {
		out.Tags = []string{}
	}
	out.Match = 0

	if err := tx.Commit(r.Context()); err != nil {
		serverError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, map[string]Outfit{"outfit": out})
}

func (s *server) listUsers(w http.ResponseWriter, r *http.Request) {
	rows, err := s.db.Query(r.Context(), `SELECT username, display_name FROM users ORDER BY created_at`)
	if err != nil {
		serverError(w, err)
		return
	}
	defer rows.Close()

	users := []User{}
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.Username, &u.DisplayName); err != nil {
			serverError(w, err)
			return
		}
		users = append(users, u)
	}
	if err := rows.Err(); err != nil {
		serverError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string][]User{"users": users})
}

func (s *server) listThemes(w http.ResponseWriter, r *http.Request) {
	rows, err := s.db.Query(r.Context(), `SELECT slug, name, bg, surface, fg, accent, font, radius FROM themes ORDER BY sort_order`)
	if err != nil {
		serverError(w, err)
		return
	}
	defer rows.Close()

	themes := []Theme{}
	for rows.Next() {
		var t Theme
		if err := rows.Scan(&t.Slug, &t.Name, &t.Bg, &t.Surface, &t.Fg, &t.Accent, &t.Font, &t.Radius); err != nil {
			serverError(w, err)
			return
		}
		themes = append(themes, t)
	}
	if err := rows.Err(); err != nil {
		serverError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string][]Theme{"themes": themes})
}

func withCORS(next http.Handler, allowedOrigin string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", allowedOrigin)
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func serverError(w http.ResponseWriter, err error) {
	log.Printf("request failed: %v", err)
	http.Error(w, "internal error", http.StatusInternalServerError)
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)

	if err := json.NewEncoder(w).Encode(value); err != nil {
		log.Printf("encode response: %v", err)
	}
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
