package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5"
)

// maxCommentsPerThread caps the v1 thread response. The codebase has no
// pagination precedent, so callers get the first 100 plus the denormalized
// total via commentCount.
const maxCommentsPerThread = 100

type commentAuthorView struct {
	Username    string `json:"username"`
	DisplayName string `json:"displayName"`
	Handle      string `json:"handle"`
}

type commentView struct {
	ID        string            `json:"id"`
	Body      string            `json:"body"`
	CreatedAt string            `json:"createdAt"`
	Author    commentAuthorView `json:"author"`
}

// publicOutfitExists reports whether id is a visible outfit. Comments must
// not leak or attach to private/removed outfits, so this is stricter than
// the plain EXISTS check in saves.go.
func (s *server) publicOutfitExists(r *http.Request, outfitID string) (bool, error) {
	var exists bool
	err := s.db.QueryRow(r.Context(), `
		SELECT EXISTS (
			SELECT 1 FROM outfits
			WHERE id = $1::uuid AND visibility = 'public' AND status = 'published'
		)
	`, outfitID).Scan(&exists)
	return exists, err
}

func (s *server) listComments(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !uuidRegex.MatchString(id) {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	exists, err := s.publicOutfitExists(r, id)
	if err != nil {
		serverError(w, err)
		return
	}
	if !exists {
		writeError(w, http.StatusNotFound, "not found")
		return
	}

	// The outfit JOIN re-enforces visibility inside this statement, so a
	// public->private flip between the fast-path check above and this query
	// yields an empty list instead of leaking comments.
	rows, err := s.db.Query(r.Context(), `
		SELECT c.id::text, c.body, c.created_at, u.username, u.display_name
		FROM outfit_comments c
		JOIN users u ON u.id = c.author_id
		JOIN outfits o ON o.id = c.outfit_id
			AND o.visibility = 'public' AND o.status = 'published'
		WHERE c.outfit_id = $1::uuid
		ORDER BY c.created_at ASC, c.id ASC
		LIMIT $2
	`, id, maxCommentsPerThread)
	if err != nil {
		serverError(w, err)
		return
	}
	defer rows.Close()

	comments := []commentView{}
	for rows.Next() {
		var v commentView
		var createdAt time.Time
		if err := rows.Scan(&v.ID, &v.Body, &createdAt, &v.Author.Username, &v.Author.DisplayName); err != nil {
			serverError(w, err)
			return
		}
		v.CreatedAt = createdAt.Format(time.RFC3339)
		v.Author.Handle = "@" + v.Author.Username
		comments = append(comments, v)
	}
	if err := rows.Err(); err != nil {
		serverError(w, err)
		return
	}

	// Same visibility filter: an outfit deleted or flipped mid-flight
	// reads as 404, never 500 (ErrNoRows) and never a leaked count.
	var count int
	err = s.db.QueryRow(r.Context(), `
		SELECT comment_count FROM outfits
		WHERE id = $1::uuid AND visibility = 'public' AND status = 'published'
	`, id).Scan(&count)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "not found")
			return
		}
		serverError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"comments": comments, "commentCount": count})
}

