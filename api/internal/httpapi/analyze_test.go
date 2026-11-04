package httpapi

import "testing"

func TestSanitizePieces(t *testing.T) {
	in := []magicPiece{
		{Category: "top", Label: "White poplin shirt", Box: struct {
			X float64 `json:"x"`
			Y float64 `json:"y"`
			W float64 `json:"w"`
			H float64 `json:"h"`
		}{X: 0.1, Y: 0.1, W: 0.5, H: 0.4}},
		{Category: "spaceship", Label: "UFO", Box: struct {
			X float64 `json:"x"`
			Y float64 `json:"y"`
			W float64 `json:"w"`
			H float64 `json:"h"`
		}{X: 0.1, Y: 0.1, W: 0.5, H: 0.4}}, // bad category
		{Category: "shoes", Label: "Sneakers", Box: struct {
			X float64 `json:"x"`
			Y float64 `json:"y"`
			W float64 `json:"w"`
			H float64 `json:"h"`
		}{X: 0.8, Y: 0.8, W: 0.5, H: 0.5}}, // box overflows
		{Category: "bag", Label: "", Box: struct {
			X float64 `json:"x"`
			Y float64 `json:"y"`
			W float64 `json:"w"`
			H float64 `json:"h"`
		}{X: 0.1, Y: 0.1, W: 0.2, H: 0.2}}, // empty label
	}
	out := sanitizePieces(in)
	if len(out) != 1 {
		t.Fatalf("expected 1 valid piece, got %d", len(out))
	}
	if out[0].Category != "top" || out[0].Label != "White poplin shirt" {
		t.Fatalf("unexpected piece kept: %+v", out[0])
	}
}

func TestLimitStrings(t *testing.T) {
	in := []string{"a", "b", "a", " ", "c", "d"}
	out := limitStrings(in, 3)
	if len(out) != 3 || out[0] != "a" || out[1] != "b" || out[2] != "c" {
		t.Fatalf("unexpected: %v", out)
	}
}

func TestStripCodeFences(t *testing.T) {
	in := "```json\n{\"a\":1}\n```"
	if got := stripCodeFences(in); got != `{"a":1}` {
		t.Fatalf("unexpected: %q", got)
	}
}
