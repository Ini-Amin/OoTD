package httpapi

import (
	"slices"
	"strings"
	"testing"
	"unicode/utf8"
)

func TestValidateNewOutfit(t *testing.T) {
	tests := []struct {
		name      string
		input     newOutfitInput
		wantErr   bool
		checkFunc func(t *testing.T, cleaned newOutfitInput)
	}{
		{
			name: "valid input",
			input: newOutfitInput{
				Username: "nadyaaulia",
				Title:    "Campus Autumn Look",
				Caption:  "Warm layers for cool mornings.",
				Tags:     []string{"campus", "layering"},
				Accent:   "#e8b86d",
			},
			wantErr: false,
			checkFunc: func(t *testing.T, cleaned newOutfitInput) {
				if cleaned.Title != "Campus Autumn Look" {
					t.Errorf("got title %q, want %q", cleaned.Title, "Campus Autumn Look")
				}
				if len(cleaned.Tags) != 2 {
					t.Errorf("got %d tags, want 2", len(cleaned.Tags))
				}
			},
		},
		{
			name: "empty title",
			input: newOutfitInput{
				Username: "nadyaaulia",
				Title:    "   ",
				Caption:  "Some caption",
				Tags:     []string{"streetwear"},
				Accent:   "#123456",
			},
			wantErr: true,
		},
		{
			name: "121-char title",
			input: newOutfitInput{
				Username: "nadyaaulia",
				Title:    strings.Repeat("a", 121),
				Caption:  "Some caption",
				Tags:     []string{"streetwear"},
				Accent:   "#123456",
			},
			wantErr: true,
		},
		{
			name: "6 tags",
			input: newOutfitInput{
				Username: "nadyaaulia",
				Title:    "Look with too many tags",
				Caption:  "Some caption",
				Tags:     []string{"tag1", "tag2", "tag3", "tag4", "tag5", "tag6"},
				Accent:   "#123456",
			},
			wantErr: true,
		},
		{
			name: "duplicate tags differing by case",
			input: newOutfitInput{
				Username: "nadyaaulia",
				Title:    "Duplicate tags",
				Caption:  "Some caption",
				Tags:     []string{"Vintage", "vintage", "VINTAGE"},
				Accent:   "#123456",
			},
			wantErr: false,
			checkFunc: func(t *testing.T, cleaned newOutfitInput) {
				if len(cleaned.Tags) != 1 {
					t.Fatalf("expected 1 tag after deduplication, got %d", len(cleaned.Tags))
				}
				if cleaned.Tags[0] != "Vintage" {
					t.Errorf("expected first spelling 'Vintage', got %q", cleaned.Tags[0])
				}
			},
		},
		{
			name: "uppercase accent rejected",
			input: newOutfitInput{
				Username: "nadyaaulia",
				Title:    "Upper accent",
				Caption:  "Some caption",
				Tags:     []string{"vintage"},
				Accent:   "#AABBCC",
			},
			wantErr: true,
		},
		{
			name: "multibyte title length counted in runes",
			input: newOutfitInput{
				Username: "nadyaaulia",
				Title:    strings.Repeat("日", 120),
				Caption:  "Multibyte test",
				Tags:     []string{"japan"},
				Accent:   "#123456",
			},
			wantErr: false,
			checkFunc: func(t *testing.T, cleaned newOutfitInput) {
				if utf8.RuneCountInString(cleaned.Title) != 120 {
					t.Fatalf("expected 120 runes, got %d", utf8.RuneCountInString(cleaned.Title))
				}
				if len(cleaned.Title) != 360 {
					t.Fatalf("expected 360 bytes, got %d", len(cleaned.Title))
				}
			},
		},
		{
			name: "empty imageUrl ok",
			input: newOutfitInput{
				Username: "nadyaaulia",
				Title:    "Valid Outfit",
				Caption:  "A nice caption.",
				Tags:     []string{"campus"},
				Accent:   "#e8b86d",
				ImageURL: "",
			},
			wantErr: false,
			checkFunc: func(t *testing.T, cleaned newOutfitInput) {
				if cleaned.ImageURL != "" {
					t.Errorf("got ImageURL %q, want empty", cleaned.ImageURL)
				}
			},
		},
		{
			name: "valid https imageUrl ok",
			input: newOutfitInput{
				Username: "nadyaaulia",
				Title:    "Valid Outfit",
				Caption:  "A nice caption.",
				Tags:     []string{"campus"},
				Accent:   "#e8b86d",
				ImageURL: "https://picsum.photos/seed/ootd1/600/800",
			},
			wantErr: false,
			checkFunc: func(t *testing.T, cleaned newOutfitInput) {
				if cleaned.ImageURL != "https://picsum.photos/seed/ootd1/600/800" {
					t.Errorf("got ImageURL %q, want %q", cleaned.ImageURL, "https://picsum.photos/seed/ootd1/600/800")
				}
			},
		},
		{
			name: "http imageUrl rejected",
			input: newOutfitInput{
				Username: "nadyaaulia",
				Title:    "Valid Outfit",
				Caption:  "A nice caption.",
				Tags:     []string{"campus"},
				Accent:   "#e8b86d",
				ImageURL: "http://picsum.photos/seed/ootd1/600/800",
			},
			wantErr: true,
		},
		{
			name: "imageUrl over 500 chars rejected",
			input: newOutfitInput{
				Username: "nadyaaulia",
				Title:    "Valid Outfit",
				Caption:  "A nice caption.",
				Tags:     []string{"campus"},
				Accent:   "#e8b86d",
				ImageURL: "https://picsum.photos/" + strings.Repeat("a", 480),
			},
			wantErr: true,
		},
		{
			name: "imageUrl containing space rejected",
			input: newOutfitInput{
				Username: "nadyaaulia",
				Title:    "Valid Outfit",
				Caption:  "A nice caption.",
				Tags:     []string{"campus"},
				Accent:   "#e8b86d",
				ImageURL: "https://picsum.photos/seed/ootd test/600/800",
			},
			wantErr: true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			cleaned, err := validateNewOutfit(tc.input)
			if (err != nil) != tc.wantErr {
				t.Fatalf("validateNewOutfit() error = %v, wantErr = %v", err, tc.wantErr)
			}
			if !tc.wantErr && tc.checkFunc != nil {
				tc.checkFunc(t, cleaned)
			}
		})
	}
}