func (s *server) createComment(w http.ResponseWriter, r *http.Request, claims *authClaims) {
	id := r.PathValue("id")
	if !uuidRegex.MatchString(id) {
		writeError(w, http.StatusNotFound, "not found")
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, 64<<10)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()

	var in commentInput
	if err := dec.Decode(&in); err != nil {
		var maxBytesErr *http.MaxBytesError
		if errors.As(err, &maxBytesErr) {
			writeError(w, http.StatusRequestEntityTooLarge, "request body too large")
			return
		}
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	cleaned, err := validateComment(in)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if isBlockedComment(cleaned.Body) {
		writeError(w, http.StatusBadRequest, "comment contains blocked language")
		return
	}

	authorID, err := s.followerIDByAuth(r, claims)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "create your profile first")
			return
		}
		serverError(w, err)
		return
	}

	// Cheap visibility precheck so POSTs to nonexistent/private outfits
	// 404 without burning the caller's rate-limit budget. The in-tx
	// recheck below stays authoritative against mid-flight flips.
	exists, err := s.publicOutfitExists(r, id)
	if err != nil {
		serverError(w, err)
		return
	}
	if !exists {
		writeError(w, http.StatusNotFound, "not found")
		return
	}

	// Per-process limiter (see ratelimit.go); multi-instance deploys
	// multiply the effective allowance.
	if !s.checkLimit(w, "comment:"+claims.Sub, 30, 10*time.Minute) {
		return
	}

	tx, err := s.db.Begin(r.Context())
	if err != nil {
		serverError(w, err)
		return
	}
	defer func() { _ = tx.Rollback(r.Context()) }()

	// Single statement: rechecks the outfit is public/published inside the
	// tx so a visibility flip between checks cannot attach a comment.
	var commentID string
	var createdAt time.Time
	err = tx.QueryRow(r.Context(), `
		INSERT INTO outfit_comments (outfit_id, author_id, body)
		SELECT $1::uuid, $2::uuid, $3
		WHERE EXISTS (
			SELECT 1 FROM outfits
			WHERE id = $1::uuid AND visibility = 'public' AND status = 'published'
		)
		RETURNING id::text, created_at
	`, id, authorID, cleaned.Body).Scan(&commentID, &createdAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "not found")
			return
		}
		serverError(w, err)
		return
	}
	if _, err := tx.Exec(r.Context(), `UPDATE outfits SET comment_count = comment_count + 1 WHERE id = $1::uuid`, id); err != nil {
		serverError(w, err)
		return
	}

	var username, displayName string
	if err := tx.QueryRow(r.Context(), `SELECT username, display_name FROM users WHERE id = $1::uuid`, authorID).Scan(&username, &displayName); err != nil {
		serverError(w, err)
		return
	}
	if err := tx.Commit(r.Context()); err != nil {
		serverError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{
		"comment": commentView{
			ID:        commentID,
			Body:      cleaned.Body,
			CreatedAt: createdAt.Format(time.RFC3339),
			Author: commentAuthorView{
				Username:    username,
				DisplayName: displayName,
				Handle:      "@" + username,
			},
		},
	})
}

// deleteComment lets the comment author or the outfit owner remove a
// comment (owner as de-facto moderator of their post, mirroring the
// ownership logic in collections.go). Non-author/non-owner callers get 404,
// matching the anti-enumeration convention there.
func (s *server) deleteComment(w http.ResponseWriter, r *http.Request, claims *authClaims) {
	id := r.PathValue("id")
	commentID := r.PathValue("commentId")
	if !uuidRegex.MatchString(id) || !uuidRegex.MatchString(commentID) {
		writeError(w, http.StatusNotFound, "not found")
		return
	}

	callerID, err := s.followerIDByAuth(r, claims)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "not found")
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

	var commentAuthorID, outfitAuthorID string
	err = tx.QueryRow(r.Context(), `
		SELECT c.author_id::text, o.author_id::text
		FROM outfit_comments c
		JOIN outfits o ON o.id = c.outfit_id
		WHERE c.id = $1::uuid AND c.outfit_id = $2::uuid
	`, commentID, id).Scan(&commentAuthorID, &outfitAuthorID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "not found")
			return
		}
		serverError(w, err)
		return
	}
	if callerID != commentAuthorID && callerID != outfitAuthorID {
		writeError(w, http.StatusNotFound, "not found")
		return
	}

	cmd, err := tx.Exec(r.Context(), `DELETE FROM outfit_comments WHERE id = $1::uuid`, commentID)
	if err != nil {
		serverError(w, err)
		return
	}
	if cmd.RowsAffected() == 1 {
		if _, err := tx.Exec(r.Context(), `UPDATE outfits SET comment_count = GREATEST(0, comment_count - 1) WHERE id = $1::uuid`, id); err != nil {
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
