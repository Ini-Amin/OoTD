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
