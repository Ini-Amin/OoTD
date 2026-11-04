package httpapi

import (
	"errors"
	"net/http"

	"github.com/jackc/pgx/v5"
)

func (s *server) saveOutfit(w http.ResponseWriter, r *http.Request, claims *authClaims) {
	id := r.PathValue("id")
	if !uuidRegex.MatchString(id) {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	userID, err := s.followerIDByAuth(r, claims)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "create your profile first")
			return
		}
		serverError(w, err)
		return
	}

	var exists bool
	if err := s.db.QueryRow(r.Context(), `SELECT EXISTS (SELECT 1 FROM outfits WHERE id = $1::uuid)`, id).Scan(&exists); err != nil {
		serverError(w, err)
		return
	}
	if !exists {
		writeError(w, http.StatusNotFound, "not found")
		return
	}

	tx, err := s.db.Begin(r.Context())
	if err != nil {
		serverError(w, err)
		return
	}
	defer func() { _ = tx.Rollback(r.Context()) }()

	cmd, err := tx.Exec(r.Context(), `
		INSERT INTO saved_outfits (user_id, outfit_id)
		VALUES ($1::uuid, $2::uuid)
		ON CONFLICT DO NOTHING
	`, userID, id)
	if err != nil {
		serverError(w, err)
		return
	}
	if cmd.RowsAffected() == 1 {
		if _, err := tx.Exec(r.Context(), `UPDATE outfits SET save_count = save_count + 1 WHERE id = $1::uuid`, id); err != nil {
			serverError(w, err)
			return
		}
	}
	if err := tx.Commit(r.Context()); err != nil {
		serverError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *server) unsaveOutfit(w http.ResponseWriter, r *http.Request, claims *authClaims) {
	id := r.PathValue("id")
	if !uuidRegex.MatchString(id) {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	userID, err := s.followerIDByAuth(r, claims)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			w.WriteHeader(http.StatusNoContent)
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
	defer func() { _ = tx.Rollback(r.Context()) }()

	cmd, err := tx.Exec(r.Context(), `
		DELETE FROM saved_outfits
		WHERE user_id = $1::uuid AND outfit_id = $2::uuid
	`, userID, id)
	if err != nil {
		serverError(w, err)
		return
	}
	if cmd.RowsAffected() == 1 {
		if _, err := tx.Exec(r.Context(), `UPDATE outfits SET save_count = GREATEST(0, save_count - 1) WHERE id = $1::uuid`, id); err != nil {
			serverError(w, err)
			return
		}
	}
	if err := tx.Commit(r.Context()); err != nil {
		serverError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *server) listSaves(w http.ResponseWriter, r *http.Request, claims *authClaims) {
	userID, err := s.followerIDByAuth(r, claims)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSON(w, http.StatusOK, map[string][]string{"outfitIds": {}})
			return
		}
		serverError(w, err)
		return
	}

	rows, err := s.db.Query(r.Context(), `
		SELECT outfit_id::text
		FROM saved_outfits
		WHERE user_id = $1::uuid
		ORDER BY created_at DESC, outfit_id DESC
		LIMIT 200
	`, userID)
	if err != nil {
		serverError(w, err)
		return
	}
	defer rows.Close()

	ids := []string{}
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			serverError(w, err)
			return
		}
		ids = append(ids, id)
	}
	if err := rows.Err(); err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string][]string{"outfitIds": ids})
}
