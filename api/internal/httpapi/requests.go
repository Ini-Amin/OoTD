package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5"
)

func (s *server) createCraftRequest(w http.ResponseWriter, r *http.Request, claims *authClaims) {
	r.Body = http.MaxBytesReader(w, r.Body, 64<<10)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()

	var in craftRequestInput
	if err := dec.Decode(&in); err != nil {
		var maxBytesErr *http.MaxBytesError
		if errors.As(err, &maxBytesErr) {
			writeError(w, http.StatusRequestEntityTooLarge, "request body too large")
			return
		}
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	cleaned, err := validateCraftRequest(in)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	var userID string
	err = s.db.QueryRow(r.Context(), "SELECT id::text FROM users WHERE auth_id = $1::uuid", claims.Sub).Scan(&userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "create your profile first")
			return
		}
		serverError(w, err)
		return
	}

	var reqID, status string
	var createdAt time.Time
	err = s.db.QueryRow(r.Context(), `
		INSERT INTO craft_requests (user_id, category, description, budget_idr, outfit_id, piece_id, outfit_label, piece_label)
		VALUES ($1::uuid, $2, $3, $4, $5::uuid, $6::uuid, $7, $8)
		RETURNING id::text, status, created_at
	`, userID, cleaned.Category, cleaned.Description, cleaned.BudgetIDR, cleaned.OutfitID, cleaned.PieceID, cleaned.OutfitLabel, cleaned.PieceLabel).Scan(&reqID, &status, &createdAt)
	if err != nil {
		serverError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{
		"request": map[string]string{
			"id":        reqID,
			"status":    status,
			"createdAt": createdAt.Format(time.RFC3339),
		},
	})
}

// requireMaker resolves the caller's profile role server-side. Non-makers
// get 403; callers without a profile get 404 (same as other profile-gated
// writes: "create your profile first"). On success it returns the caller's
// users.id for per-maker state (read marks).
func (s *server) requireMaker(w http.ResponseWriter, r *http.Request, claims *authClaims) (string, bool) {
	var id, role string
	err := s.db.QueryRow(r.Context(), "SELECT id::text, role FROM users WHERE auth_id = $1::uuid", claims.Sub).Scan(&id, &role)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "create your profile first")
			return "", false
		}
		serverError(w, err)
		return "", false
	}
	if role != "maker" {
		writeError(w, http.StatusForbidden, "makers only")
		return "", false
	}
	return id, true
}

type craftRequestView struct {
	ID                string  `json:"id"`
	Category          string  `json:"category"`
	Description       string  `json:"description"`
	BudgetIDR         *int64  `json:"budgetIdr"`
	Status            string  `json:"status"`
	CreatedAt         string  `json:"createdAt"`
	Username          string  `json:"username"`
	DisplayName       string  `json:"displayName"`
	OutfitLabel       string  `json:"outfitLabel"`
	PieceLabel        string  `json:"pieceLabel"`
	Unread            bool    `json:"unread"`
	ShowcasedOutfitID *string `json:"showcasedOutfitId"`
	ShowcaseID        *string `json:"showcaseId"`
	// Showcased is true when ANY maker linked this request (first-wins).
	// Dashboard uses it to explain why Add is unavailable: B cannot
	// showcase a request A already won.
	Showcased bool `json:"showcased"`
}

func (s *server) listCraftRequests(w http.ResponseWriter, r *http.Request, claims *authClaims) {
	makerID, ok := s.requireMaker(w, r, claims)
	if !ok {
		return
	}
	rows, err := s.db.Query(r.Context(), `
		SELECT c.id::text, c.category, c.description, c.budget_idr, c.status,
		       c.created_at, u.username, u.display_name,
		       COALESCE(c.outfit_label, ''), COALESCE(c.piece_label, ''),
		       (mr.read_at IS NULL) AS unread,
		       mp.outfit_id::text, mp.id::text,
		       (mp_any.request_id IS NOT NULL) AS showcased
		FROM craft_requests c
		JOIN users u ON u.id = c.user_id
		LEFT JOIN maker_request_reads mr ON mr.request_id = c.id AND mr.maker_id = $1::uuid
		LEFT JOIN maker_portfolio mp ON mp.request_id = c.id AND mp.maker_id = $1::uuid
		LEFT JOIN maker_portfolio mp_any ON mp_any.request_id = c.id
		ORDER BY unread DESC, c.created_at DESC
		LIMIT 100
	`, makerID)
	if err != nil {
		serverError(w, err)
		return
	}
	defer rows.Close()

	requests := []craftRequestView{}
	unreadCount := 0
	for rows.Next() {
		var v craftRequestView
		var createdAt time.Time
		if err := rows.Scan(&v.ID, &v.Category, &v.Description, &v.BudgetIDR, &v.Status,
			&createdAt, &v.Username, &v.DisplayName, &v.OutfitLabel, &v.PieceLabel, &v.Unread,
			&v.ShowcasedOutfitID, &v.ShowcaseID, &v.Showcased); err != nil {
			serverError(w, err)
			return
		}
		v.CreatedAt = createdAt.Format(time.RFC3339)
		if v.Unread {
			unreadCount++
		}
		requests = append(requests, v)
	}
	if err := rows.Err(); err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"requests": requests, "unreadCount": unreadCount})
}

