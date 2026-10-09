package httpapi

import (
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