func TestValidateCraftRequest(t *testing.T) {
	validBudget := int64(150000)
	validOutfitID := "c0000000-0000-0000-0000-000000000001"
	validPieceID := "a0000000-0000-0000-0000-000000000001"
	negBudget := int64(-1)
	badUUID := "not-a-valid-uuid"

	tests := []struct {
		name    string
		input   craftRequestInput
		wantErr bool
	}{
		{
			name: "valid",
			input: craftRequestInput{
				Username:    "nadyaaulia",
				Category:    "top",
				Description: "Looking for an oversized linen shirt with relaxed drape",
				BudgetIDR:   &validBudget,
				OutfitID:    &validOutfitID,
				PieceID:     &validPieceID,
			},
			wantErr: false,
		},
		{
			name: "short description",
			input: craftRequestInput{
				Username:    "nadyaaulia",
				Category:    "top",
				Description: "too short",
			},
			wantErr: true,
		},
		{
			name: "1001 chars description",
			input: craftRequestInput{
				Username:    "nadyaaulia",
				Category:    "top",
				Description: strings.Repeat("a", 1001),
			},
			wantErr: true,
		},
		{
			name: "bad category",
			input: craftRequestInput{
				Username:    "nadyaaulia",
				Category:    "spacesuit",
				Description: "Valid length description for testing purpose",
			},
			wantErr: true,
		},
		{
			name: "negative budget",
			input: craftRequestInput{
				Username:    "nadyaaulia",
				Category:    "shoes",
				Description: "Valid length description for testing purpose",
				BudgetIDR:   &negBudget,
			},
			wantErr: true,
		},
		{
			name: "bad uuid",
			input: craftRequestInput{
				Username:    "nadyaaulia",
				Category:    "shoes",
				Description: "Valid length description for testing purpose",
				OutfitID:    &badUUID,
			},
			wantErr: true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			_, err := validateCraftRequest(tc.input)
			if (err != nil) != tc.wantErr {
				t.Fatalf("validateCraftRequest() error = %v, wantErr = %v", err, tc.wantErr)
			}
		})
	}
}

func TestInterpretQuery(t *testing.T) {
	tags := []string{"vintage", "campus", "rainy-day", "earth-tones"}

	tests := []struct {
		name       string
		q          string
		wantStyles []string
		wantCats   []string
		wantWords  []string
	}{
		{
			name:       "styles, category and word query",
			q:          "vintage denim shoes",
			wantStyles: []string{"vintage"},
			wantCats:   []string{"shoes"},
			wantWords:  []string{"denim"},
		},
		{
			name:       "multi-word style with stopwords and category",
			q:          "rainy day look with oversized jacket",
			wantStyles: []string{"rainy-day"},
			wantCats:   []string{"top"},
			wantWords:  []string{"oversized"},
		},
		{
			name:       "only stopwords and short words",
			q:          "the and for me to",
			wantStyles: []string{},
			wantCats:   []string{},
			wantWords:  []string{},
		},
		{
			name:       "multiple category synonyms deduped",
			q:          "sneakers and boots",
			wantStyles: []string{},
			wantCats:   []string{"shoes"},
			wantWords:  []string{},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := interpretQuery(tc.q, tags)
			if !slices.Equal(got.Styles, tc.wantStyles) {
				t.Errorf("Styles = %v, want %v", got.Styles, tc.wantStyles)
			}
			if !slices.Equal(got.Categories, tc.wantCats) {
				t.Errorf("Categories = %v, want %v", got.Categories, tc.wantCats)
			}
			if !slices.Equal(got.Words, tc.wantWords) {
				t.Errorf("Words = %v, want %v", got.Words, tc.wantWords)
			}
		})
	}
}
