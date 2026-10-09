package httpapi

import (
	"net/http"
	"sort"
	"strings"
	"unicode"
	"unicode/utf8"
)

type InterpretedQuery struct {
	Styles     []string `json:"styles"`
	Categories []string `json:"categories"`
	Words      []string `json:"words"`
}

type searchResponse struct {
	Outfits     []Outfit         `json:"outfits"`
	Interpreted InterpretedQuery `json:"interpreted"`
}

var categorySynonyms = map[string]string{
	"shoe":      "shoes",
	"shoes":     "shoes",
	"sneaker":   "shoes",
	"sneakers":  "shoes",
	"boots":     "shoes",

	"pant":      "bottom",
	"pants":     "bottom",
	"trouser":   "bottom",
	"trousers":  "bottom",
	"jeans":     "bottom",
	"skirt":     "bottom",
	"shorts":    "bottom",

	"shirt":     "top",
	"tee":       "top",
	"top":       "top",
	"jacket":    "top",
	"coat":      "top",
	"knit":      "top",
	"sweater":   "top",
	"blouse":    "top",
	"dress":     "top",

	"hat":       "hat",
	"cap":       "hat",
	"beanie":    "hat",

	"bag":       "bag",
	"tote":      "bag",
	"purse":     "bag",

	"jewelry":   "accessory",
	"jewellery": "accessory",
	"watch":     "accessory",
	"scarf":     "accessory",
	"belt":      "accessory",
	"glasses":   "accessory",
}

var stopWords = map[string]bool{
	"the":     true,
	"and":     true,
	"for":     true,
	"with":    true,
	"outfit":  true,
	"outfits": true,
	"look":    true,
	"looks":   true,
	"find":    true,
	"show":    true,
	"me":      true,
	"want":    true,
	"some":    true,
	"that":    true,
	"from":    true,
}

func escapeLike(s string) string {
	var b strings.Builder
	for _, r := range s {
		switch r {
		case '\\':
			b.WriteString(`\\`)
		case '%':
			b.WriteString(`\%`)
		case '_':
			b.WriteString(`\_`)
		default:
			b.WriteRune(r)
		}
	}
	return b.String()
}

func interpretQuery(q string, tags []string) InterpretedQuery {
	inter := InterpretedQuery{
		Styles:     make([]string, 0),
		Categories: make([]string, 0),
		Words:      make([]string, 0),
	}

	lowered := strings.ToLower(q)
	tokens := strings.FieldsFunc(lowered, func(r rune) bool {
		return !unicode.IsLetter(r) && !unicode.IsDigit(r)
	})
	if len(tokens) == 0 {
		return inter
	}

	consumed := make([]bool, len(tokens))

	type tagCandidate struct {
		name   string
		phrase []string
	}

	candidates := make([]tagCandidate, 0, len(tags))
	for _, t := range tags {
		norm := strings.TrimSpace(t)
		if norm == "" {
			continue
		}
		words := strings.FieldsFunc(strings.ReplaceAll(norm, "-", " "), func(r rune) bool {
			return !unicode.IsLetter(r) && !unicode.IsDigit(r)
		})
		if len(words) > 0 {
			candidates = append(candidates, tagCandidate{name: norm, phrase: words})
		}
	}

	// Prefer longer phrases first
	sort.SliceStable(candidates, func(i, j int) bool {
		if len(candidates[i].phrase) != len(candidates[j].phrase) {
			return len(candidates[i].phrase) > len(candidates[j].phrase)
		}
		return candidates[i].name < candidates[j].name
	})

	seenStyle := make(map[string]bool)
	for _, c := range candidates {
		pLen := len(c.phrase)
		for i := range len(tokens) - pLen + 1 {
			match := true
			for k := range pLen {
				if consumed[i+k] || tokens[i+k] != c.phrase[k] {
					match = false
					break
				}
			}
			if match {
				for k := range pLen {
					consumed[i+k] = true
				}
				if !seenStyle[c.name] {
					seenStyle[c.name] = true
					inter.Styles = append(inter.Styles, c.name)
				}
			}
		}
	}

	seenCat := make(map[string]bool)
	for i := range tokens {
		if consumed[i] {
			continue
		}
		if cat, ok := categorySynonyms[tokens[i]]; ok {
			consumed[i] = true
			if !seenCat[cat] {
				seenCat[cat] = true
				inter.Categories = append(inter.Categories, cat)
			}
		}
	}

	seenWord := make(map[string]bool)
	for i := range tokens {
		if consumed[i] {
			continue
		}
		w := tokens[i]
		if utf8.RuneCountInString(w) >= 3 && !stopWords[w] {
			consumed[i] = true
			if !seenWord[w] {
				seenWord[w] = true
				inter.Words = append(inter.Words, w)
			}
		}
	}

	return inter
}

const searchScoreExpr = `(
	(CASE WHEN cardinality($1::text[]) = 0 THEN 0 ELSE (3 * COUNT(DISTINCT t.id) FILTER (WHERE t.normalized_name = ANY($1::text[])))::int END)
	+
	(CASE WHEN cardinality($2::text[]) = 0 THEN 0 ELSE (2 * (SELECT COUNT(DISTINCT op.category)::int FROM outfit_pieces op WHERE op.outfit_id = o.id AND op.category = ANY($2::text[]))) END)
	+
	(CASE WHEN cardinality($3::text[]) = 0 THEN 0 ELSE (SELECT COUNT(*)::int FROM unnest($3::text[]) AS pat WHERE o.title ILIKE pat OR o.caption ILIKE pat OR EXISTS (SELECT 1 FROM outfit_pieces op WHERE op.outfit_id = o.id AND op.label ILIKE pat)) END)
)`

var searchOutfitsSQL = outfitSelectSQL(
	searchScoreExpr+` AS match`,
	`WHERE o.visibility = 'public' AND o.status = 'published'`,
	`HAVING `+searchScoreExpr+` > 0
	 ORDER BY match DESC, o.published_at DESC
	 LIMIT 50`,
)

func (s *server) searchOutfits(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if q == "" {
		writeError(w, http.StatusBadRequest, "q required")
		return
	}
	if utf8.RuneCountInString(q) > 200 {
		writeError(w, http.StatusBadRequest, "q exceeds 200 characters")
		return
	}

	rows, err := s.db.Query(r.Context(), `SELECT normalized_name FROM tags`)
	if err != nil {
		serverError(w, err)
		return
	}
	defer rows.Close()

	var tags []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			serverError(w, err)
			return
		}
		tags = append(tags, name)
	}
	if err := rows.Err(); err != nil {
		serverError(w, err)
		return
	}

	interpreted := interpretQuery(q, tags)
	if len(interpreted.Styles) == 0 && len(interpreted.Categories) == 0 && len(interpreted.Words) == 0 {
		writeJSON(w, http.StatusOK, searchResponse{
			Outfits:     []Outfit{},
			Interpreted: interpreted,
		})
		return
	}

	wordPatterns := make([]string, len(interpreted.Words))
	for i, w := range interpreted.Words {
		wordPatterns[i] = "%" + escapeLike(w) + "%"
	}

	oRows, err := s.db.Query(r.Context(), searchOutfitsSQL, interpreted.Styles, interpreted.Categories, wordPatterns)
	if err != nil {
		serverError(w, err)
		return
	}
	defer oRows.Close()

	outfits, err := scanOutfits(oRows)
	if err != nil {
		serverError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, searchResponse{
		Outfits:     outfits,
		Interpreted: interpreted,
	})
}
