package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

const userProfileSelectSQL = `
	SELECT u.username, u.display_name, u.bio,
	       t.slug, t.name, t.bg, t.surface, t.fg, t.accent, t.font, t.radius
	FROM users u
	LEFT JOIN themes t ON t.id = u.theme_id
`

func scanUserProfile(row rowScanner) (UserProfile, error) {
	var u UserProfile
	var slug, name, bg, surface, fg, accent, font, radius *string
	err := row.Scan(
		&u.Username, &u.DisplayName, &u.Bio,
		&slug, &name, &bg, &surface, &fg, &accent, &font, &radius,
	)
	if err != nil {
		return UserProfile{}, err
	}
	if slug != nil {
		u.Theme = &Theme{
			Slug:    *slug,
			Name:    *name,
			Bg:      *bg,
			Surface: *surface,
			Fg:      *fg,
			Accent:  *accent,
			Font:    *font,
			Radius:  *radius,
		}
	}
	return u, nil
}

func (s *server) getMe(w http.ResponseWriter, r *http.Request, claims *authClaims) {
	u, err := scanUserProfile(s.db.QueryRow(r.Context(), userProfileSelectSQL+" WHERE u.auth_id = $1::uuid", claims.Sub))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSON(w, http.StatusOK, map[string]any{
				"user":   nil,
				"authId": claims.Sub,
				"email":  claims.Email,
			})
			return
		}
		serverError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]UserProfile{"user": u})
}

type postMeInput struct {
	Username    string `json:"username"`
	DisplayName string `json:"displayName"`
}

func (s *server) postMe(w http.ResponseWriter, r *http.Request, claims *authClaims) {
	r.Body = http.MaxBytesReader(w, r.Body, 64<<10)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()

	var in postMeInput
	if err := dec.Decode(&in); err != nil {
		var maxBytesErr *http.MaxBytesError
		if errors.As(err, &maxBytesErr) {
			writeError(w, http.StatusRequestEntityTooLarge, "request body too large")
			return
		}
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	username, displayName, err := validateProfile(in.Username, in.DisplayName)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	const insertProfileSQL = `
		WITH inserted AS (
			INSERT INTO users (username, display_name, auth_id, theme_id)
			VALUES ($1, $2, $3::uuid, (SELECT id FROM themes WHERE slug = 'minimal'))
			RETURNING username, display_name, bio, theme_id
		)
		SELECT u.username, u.display_name, u.bio,
		       t.slug, t.name, t.bg, t.surface, t.fg, t.accent, t.font, t.radius
		FROM inserted u
		LEFT JOIN themes t ON t.id = u.theme_id
	`
	u, err := scanUserProfile(s.db.QueryRow(r.Context(), insertProfileSQL, username, displayName, claims.Sub))
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			if strings.Contains(pgErr.ConstraintName, "username") || strings.Contains(pgErr.Detail, "username") {
				writeError(w, http.StatusConflict, "username taken")
				return
			}
			if strings.Contains(pgErr.ConstraintName, "auth_id") || strings.Contains(pgErr.Detail, "auth_id") {
				writeError(w, http.StatusConflict, "profile already exists")
				return
			}
			writeError(w, http.StatusConflict, "conflict")
			return
		}
		serverError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, map[string]UserProfile{"user": u})
}
