package httpapi

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"slices"
	"strings"
	"testing"
	"time"
	"unicode/utf8"

	"github.com/golang-jwt/jwt/v5"
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
				Category:    "top",
				Description: "too short",
			},
			wantErr: true,
		},
		{
			name: "1001 chars description",
			input: craftRequestInput{
				Category:    "top",
				Description: strings.Repeat("a", 1001),
			},
			wantErr: true,
		},
		{
			name: "bad category",
			input: craftRequestInput{
				Category:    "spacesuit",
				Description: "Valid length description for testing purpose",
			},
			wantErr: true,
		},
		{
			name: "negative budget",
			input: craftRequestInput{
				Category:    "shoes",
				Description: "Valid length description for testing purpose",
				BudgetIDR:   &negBudget,
			},
			wantErr: true,
		},
		{
			name: "bad uuid",
			input: craftRequestInput{
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

func TestValidateNewOutfitPieces(t *testing.T) {
	mk := func(cat, label string, x, y, w, h float64) magicPiece {
		p := magicPiece{Category: cat, Label: label}
		p.Box.X, p.Box.Y, p.Box.W, p.Box.H = x, y, w, h
		return p
	}
	base := newOutfitInput{Title: "T", Accent: "#ffffff"}
	t.Run("valid kept", func(t *testing.T) {
		in := base
		in.Pieces = []magicPiece{mk("top", "White shirt", 0.1, 0.1, 0.5, 0.4)}
		out, err := validateNewOutfit(in)
		if err != nil {
			t.Fatalf("expected ok, got %v", err)
		}
		if len(out.Pieces) != 1 || out.Pieces[0].Label != "White shirt" {
			t.Fatalf("unexpected pieces: %+v", out.Pieces)
		}
	})
	t.Run("invalid dropped", func(t *testing.T) {
		in := base
		in.Pieces = []magicPiece{
			mk("spaceship", "UFO", 0.1, 0.1, 0.5, 0.4),
			mk("top", "ok", 0.8, 0.8, 0.5, 0.5),
			mk("shoes", "Sneakers", 0.1, 0.1, 0.3, 0.2),
		}
		out, err := validateNewOutfit(in)
		if err != nil {
			t.Fatalf("expected ok, got %v", err)
		}
		if len(out.Pieces) != 1 || out.Pieces[0].Category != "shoes" {
			t.Fatalf("unexpected pieces: %+v", out.Pieces)
		}
	})
	t.Run("capped", func(t *testing.T) {
		in := base
		for i := 0; i < maxOutfitPieces+5; i++ {
			in.Pieces = append(in.Pieces, mk("top", "Shirt", 0.1, 0.1, 0.5, 0.4))
		}
		out, err := validateNewOutfit(in)
		if err != nil {
			t.Fatalf("expected ok, got %v", err)
		}
		if len(out.Pieces) != maxOutfitPieces {
			t.Fatalf("got %d pieces, want %d", len(out.Pieces), maxOutfitPieces)
		}
	})
}

func TestValidateCraftRequestLabels(t *testing.T) {
	lbl := "Zara · Cropped blazer"
	blank := "   "
	tooLong := strings.Repeat("a", 121)
	out, err := validateCraftRequest(craftRequestInput{
		Category:    "top",
		Description: "Looking for an oversized linen shirt with relaxed drape",
		OutfitLabel: &lbl,
		PieceLabel:  &lbl,
	})
	if err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
	if out.OutfitLabel == nil || *out.OutfitLabel != lbl || out.PieceLabel == nil || *out.PieceLabel != lbl {
		t.Fatalf("labels not preserved: %+v", out)
	}
	out, err = validateCraftRequest(craftRequestInput{
		Category:    "top",
		Description: "Looking for an oversized linen shirt with relaxed drape",
		OutfitLabel: &blank,
	})
	if err != nil {
		t.Fatalf("blank label: expected ok, got %v", err)
	}
	if out.OutfitLabel != nil {
		t.Fatalf("blank label should clean to nil, got %q", *out.OutfitLabel)
	}
	_, err = validateCraftRequest(craftRequestInput{
		Category:    "top",
		Description: "Looking for an oversized linen shirt with relaxed drape",
		PieceLabel:  &tooLong,
	})
	if err == nil {
		t.Fatal("overlong label: expected error")
	}
}

func TestValidateProfile(t *testing.T) {
	tests := []struct {
		name        string
		username    string
		displayName string
		wantU       string
		wantD       string
		wantErr     bool
	}{
		{
			name:        "ok",
			username:    "nadya_aulia",
			displayName: "Nadya Aulia",
			wantU:       "nadya_aulia",
			wantD:       "Nadya Aulia",
			wantErr:     false,
		},
		{
			name:        "uppercase lowercased",
			username:    "Nadya_Aulia",
			displayName: "Nadya Aulia",
			wantU:       "nadya_aulia",
			wantD:       "Nadya Aulia",
			wantErr:     false,
		},
		{
			name:        "too short",
			username:    "na",
			displayName: "Nadya",
			wantErr:     true,
		},
		{
			name:        "too long",
			username:    strings.Repeat("a", 31),
			displayName: "Nadya",
			wantErr:     true,
		},
		{
			name:        "bad chars",
			username:    "nadya-aulia",
			displayName: "Nadya",
			wantErr:     true,
		},
		{
			name:        "empty displayName",
			username:    "nadyaaulia",
			displayName: "   ",
			wantErr:     true,
		},
		{
			name:        "61-rune displayName",
			username:    "nadyaaulia",
			displayName: strings.Repeat("日", 61),
			wantErr:     true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			u, d, err := validateProfile(tc.username, tc.displayName)
			if (err != nil) != tc.wantErr {
				t.Fatalf("validateProfile() error = %v, wantErr = %v", err, tc.wantErr)
			}
			if !tc.wantErr {
				if u != tc.wantU {
					t.Errorf("got username %q, want %q", u, tc.wantU)
				}
				if d != tc.wantD {
					t.Errorf("got displayName %q, want %q", d, tc.wantD)
				}
			}
		})
	}
}

func TestVerifyJWT(t *testing.T) {
	privKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}

	issuer := "https://example.supabase.co/auth/v1"
	auth := &authenticator{
		issuer: issuer,
		keyfunc: func(token *jwt.Token) (any, error) {
			return &privKey.PublicKey, nil
		},
	}

	makeToken := func(method jwt.SigningMethod, key any, iss string, aud []string, sub string, exp time.Time, email string) string {
		claims := &tokenClaims{
			RegisteredClaims: jwt.RegisteredClaims{
				Issuer:    iss,
				Audience:  aud,
				Subject:   sub,
				ExpiresAt: jwt.NewNumericDate(exp),
			},
			Email: email,
		}
		tok := jwt.NewWithClaims(method, claims)
		signed, err := tok.SignedString(key)
		if err != nil {
			t.Fatalf("sign token: %v", err)
		}
		return signed
	}

	validTok := makeToken(jwt.SigningMethodES256, privKey, issuer, []string{"authenticated"}, "c0000000-0000-0000-0000-000000000001", time.Now().Add(time.Hour), "user@example.com")
	expiredTok := makeToken(jwt.SigningMethodES256, privKey, issuer, []string{"authenticated"}, "c0000000-0000-0000-0000-000000000001", time.Now().Add(-time.Hour), "user@example.com")
	wrongAudTok := makeToken(jwt.SigningMethodES256, privKey, issuer, []string{"wrong-audience"}, "c0000000-0000-0000-0000-000000000001", time.Now().Add(time.Hour), "user@example.com")
	hsTok := makeToken(jwt.SigningMethodHS256, []byte("secret-key"), issuer, []string{"authenticated"}, "c0000000-0000-0000-0000-000000000001", time.Now().Add(time.Hour), "user@example.com")
	noneTok := makeToken(jwt.SigningMethodNone, jwt.UnsafeAllowNoneSignatureType, issuer, []string{"authenticated"}, "c0000000-0000-0000-0000-000000000001", time.Now().Add(time.Hour), "user@example.com")

	tests := []struct {
		name      string
		token     string
		wantErr   bool
		wantSub   string
		wantEmail string
	}{
		{
			name:      "valid token ok",
			token:     validTok,
			wantErr:   false,
			wantSub:   "c0000000-0000-0000-0000-000000000001",
			wantEmail: "user@example.com",
		},
		{
			name:    "expired rejected",
			token:   expiredTok,
			wantErr: true,
		},
		{
			name:    "wrong audience rejected",
			token:   wrongAudTok,
			wantErr: true,
		},
		{
			name:    "HS256-signed token rejected",
			token:   hsTok,
			wantErr: true,
		},
		{
			name:    "none alg rejected",
			token:   noneTok,
			wantErr: true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			claims, err := auth.verify(tc.token)
			if (err != nil) != tc.wantErr {
				t.Fatalf("verify() error = %v, wantErr = %v", err, tc.wantErr)
			}
			if !tc.wantErr {
				if claims.Sub != tc.wantSub {
					t.Errorf("got Sub %q, want %q", claims.Sub, tc.wantSub)
				}
				if claims.Email != tc.wantEmail {
					t.Errorf("got Email %q, want %q", claims.Email, tc.wantEmail)
				}
			}
		})
	}
}