// markCraftRequestRead is idempotent: reading twice is a no-op. 404 when the
// request does not exist. Read state is orthogonal to status (open/accepted/
// declined/done) — viewing never implies deciding.
func (s *server) markCraftRequestRead(w http.ResponseWriter, r *http.Request, claims *authClaims) {
	makerID, ok := s.requireMaker(w, r, claims)
	if !ok {
		return
	}
	id := r.PathValue("id")
	if !uuidRegex.MatchString(id) {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	// Single statement: a separate EXISTS check followed by INSERT could
	// hit an FK violation (500) if the request were deleted in between.
	tag, err := s.db.Exec(r.Context(), `
		INSERT INTO maker_request_reads (maker_id, request_id)
		SELECT $1::uuid, $2::uuid
		WHERE EXISTS (SELECT 1 FROM craft_requests WHERE id = $2::uuid)
		ON CONFLICT DO NOTHING
	`, makerID, id)
	if err != nil {
		serverError(w, err)
		return
	}
	if tag.RowsAffected() == 0 {
		// Either the request does not exist (404) or this maker already
		// read it (idempotent 200): disambiguate with a plain SELECT,
		// which has no failure mode under races.
		var exists bool
		err := s.db.QueryRow(r.Context(), "SELECT EXISTS (SELECT 1 FROM craft_requests WHERE id = $1::uuid)", id).Scan(&exists)
		if err != nil {
			serverError(w, err)
			return
		}
		if !exists {
			writeError(w, http.StatusNotFound, "not found")
			return
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"request": map[string]string{"id": id}})
}

// markAllCraftRequestsRead marks every existing request read for the caller.
func (s *server) markAllCraftRequestsRead(w http.ResponseWriter, r *http.Request, claims *authClaims) {
	makerID, ok := s.requireMaker(w, r, claims)
	if !ok {
		return
	}
	if _, err := s.db.Exec(r.Context(), `
		INSERT INTO maker_request_reads (maker_id, request_id)
		SELECT $1::uuid, c.id FROM craft_requests c
		ON CONFLICT DO NOTHING
	`, makerID); err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

type updateCraftRequestInput struct {
	Status string `json:"status"`
}

func (s *server) updateCraftRequest(w http.ResponseWriter, r *http.Request, claims *authClaims) {
	if _, ok := s.requireMaker(w, r, claims); !ok {
		return
	}
	id := r.PathValue("id")
	if !uuidRegex.MatchString(id) {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 64<<10)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	var in updateCraftRequestInput
	if err := dec.Decode(&in); err != nil {
		var maxBytesErr *http.MaxBytesError
		if errors.As(err, &maxBytesErr) {
			writeError(w, http.StatusRequestEntityTooLarge, "request body too large")
			return
		}
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	var current string
	err := s.db.QueryRow(r.Context(), "SELECT status FROM craft_requests WHERE id = $1::uuid", id).Scan(&current)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "not found")
			return
		}
		serverError(w, err)
		return
	}
	next, err := validateRequestStatus(current, in.Status)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	var updatedAt time.Time
	err = s.db.QueryRow(r.Context(), `
		UPDATE craft_requests SET status = $2 WHERE id = $1::uuid
		RETURNING created_at
	`, id, next).Scan(&updatedAt)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"request": map[string]string{"id": id, "status": next},
	})
}
