package httpapi

import (
	"errors"
	"net/http"

	"github.com/jackc/pgx/v5"
)

func (s *server) userIDByUsername(r *http.Request, username string) (string, error) {
	var id string
	err := s.db.QueryRow(r.Context(), `SELECT id::text FROM users WHERE username = $1`, username).Scan(&id)
	return id, err
}

func (s *server) followerIDByAuth(r *http.Request, claims *authClaims) (string, error) {
	var id string
	err := s.db.QueryRow(r.Context(), `SELECT id::text FROM users WHERE auth_id = $1::uuid`, claims.Sub).Scan(&id)
	return id, err
}

func (s *server) followUser(w http.ResponseWriter, r *http.Request, claims *authClaims) {
	username := r.PathValue("username")

	targetID, err := s.userIDByUsername(r, username)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "unknown user")
			return
		}
		serverError(w, err)
		return
	}
	followerID, err := s.followerIDByAuth(r, claims)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "create your profile first")
			return
		}
		serverError(w, err)
		return
	}
	if followerID == targetID {
		writeError(w, http.StatusBadRequest, "cannot follow yourself")
		return
	}

	if _, err := s.db.Exec(r.Context(), `
		INSERT INTO follows (follower_id, followed_user_id)
		VALUES ($1::uuid, $2::uuid)
		ON CONFLICT DO NOTHING
	`, followerID, targetID); err != nil {
		serverError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *server) unfollowUser(w http.ResponseWriter, r *http.Request, claims *authClaims) {
	username := r.PathValue("username")

	targetID, err := s.userIDByUsername(r, username)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "unknown user")
			return
		}
		serverError(w, err)
		return
	}
	followerID, err := s.followerIDByAuth(r, claims)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		serverError(w, err)
		return
	}

	if _, err := s.db.Exec(r.Context(), `
		DELETE FROM follows
		WHERE follower_id = $1::uuid AND followed_user_id = $2::uuid
	`, followerID, targetID); err != nil {
		serverError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *server) followState(w http.ResponseWriter, r *http.Request, claims *authClaims) {
	username := r.PathValue("username")

	targetID, err := s.userIDByUsername(r, username)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "unknown user")
			return
		}
		serverError(w, err)
		return
	}
	followerID, err := s.followerIDByAuth(r, claims)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSON(w, http.StatusOK, map[string]bool{"following": false})
			return
		}
		serverError(w, err)
		return
	}
	if followerID == targetID {
		writeJSON(w, http.StatusOK, map[string]bool{"following": false})
		return
	}

	var following bool
	err = s.db.QueryRow(r.Context(), `
		SELECT EXISTS (
			SELECT 1 FROM follows
			WHERE follower_id = $1::uuid AND followed_user_id = $2::uuid
		)
	`, followerID, targetID).Scan(&following)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"following": following})
}

func (s *server) followCounts(r *http.Request, userID string) (followers int, following int, err error) {
	err = s.db.QueryRow(r.Context(), `
		SELECT
			(SELECT COUNT(*)::int FROM follows WHERE followed_user_id = $1::uuid),
			(SELECT COUNT(*)::int FROM follows WHERE follower_id = $1::uuid)
	`, userID).Scan(&followers, &following)
	return followers, following, err
}
