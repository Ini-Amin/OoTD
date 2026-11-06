package httpapi

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"
	"time"
	"unicode/utf8"
)

func TestParseIngestResultHappy(t *testing.T) {
	raw := "```json\n" + `{"title":" Night market fit ","caption":"Linen and denim.","pieces":[
		{"category":"top","label":" White linen shirt ","brand":" Uniqlo ","box":{"x":0.1,"y":0.1,"w":0.5,"h":0.4}},
		{"category":"spaceship","label":"UFO"},
		{"category":"shoes","label":"Sneakers","box":{"x":0,"y":0,"w":0.5,"h":0.2}}
	]}` + "\n```"
	title, caption, pieces, err := parseIngestResult(raw, "instagram")
	if err != nil {
		t.Fatal(err)
	}
	if title != "Night market fit" || caption != "Linen and denim." {
		t.Fatalf("unexpected title/caption: %q %q", title, caption)
	}
	if len(pieces) != 2 {
		t.Fatalf("expected 2 sanitized pieces, got %+v", pieces)
	}
	if pieces[0].Label != "White linen shirt" {
		t.Fatalf("label not trimmed: %+v", pieces[0])
	}
	if pieces[0].Brand == nil || *pieces[0].Brand != "Uniqlo" {
		t.Fatalf("brand lost: %+v", pieces[0].Brand)
	}
	if pieces[1].Brand != nil {
		t.Fatal("missing brand must stay nil")
	}
}

func TestParseIngestResultErrors(t *testing.T) {
	if _, _, _, err := parseIngestResult(`{"error":"not_an_outfit"}`, "x"); err == nil {
		t.Fatal("expected not-an-outfit error")
	}
	if _, _, _, err := parseIngestResult(`{oops`, "x"); err == nil {
		t.Fatal("expected invalid-JSON error")
	}
}

func TestParseIngestResultTitleFallbackAndCaps(t *testing.T) {
	raw := `{"title":"","caption":"` + strings.Repeat("c", 2500) + `","pieces":[]}`
	title, caption, pieces, err := parseIngestResult(raw, "tiktok")
	if err != nil {
		t.Fatal(err)
	}
	if title != "Auto-tagged tiktok mention" {
		t.Fatalf("expected fallback title, got %q", title)
	}
	if n := len([]rune(caption)); n != 2000 {
		t.Fatalf("expected 2000-rune caption, got %d", n)
	}
	if pieces == nil {
		t.Fatal("pieces must be non-nil (empty slice ok)")
	}
}

func TestParseIngestResultCapsPieces(t *testing.T) {
	var b strings.Builder
	b.WriteString(`{"title":"T","caption":"C","pieces":[`)
	for i := 0; i < maxOutfitPieces+5; i++ {
		if i > 0 {
			b.WriteString(",")
		}
		fmt.Fprintf(&b, `{"category":"top","label":"Shirt %d","box":{"x":0,"y":0,"w":0.5,"h":0.5}}`, i)
	}
	b.WriteString(`]}`)
	_, _, pieces, err := parseIngestResult(b.String(), "x")
	if err != nil {
		t.Fatal(err)
	}
	if len(pieces) != maxOutfitPieces {
		t.Fatalf("expected %d pieces, got %d", maxOutfitPieces, len(pieces))
	}
}

func TestBuildIngestLinks(t *testing.T) {
	got := buildIngestLinks("White shirt & jeans?")
	if len(got) != 3 {
		t.Fatalf("expected 3 sources, got %+v", got)
	}
	if got[0].Label != "Tokopedia" || got[1].Label != "Shopee" || got[2].Label != "Google Shopping" {
		t.Fatalf("bad labels: %+v", got)
	}
	for _, s := range got {
		if !strings.HasPrefix(s.URL, "https://") || !strings.Contains(s.URL, "White+shirt") {
			t.Fatalf("bad source URL: %+v", s)
		}
	}
}

func TestIngestSnapshotMarshal(t *testing.T) {
	brand := "Uniqlo"
	snap := ingestSnapshot{
		Title: "T", Caption: "C",
		Pieces: []ingestSnapshotPiece{{
			Category: "top", Label: "White shirt", Brand: &brand,
			PriceEstimate: &ingestPriceEstimate{MinIDR: 1, MaxIDR: 2, Currency: "IDR", Confidence: "low", Note: "n"},
			Sources:       buildIngestLinks("White shirt"),
		}},
	}
	enc, _ := json.Marshal(snap)
	for _, want := range []string{`"brand":"Uniqlo"`, `"price_estimate":{"min_idr":1`, `"sources":[{"label":"Tokopedia"`} {
		if !strings.Contains(string(enc), want) {
			t.Fatalf("missing %s in %s", want, enc)
		}
	}
}

func TestIngestWorkerIntervalFromEnv(t *testing.T) {
	t.Setenv(ingestWorkerIntervalEnv, "")
	if got := IngestWorkerIntervalFromEnv(); got != 10*time.Second {
		t.Fatalf("expected 10s default, got %v", got)
	}
	t.Setenv(ingestWorkerIntervalEnv, "30")
	if got := IngestWorkerIntervalFromEnv(); got != 30*time.Second {
		t.Fatalf("expected 30s, got %v", got)
	}
	t.Setenv(ingestWorkerIntervalEnv, "bogus")
	if got := IngestWorkerIntervalFromEnv(); got != 10*time.Second {
		t.Fatalf("bogus must fall back to 10s, got %v", got)
	}
}

func TestTruncateIngestError(t *testing.T) {
	short := "ai request failed: boom"
	if got := truncateIngestError(short); got != short {
		t.Fatalf("short message must pass through, got %q", got)
	}
	long := strings.Repeat("x", 600)
	got := truncateIngestError(long)
	if len([]rune(got)) != 501 || !strings.HasSuffix(got, "…") {
		t.Fatalf("long message must truncate to 500 runes + ellipsis, got %d runes", len([]rune(got)))
	}
	// Multibyte runes straddling the cut must survive as valid UTF-8.
	multi := strings.Repeat("é", 499) + "日本語テスト"
	got = truncateIngestError(multi)
	if !utf8.ValidString(got) {
		t.Fatalf("truncated message must be valid UTF-8, got %q", got)
	}
	if len([]rune(got)) != 501 {
		t.Fatalf("expected 501 runes, got %d", len([]rune(got)))
	}
	exact := strings.Repeat("y", 500)
	if got := truncateIngestError(exact); got != exact {
		t.Fatalf("exactly-500 message must pass through untouched")
	}
}
