package httpapi

import (
	"errors"
	"regexp"
	"strings"
	"unicode"
	"unicode/utf8"
)

type newOutfitInput struct {
	Title    string       `json:"title"`
	Caption  string       `json:"caption"`
	Tags     []string     `json:"tags"`
	Accent   string       `json:"accent"`
	ImageURL string       `json:"imageUrl"`
	Pieces   []magicPiece `json:"pieces"`
}

// maxOutfitPieces caps AI-suggested pieces per outfit at publish time.
const maxOutfitPieces = 12

var accentRegex = regexp.MustCompile(`^#[0-9a-f]{6}$`)
var usernameRegex = regexp.MustCompile(`^[a-z0-9_]{3,30}$`)

func validateProfile(username, displayName string) (string, string, error) {
	u := strings.ToLower(strings.TrimSpace(username))
	uLen := utf8.RuneCountInString(u)
	if uLen < 3 || uLen > 30 {
		return "", "", errors.New("username must be between 3 and 30 characters")
	}
	if !usernameRegex.MatchString(u) {
		return "", "", errors.New("username must contain only lowercase letters, numbers, and underscores")
	}

	d := strings.TrimSpace(displayName)
	dLen := utf8.RuneCountInString(d)
	if dLen < 1 || dLen > 60 {
		return "", "", errors.New("displayName must be between 1 and 60 characters")
	}

	return u, d, nil
}

func validateNewOutfit(in newOutfitInput) (newOutfitInput, error) {
	var cleaned newOutfitInput
	title := strings.TrimSpace(in.Title)
	titleLen := utf8.RuneCountInString(title)
	if titleLen < 1 || titleLen > 120 {
		return cleaned, errors.New("title must be between 1 and 120 characters")
	}
	cleaned.Title = title

	caption := strings.TrimSpace(in.Caption)
	if utf8.RuneCountInString(caption) > 2000 {
		return cleaned, errors.New("caption must be at most 2000 characters")
	}
	cleaned.Caption = caption

	cleaned.Tags = make([]string, 0)
	seen := make(map[string]bool)
	for _, raw := range in.Tags {
		t := strings.TrimSpace(raw)
		tLen := utf8.RuneCountInString(t)
		if tLen < 1 || tLen > 30 {
			return cleaned, errors.New("each tag must be between 1 and 30 characters")
		}
		lower := strings.ToLower(t)
		if !seen[lower] {
			seen[lower] = true
			cleaned.Tags = append(cleaned.Tags, t)
		}
	}
	if len(cleaned.Tags) > 5 {
		return cleaned, errors.New("tags cannot exceed 5")
	}

	if !accentRegex.MatchString(in.Accent) {
		return cleaned, errors.New("accent must match ^#[0-9a-f]{6}$")
	}
	cleaned.Accent = in.Accent

	if in.ImageURL != "" {
		if !strings.HasPrefix(in.ImageURL, "https://") {
			return cleaned, errors.New("imageUrl must start with https://")
		}
		if utf8.RuneCountInString(in.ImageURL) > 500 {
			return cleaned, errors.New("imageUrl must be at most 500 characters")
		}
		if strings.IndexFunc(in.ImageURL, unicode.IsSpace) >= 0 {
			return cleaned, errors.New("imageUrl cannot contain whitespace")
		}
		cleaned.ImageURL = in.ImageURL
	}

	// Pieces come from Magic Tag suggestions; drop anything malformed rather
	// than failing the whole publish, and cap the count.
	cleaned.Pieces = sanitizePieces(in.Pieces)
	if len(cleaned.Pieces) > maxOutfitPieces {
		cleaned.Pieces = cleaned.Pieces[:maxOutfitPieces]
	}
	return cleaned, nil
}

type craftRequestInput struct {
	Category    string  `json:"category"`
	Description string  `json:"description"`
	BudgetIDR   *int64  `json:"budgetIdr"`
	OutfitID    *string `json:"outfitId"`
	PieceID     *string `json:"pieceId"`
	OutfitLabel *string `json:"outfitLabel"`
	PieceLabel  *string `json:"pieceLabel"`
}

func validateCraftRequest(in craftRequestInput) (craftRequestInput, error) {
	var cleaned craftRequestInput

	cat := strings.TrimSpace(in.Category)
	switch cat {
	case "hat", "top", "bottom", "shoes", "bag", "accessory":
		cleaned.Category = cat
	default:
		return cleaned, errors.New("category must be one of: hat, top, bottom, shoes, bag, accessory")
	}

	desc := strings.TrimSpace(in.Description)
	descLen := utf8.RuneCountInString(desc)
	if descLen < 10 || descLen > 1000 {
		return cleaned, errors.New("description must be between 10 and 1000 characters")
	}
	cleaned.Description = desc

	if in.BudgetIDR != nil {
		if *in.BudgetIDR < 0 || *in.BudgetIDR > 1000000000 {
			return cleaned, errors.New("budgetIdr must be between 0 and 1000000000")
		}
		b := *in.BudgetIDR
		cleaned.BudgetIDR = &b
	}

	if in.OutfitID != nil && strings.TrimSpace(*in.OutfitID) != "" {
		oid := strings.TrimSpace(*in.OutfitID)
		if !uuidRegex.MatchString(oid) {
			return cleaned, errors.New("outfitId must be a valid uuid")
		}
		cleaned.OutfitID = &oid
	}

	if in.PieceID != nil && strings.TrimSpace(*in.PieceID) != "" {
		pid := strings.TrimSpace(*in.PieceID)
		if !uuidRegex.MatchString(pid) {
			return cleaned, errors.New("pieceId must be a valid uuid")
		}
		cleaned.PieceID = &pid
	}

	if in.OutfitLabel != nil && strings.TrimSpace(*in.OutfitLabel) != "" {
		lbl := strings.TrimSpace(*in.OutfitLabel)
		if utf8.RuneCountInString(lbl) > 120 {
			return cleaned, errors.New("outfitLabel must be at most 120 characters")
		}
		cleaned.OutfitLabel = &lbl
	}

	if in.PieceLabel != nil && strings.TrimSpace(*in.PieceLabel) != "" {
		lbl := strings.TrimSpace(*in.PieceLabel)
		if utf8.RuneCountInString(lbl) > 120 {
			return cleaned, errors.New("pieceLabel must be at most 120 characters")
		}
		cleaned.PieceLabel = &lbl
	}

	return cleaned, nil
}

type commentInput struct {
	Body string `json:"body"`
}

// maxCommentRunes matches mall_messages CHECK and the MallChat MAX_LEN.
const maxCommentRunes = 500

func validateComment(in commentInput) (commentInput, error) {
	var cleaned commentInput
	body := strings.TrimSpace(in.Body)
	bodyLen := utf8.RuneCountInString(body)
	if bodyLen < 1 || bodyLen > maxCommentRunes {
		return cleaned, errors.New("body must be between 1 and 500 characters")
	}
	cleaned.Body = body
	return cleaned, nil
}

// validateRequestStatus allows only maker-driven transitions: from open to
// accepted/declined/done, plus accepted to done (work completed). Reopening
// (back to open) is rejected: requesters file a new request instead.
// done and declined are terminal.
func validateRequestStatus(current, next string) (string, error) {
	switch next {
	case "accepted", "declined", "done":
	default:
		return "", errors.New("status must be one of: accepted, declined, done")
	}
	switch current {
	case "open":
		return next, nil
	case "accepted":
		if next != "done" {
			return "", errors.New("accepted requests can only be marked done")
		}
		return next, nil
	default:
		return "", errors.New("only open or accepted requests can change status")
	}
}
