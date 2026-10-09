package httpapi

import (
	"errors"
	"regexp"
	"strings"
	"unicode"
	"unicode/utf8"
)

type newOutfitInput struct {
	Username string   `json:"username"`
	Title    string   `json:"title"`
	Caption  string   `json:"caption"`
	Tags     []string `json:"tags"`
	Accent   string   `json:"accent"`
	ImageURL string   `json:"imageUrl"`
}

var accentRegex = regexp.MustCompile(`^#[0-9a-f]{6}$`)

func validateNewOutfit(in newOutfitInput) (newOutfitInput, error) {
	var cleaned newOutfitInput

	cleaned.Username = strings.TrimSpace(in.Username)

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
	return cleaned, nil
}

type craftRequestInput struct {
	Username    string  `json:"username"`
	Category    string  `json:"category"`
	Description string  `json:"description"`
	BudgetIDR   *int64  `json:"budgetIdr"`
	OutfitID    *string `json:"outfitId"`
	PieceID     *string `json:"pieceId"`
}

func validateCraftRequest(in craftRequestInput) (craftRequestInput, error) {
	var cleaned craftRequestInput

	// ponytail: username is trusted from the client payload until session auth is introduced; verify against users table.
	username := strings.TrimSpace(in.Username)
	if username == "" {
		return cleaned, errors.New("username required")
	}
	cleaned.Username = username

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

	return cleaned, nil
}
