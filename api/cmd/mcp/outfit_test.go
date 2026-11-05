package main

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestNormalizeImageURL(t *testing.T) {
	ok, err := normalizeImageURL("https://images.unsplash.com/x.jpg")
	if err != nil || ok != "https://images.unsplash.com/x.jpg" {
		t.Fatalf("expected ok, got %q %v", ok, err)
	}
	for _, bad := range []string{"", "ftp://x/y", "not a url", "/relative/path", "javascript:alert(1)"} {
		if _, err := normalizeImageURL(bad); err == nil {
			t.Fatalf("expected error for %q", bad)
		}
	}
}

func TestNormalizeMaxPieces(t *testing.T) {
	n, err := normalizeMaxPieces(nil)
	if err != nil || n != defaultMaxPieces {
		t.Fatalf("expected default %d, got %d %v", defaultMaxPieces, n, err)
	}
	zero, over := 0, maxPiecesHardLimit+1
	for _, p := range []*int{&zero, &over} {
		if _, err := normalizeMaxPieces(p); err == nil {
			t.Fatalf("expected error for %d", *p)
		}
	}
	three := 3
	if n, err := normalizeMaxPieces(&three); err != nil || n != 3 {
		t.Fatalf("expected 3, got %d %v", n, err)
	}
}

func TestParsePiecesSanitizeAndLimit(t *testing.T) {
	raw := "```json\n" + `{"pieces":[
		{"category":"top","label":" Oversized white poplin shirt ","box":{"x":0.1,"y":0.1,"w":0.5,"h":0.4}},
		{"category":"spaceship","label":"UFO"},
		{"category":"shoes","label":"Sneakers","box":{"x":0.8,"y":0.8,"w":0.5,"h":0.5}},
		{"category":"bag","label":""},
		{"category":"hat","label":"Black bucket hat"}
	]}` + "\n```"
	out, err := parsePieces(raw, 8)
	if err != nil {
		t.Fatal(err)
	}
	if len(out) != 2 {
		t.Fatalf("expected 2 pieces, got %+v", out)
	}
	if out[0].Category != "top" || out[0].Label != "Oversized white poplin shirt" {
		t.Fatalf("unexpected first piece: %+v", out[0])
	}
	if out[0].Price != nil {
		t.Fatalf("price must be null, got %v", *out[0].Price)
	}
	// Serialized output must carry explicit null price + note field shape.
	enc, _ := json.Marshal(outfitOutput{Pieces: out, PriceNote: priceNote})
	if !strings.Contains(string(enc), `"price":null`) {
		t.Fatalf("missing null price: %s", enc)
	}

	limited, err := parsePieces(raw, 1)
	if err != nil || len(limited) != 1 {
		t.Fatalf("expected 1 piece, got %+v %v", limited, err)
	}
}

func TestParsePiecesNotOutfit(t *testing.T) {
	if _, err := parsePieces(`{"error":"not_an_outfit"}`, 8); err == nil {
		t.Fatal("expected not-an-outfit error")
	}
	if _, err := parsePieces(`{oops`, 8); err == nil {
		t.Fatal("expected invalid-JSON error")
	}
}

func TestHandleToolCallUnknownTool(t *testing.T) {
	resp := handleMessage(nil, []byte(`{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"nope","arguments":{}}}`))
	if resp == nil || resp.Error == nil {
		t.Fatalf("expected error, got %+v", resp)
	}
}

func TestHandleToolCallBadURL(t *testing.T) {
	resp := handleMessage(nil, []byte(`{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"identify_outfit","arguments":{"image_url":"ftp://x"}}}`))
	if resp == nil || resp.Error != nil {
		t.Fatalf("expected tool isError result, got %+v", resp)
	}
	res, ok := resp.Result.(callResult)
	if !ok || !res.IsError {
		t.Fatalf("expected isError result, got %+v", resp.Result)
	}
}
