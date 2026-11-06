package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// listPortfolioSQL reuses the shared outfit projection so portfolio cards
// render byte-identical to feed/profile outfits via OutfitCard. Entries
// whose outfit went private/removed drop out of the public read, matching
// profile-outfit behavior.
var listPortfolioSQL = outfitSelectSQL(
	`0 AS match`,
	`JOIN maker_portfolio mp ON mp.outfit_id = o.id
	 JOIN users m ON m.id = mp.maker_id
	 WHERE m.username = $1 AND o.visibility = 'public' AND o.status = 'published'`,
	`ORDER BY MAX(mp.created_at) DESC
	 LIMIT 50`,
)

// getPortfolio is public: anyone can view a maker's finished commissions.
// Unknown usernames 404, mirroring getUser.
func (s *server) getPortfolio(w http.ResponseWriter, r *http.Request) {
	username := r.PathValue("username")

	var exists bool
	if err := s.db.QueryRow(r.Context(), `SELECT EXISTS (SELECT 1 FROM users WHERE username = $1)`, username).Scan(&exists); err != nil {
		serverError(w, err)
		return
	}
	if !exists {
		writeError(w, http.StatusNotFound, "unknown user")
		return
	}

	rows, err := s.db.Query(r.Context(), listPortfolioSQL, username)
	if err != nil {
		serverError(w, err)
		return
	}
	defer rows.Close()

	outfits, err := scanOutfits(rows)
	if err != nil {
		serverError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string][]Outfit{"outfits": outfits})
}

type portfolioEntryView struct {
	ID        string `json:"id"`
	RequestID string `json:"requestId"`
	OutfitID  string `json:"outfitId"`
}

// createPortfolioEntry links one of the caller's own outfits to a done
// craft request. Maker-only (requireMaker: 403 non-maker / 404 no-profile).
// Missing, foreign, or non-public outfits 404 (the public read filters to
// public/published, so a private link would never render); non-done
// requests 400; a second link for the same request 409 (UNIQUE(request_id)
// first-wins, safe under races).
func (s *server) createPortfolioEntry(w http.ResponseWriter, r *http.Request, claims *authClaims) {
	makerID, ok := s.requireMaker(w, r, claims)
	if !ok {
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, 64<<10)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()

	var in portfolioLinkInput
	if err := dec.Decode(&in); err != nil {
		var maxBytesErr *http.MaxBytesError
		if errors.As(err, &maxBytesErr) {
			writeError(w, http.StatusRequestEntityTooLarge, "request body too large")
			return
		}
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	cleaned, err := validatePortfolioLink(in)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	tx, err := s.db.Begin(r.Context())
	if err != nil {
		serverError(w, err)
		return
	}
	defer tx.Rollback(r.Context())

	var authorID string
	err = tx.QueryRow(r.Context(), `SELECT author_id::text FROM outfits WHERE id = $1::uuid AND visibility = 'public' AND status = 'published'`, cleaned.OutfitID).Scan(&authorID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "not found")
			return
		}
		serverError(w, err)
		return
	}
	if authorID != makerID {
		writeError(w, http.StatusNotFound, "not found")
		return
	}

	var status string
	err = tx.QueryRow(r.Context(), `SELECT status FROM craft_requests WHERE id = $1::uuid`, cleaned.RequestID).Scan(&status)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "not found")
			return
		}
		serverError(w, err)
		return
	}
	if status != "done" {
		writeError(w, http.StatusBadRequest, "only done requests can be showcased")
		return
	}

	var entry portfolioEntryView
	err = tx.QueryRow(r.Context(), `
		INSERT INTO maker_portfolio (maker_id, request_id, outfit_id)
		VALUES ($1::uuid, $2::uuid, $3::uuid)
		RETURNING id::text, request_id::text, outfit_id::text
	`, makerID, cleaned.RequestID, cleaned.OutfitID).Scan(&entry.ID, &entry.RequestID, &entry.OutfitID)
	if err != nil {
		if conflictMsg, ok := portfolioConflictMessage(err); ok {
			writeError(w, http.StatusConflict, conflictMsg)
			return
		}
		serverError(w, err)
		return
	}
	if err := tx.Commit(r.Context()); err != nil {
		if conflictMsg, ok := portfolioConflictMessage(err); ok {
			writeError(w, http.StatusConflict, conflictMsg)
			return
		}
		serverError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, map[string]portfolioEntryView{"entry": entry})
}

// portfolioConflictMessage maps a UNIQUE violation on maker_portfolio to a
// user-facing explanation. Two distinct races collide on 23505: another
// maker won the request (UNIQUE(request_id)) or the caller already linked
// this outfit elsewhere (UNIQUE(maker_id, outfit_id)).
func portfolioConflictMessage(err error) (string, bool) {
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) || pgErr.Code != "23505" {
		return "", false
	}
	if pgErr.ConstraintName == "maker_portfolio_maker_id_outfit_id_key" {
		return "outfit already showcased", true
	}
	return "request already showcased", true
}

// deletePortfolioEntry removes a showcase link. Only the entry's maker can
// remove it; foreign or missing entries 404 (anti-enumeration, mirroring
// collectionOwnerCheck).
func (s *server) deletePortfolioEntry(w http.ResponseWriter, r *http.Request, claims *authClaims) {
	makerID, ok := s.requireMaker(w, r, claims)
	if !ok {
		return
	}
	id := r.PathValue("id")
	if !uuidRegex.MatchString(id) {
		writeError(w, http.StatusNotFound, "not found")
		return
	}

	tag, err := s.db.Exec(r.Context(), `DELETE FROM maker_portfolio WHERE id = $1::uuid AND maker_id = $2::uuid`, id, makerID)
	if err != nil {
		serverError(w, err)
		return
	}
	if tag.RowsAffected() == 0 {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
