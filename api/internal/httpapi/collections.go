package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5"
)

type collection struct {
	ID          string   `json:"id"`
	Title       string   `json:"title"`
	Description string   `json:"description"`
	Visibility  string   `json:"visibility"`
	OutfitIDs   []string `json:"outfitIds"`
}

type createCollectionInput struct {
	Title string `json:"title"`
}

type addCollectionItemInput struct {
	OutfitID string `json:"outfitId"`
}

// collectionOwnerCheck resolves the caller's user id and verifies the
// collection belongs to them. Foreign or missing collections return
// want404=true so handlers answer 404 and avoid enumeration.
func (s *server) collectionOwnerCheck(r *http.Request, claims *authClaims, collectionID string) (ownerID string, ok bool, want404 bool, err error) {
	if !uuidRegex.MatchString(collectionID) {
		return "", false, true, nil
	}
	ownerID, err = s.followerIDByAuth(r, claims)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", false, true, nil
		}
		return "", false, false, err
	}
	var exists bool
	if err := s.db.QueryRow(r.Context(), `
		SELECT EXISTS (SELECT 1 FROM collections WHERE id = $1::uuid AND owner_id = $2::uuid)
	`, collectionID, ownerID).Scan(&exists); err != nil {
		return "", false, false, err
	}
	if !exists {
		return "", false, true, nil
	}
	return ownerID, true, false, nil
}

func (s *server) createCollection(w http.ResponseWriter, r *http.Request, claims *authClaims) {
	r.Body = http.MaxBytesReader(w, r.Body, 64<<10)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()

	var in createCollectionInput
	if err := dec.Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	title := strings.TrimSpace(in.Title)
	if title == "" || len(title) > 60 {
		writeError(w, http.StatusBadRequest, "title must be 1-60 characters")
		return
	}

	ownerID, err := s.followerIDByAuth(r, claims)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "create your profile first")
			return
		}
		serverError(w, err)
		return
	}

	var c collection
	err = s.db.QueryRow(r.Context(), `
		INSERT INTO collections (owner_id, title)
		VALUES ($1::uuid, $2)
		RETURNING id::text, title, description, visibility
	`, ownerID, title).Scan(&c.ID, &c.Title, &c.Description, &c.Visibility)
	if err != nil {
		serverError(w, err)
		return
	}
	c.OutfitIDs = []string{}

	writeJSON(w, http.StatusCreated, map[string]collection{"collection": c})
}

func (s *server) listCollections(w http.ResponseWriter, r *http.Request, claims *authClaims) {
	ownerID, err := s.followerIDByAuth(r, claims)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSON(w, http.StatusOK, map[string][]collection{"collections": {}})
			return
		}
		serverError(w, err)
		return
	}

	rows, err := s.db.Query(r.Context(), `
		SELECT c.id::text, c.title, c.description, c.visibility,
		       COALESCE(array_agg(ci.outfit_id::text ORDER BY ci.sort_order, ci.outfit_id) FILTER (WHERE ci.outfit_id IS NOT NULL), '{}')
		FROM collections c
		LEFT JOIN collection_items ci ON ci.collection_id = c.id
		WHERE c.owner_id = $1::uuid
		GROUP BY c.id
		ORDER BY c.created_at DESC, c.id DESC
	`, ownerID)
	if err != nil {
		serverError(w, err)
		return
	}
	defer rows.Close()

	collections := []collection{}
	for rows.Next() {
		var c collection
		if err := rows.Scan(&c.ID, &c.Title, &c.Description, &c.Visibility, &c.OutfitIDs); err != nil {
			serverError(w, err)
			return
		}
		if c.OutfitIDs == nil {
			c.OutfitIDs = []string{}
		}
		collections = append(collections, c)
	}
	if err := rows.Err(); err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string][]collection{"collections": collections})
}

func (s *server) deleteCollection(w http.ResponseWriter, r *http.Request, claims *authClaims) {
	_, ok, want404, err := s.collectionOwnerCheck(r, claims, r.PathValue("id"))
	if err != nil {
		serverError(w, err)
		return
	}
	if !ok || want404 {
		writeError(w, http.StatusNotFound, "not found")
		return
	}

	if _, err := s.db.Exec(r.Context(), `DELETE FROM collections WHERE id = $1::uuid`, r.PathValue("id")); err != nil {
		serverError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *server) addCollectionItem(w http.ResponseWriter, r *http.Request, claims *authClaims) {
	_, ok, want404, err := s.collectionOwnerCheck(r, claims, r.PathValue("id"))
	if err != nil {
		serverError(w, err)
		return
	}
	if !ok || want404 {
		writeError(w, http.StatusNotFound, "not found")
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, 64<<10)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()

	var in addCollectionItemInput
	if err := dec.Decode(&in); err != nil {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	if !uuidRegex.MatchString(in.OutfitID) {
		writeError(w, http.StatusNotFound, "not found")
		return
	}

	var exists bool
	if err := s.db.QueryRow(r.Context(), `SELECT EXISTS (SELECT 1 FROM outfits WHERE id = $1::uuid)`, in.OutfitID).Scan(&exists); err != nil {
		serverError(w, err)
		return
	}
	if !exists {
		writeError(w, http.StatusNotFound, "not found")
		return
	}

	if _, err := s.db.Exec(r.Context(), `
		INSERT INTO collection_items (collection_id, outfit_id)
		VALUES ($1::uuid, $2::uuid)
		ON CONFLICT DO NOTHING
	`, r.PathValue("id"), in.OutfitID); err != nil {
		serverError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *server) removeCollectionItem(w http.ResponseWriter, r *http.Request, claims *authClaims) {
	_, ok, want404, err := s.collectionOwnerCheck(r, claims, r.PathValue("id"))
	if err != nil {
		serverError(w, err)
		return
	}
	if !ok || want404 {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	if !uuidRegex.MatchString(r.PathValue("outfitId")) {
		writeError(w, http.StatusNotFound, "not found")
		return
	}

	if _, err := s.db.Exec(r.Context(), `
		DELETE FROM collection_items
		WHERE collection_id = $1::uuid AND outfit_id = $2::uuid
	`, r.PathValue("id"), r.PathValue("outfitId")); err != nil {
		serverError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
