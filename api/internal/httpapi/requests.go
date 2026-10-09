package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5"
)

func (s *server) createCraftRequest(w http.ResponseWriter, r *http.Request) {
	var in craftRequestInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	cleaned, err := validateCraftRequest(in)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	// ponytail: username is trusted from the client payload until session auth is introduced; verify against users table.
	var userID string
	err = s.db.QueryRow(r.Context(), "SELECT id::text FROM users WHERE username = $1", cleaned.Username).Scan(&userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "unknown user")
			return
		}
		serverError(w, err)
		return
	}

	var reqID, status string
	var createdAt time.Time
	err = s.db.QueryRow(r.Context(), `
		INSERT INTO craft_requests (user_id, category, description, budget_idr, outfit_id, piece_id)
		VALUES ($1::uuid, $2, $3, $4, $5::uuid, $6::uuid)
		RETURNING id::text, status, created_at
	`, userID, cleaned.Category, cleaned.Description, cleaned.BudgetIDR, cleaned.OutfitID, cleaned.PieceID).Scan(&reqID, &status, &createdAt)
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