func TestValidateRequestStatus(t *testing.T) {
	tests := []struct {
		name    string
		current string
		next    string
		want    string
		wantErr bool
	}{
		{name: "open to accepted", current: "open", next: "accepted", want: "accepted"},
		{name: "open to declined", current: "open", next: "declined", want: "declined"},
		{name: "open to done", current: "open", next: "done", want: "done"},
		{name: "open to open rejected", current: "open", next: "open", wantErr: true},
		{name: "unknown status rejected", current: "open", next: "shipped", wantErr: true},
		{name: "empty status rejected", current: "open", next: "", wantErr: true},
		{name: "accepted to done", current: "accepted", next: "done", want: "done"},
		{name: "accepted to accepted rejected", current: "accepted", next: "accepted", wantErr: true},
		{name: "accepted to declined rejected", current: "accepted", next: "declined", wantErr: true},
		{name: "declined is terminal", current: "declined", next: "accepted", wantErr: true},
		{name: "declined to done rejected", current: "declined", next: "done", wantErr: true},
		{name: "done is terminal", current: "done", next: "accepted", wantErr: true},
		{name: "done to declined rejected", current: "done", next: "declined", wantErr: true},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := validateRequestStatus(tc.current, tc.next)
			if (err != nil) != tc.wantErr {
				t.Fatalf("validateRequestStatus(%q, %q) error = %v, wantErr = %v", tc.current, tc.next, err, tc.wantErr)
			}
			if !tc.wantErr && got != tc.want {
				t.Errorf("got %q, want %q", got, tc.want)
			}
		})
	}
}
