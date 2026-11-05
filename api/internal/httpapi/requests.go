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
// writes: "create your profile first").
func (s *server) requireMaker(w http.ResponseWriter, r *http.Request, claims *authClaims) bool {
	var role string
	err := s.db.QueryRow(r.Context(), "SELECT role FROM users WHERE auth_id = $1::uuid", claims.Sub).Scan(&role)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "create your profile first")
			return false
		}
		serverError(w, err)
		return false
	}
	if role != "maker" {
		writeError(w, http.StatusForbidden, "makers only")
		return false
	}
	return true
}

type craftRequestView struct {
	ID          string `json:"id"`
	Category    string `json:"category"`
	Description string `json:"description"`
	BudgetIDR   *int64 `json:"budgetIdr"`
	Status      string `json:"status"`
	CreatedAt   string `json:"createdAt"`
	Username    string `json:"username"`
	DisplayName string `json:"displayName"`
	OutfitLabel string `json:"outfitLabel"`
	PieceLabel  string `json:"pieceLabel"`
}

func (s *server) listCraftRequests(w http.ResponseWriter, r *http.Request, claims *authClaims) {
	if !s.requireMaker(w, r, claims) {
		return
	}
	rows, err := s.db.Query(r.Context(), `
		SELECT c.id::text, c.category, c.description, c.budget_idr, c.status,
		       c.created_at, u.username, u.display_name,
		       COALESCE(c.outfit_label, ''), COALESCE(c.piece_label, '')
		FROM craft_requests c
		JOIN users u ON u.id = c.user_id
		ORDER BY c.created_at DESC
		LIMIT 100
	`)
	if err != nil {
		serverError(w, err)
		return
	}
	defer rows.Close()

	requests := []craftRequestView{}
	for rows.Next() {
		var v craftRequestView
		var createdAt time.Time
		if err := rows.Scan(&v.ID, &v.Category, &v.Description, &v.BudgetIDR, &v.Status,
			&createdAt, &v.Username, &v.DisplayName, &v.OutfitLabel, &v.PieceLabel); err != nil {
			serverError(w, err)
			return
		}
		v.CreatedAt = createdAt.Format(time.RFC3339)
		requests = append(requests, v)
	}
	if err := rows.Err(); err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string][]craftRequestView{"requests": requests})
}

type updateCraftRequestInput struct {
	Status string `json:"status"`
}

func (s *server) updateCraftRequest(w http.ResponseWriter, r *http.Request, claims *authClaims) {
	if !s.requireMaker(w, r, claims) {
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
