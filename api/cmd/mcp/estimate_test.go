package main

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/ootd/ootd-api/internal/ai"
)

func TestParseEstimateOK(t *testing.T) {
	out, err := parseEstimate(`{"min_idr": 50000, "max_idr": 150000}`)
	if err != nil {
		t.Fatal(err)
	}
	if out.MinIDR != 50000 || out.MaxIDR != 150000 {
		t.Fatalf("unexpected range: %+v", out)
	}
	if out.Currency != "IDR" || out.Confidence != "low" || out.Note != estimateNote {
		t.Fatalf("missing honesty wrapper: %+v", out)
	}
	enc, _ := json.Marshal(out)
	for _, want := range []string{`"currency":"IDR"`, `"confidence":"low"`, `"note":"Estimasi AI, bukan harga pasar aktual"`} {
		if !strings.Contains(string(enc), want) {
			t.Fatalf("missing %s in %s", want, enc)
		}
	}
}

func TestParseEstimateStripsCodeFences(t *testing.T) {
	out, err := parseEstimate("```json\n{\"min_idr\": 10000, \"max_idr\": 20000}\n```")
	if err != nil {
		t.Fatal(err)
	}
	if out.MinIDR != 10000 || out.MaxIDR != 20000 {
		t.Fatalf("unexpected range: %+v", out)
	}
}

func TestParseEstimateRejectsAbsurd(t *testing.T) {
	bad := []string{
		`{oops`,                                 // invalid JSON
		`{"pieces":[]}`,                         // missing fields
		`{"min_idr": 50000}`,                    // missing max
		`{"min_idr": 0, "max_idr": 100}`,        // zero min
		`{"min_idr": -5, "max_idr": 100}`,       // negative
		`{"min_idr": 200, "max_idr": 100}`,      // min > max
		`{"min_idr": 50.5, "max_idr": 100}`,     // non-integer
		`{"min_idr": "murah", "max_idr": 100}`,  // wrong type
		`{"min_idr": 1, "max_idr": 1000000001}`, // over 1e9
		`{"min_idr": null, "max_idr": null}`,
	}
	for _, raw := range bad {
		if _, err := parseEstimate(raw); err == nil {
			t.Fatalf("expected rejection for %q", raw)
		}
	}
}

func TestParseEstimateBoundaryOK(t *testing.T) {
	out, err := parseEstimate(`{"min_idr": 1, "max_idr": 1000000000}`)
	if err != nil {
		t.Fatal(err)
	}
	if out.MinIDR != 1 || out.MaxIDR != 1000000000 {
		t.Fatalf("unexpected range: %+v", out)
	}
	equal, err := parseEstimate(`{"min_idr": 75000, "max_idr": 75000}`)
	if err != nil || equal.MinIDR != 75000 {
		t.Fatalf("min==max must be allowed, got %+v %v", equal, err)
	}
}

func TestNormalizeEstimateArgs(t *testing.T) {
	label, cat, cond, err := normalizeEstimateArgs(estimateArguments{Label: "  Kemeja putih  "})
	if err != nil || label != "Kemeja putih" || cat != "" || cond != "new" {
		t.Fatalf("unexpected defaults: %q %q %q %v", label, cat, cond, err)
	}
	if _, _, _, err := normalizeEstimateArgs(estimateArguments{Label: ""}); err == nil {
		t.Fatal("expected error for empty label")
	}
	if _, _, _, err := normalizeEstimateArgs(estimateArguments{Label: strings.Repeat("x", 81)}); err == nil {
		t.Fatal("expected error for 81-char label")
	}
	if _, _, _, err := normalizeEstimateArgs(estimateArguments{Label: "Topi", Category: "spaceship"}); err == nil {
		t.Fatal("expected error for bad category")
	}
	if _, _, _, err := normalizeEstimateArgs(estimateArguments{Label: "Topi", Condition: "bekas"}); err == nil {
		t.Fatal("expected error for bad condition")
	}
	if _, _, cond, err := normalizeEstimateArgs(estimateArguments{Label: "Topi", Condition: "thrift"}); err != nil || cond != "thrift" {
		t.Fatalf("expected thrift, got %q %v", cond, err)
	}
}

func TestHandleEstimateCallMissingLabel(t *testing.T) {
	resp := handleMessage(nil, []byte(`{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"estimate_price","arguments":{}}}`))
	if resp == nil || resp.Error != nil {
		t.Fatalf("expected tool isError result, got %+v", resp)
	}
	res, ok := resp.Result.(callResult)
	if !ok || !res.IsError {
		t.Fatalf("expected isError result, got %+v", resp.Result)
	}
}

func TestHandleEstimateCallAINotConfigured(t *testing.T) {
	resp := handleMessage(nil, []byte(`{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"estimate_price","arguments":{"label":"Kemeja"}}}`))
	if resp == nil || resp.Error != nil {
		t.Fatalf("expected tool isError result, got %+v", resp)
	}
	res := resp.Result.(callResult)
	if !res.IsError || !strings.Contains(res.Content[0].Text, "ai not configured") {
		t.Fatalf("expected ai-not-configured, got %+v", res)
	}
}

func TestToolsListHasBothTools(t *testing.T) {
	resp := handleMessage(nil, []byte(`{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}`))
	if resp == nil || resp.Error != nil {
		t.Fatalf("expected result, got %+v", resp)
	}
	enc, _ := json.Marshal(resp.Result)
	s := string(enc)
	if !strings.Contains(s, `"name":"identify_outfit"`) || !strings.Contains(s, `"name":"estimate_price"`) {
		t.Fatalf("expected both tools, got %s", s)
	}
}

func TestBuildPieceLinksEscaping(t *testing.T) {
	for _, label := range []string{
		"Oversized white poplin shirt",
		"Kemeja & celana \"levis\" <test>",
		"Kaos anak-anak 100% katun?",
		"Hijab sifonstek—premium ✓",
		"日本語のシャツ 👕",
	} {
		links := buildPieceLinks(label)
		got := []string{links.TokopediaSearch, links.ShopeeSearch, links.GoogleShopping}
		for _, u := range got {
			parsed, err := url.Parse(u)
			if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" {
				t.Fatalf("invalid URL for %q: %q (%v)", label, u, err)
			}
			if parsed.RawQuery == "" {
				t.Fatalf("missing query for %q: %q", label, u)
			}
		}
		if !strings.HasPrefix(links.TokopediaSearch, "https://www.tokopedia.com/search?q=") {
			t.Fatalf("bad tokopedia URL: %q", links.TokopediaSearch)
		}
		if !strings.HasPrefix(links.ShopeeSearch, "https://shopee.co.id/search?keyword=") {
			t.Fatalf("bad shopee URL: %q", links.ShopeeSearch)
		}
		if !strings.HasPrefix(links.GoogleShopping, "https://www.google.com/search?tbm=shop&q=") {
			t.Fatalf("bad google URL: %q", links.GoogleShopping)
		}
		// Round-trip: the query must decode back to the original label.
		q, _ := url.ParseQuery(strings.SplitN(links.TokopediaSearch, "?", 2)[1])
		if q.Get("q") != label {
			t.Fatalf("query round-trip failed: %q != %q", q.Get("q"), label)
		}
	}
}

func TestEstimateOutputSourcesMarshal(t *testing.T) {
	withSources := estimateOutput{
		MinIDR: 50000, MaxIDR: 150000, Currency: "IDR", Confidence: "low", Note: estimateNote,
		Sources: pieceSources(buildPieceLinks("Kemeja putih")),
	}
	enc, _ := json.Marshal(withSources)
	if !strings.Contains(string(enc), `"sources":[{"label":"Tokopedia"`) {
		t.Fatalf("top-level estimate must carry labeled sources: %s", enc)
	}
	nested := estimateOutput{
		MinIDR: 50000, MaxIDR: 150000, Currency: "IDR", Confidence: "low", Note: estimateNote,
	}
	encNested, _ := json.Marshal(nested)
	if strings.Contains(string(encNested), `"sources"`) {
		t.Fatalf("nested price_estimate omits sources (outer piece already has them): %s", encNested)
	}
}

// stubAIClient serves canned vision/chat replies keyed by request model and
// returns a client configured from test env. No network beyond localhost.
func stubAIClient(t *testing.T, visionContent, chatContent string) *ai.Client {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Model string `json:"model"`
		}
		body, _ := io.ReadAll(io.LimitReader(r.Body, 1<<20))
		_ = json.Unmarshal(body, &req)
		content := chatContent
		if req.Model == "vision-model" {
			content = visionContent
		}
		w.Header().Set("Content-Type", "application/json")
		resp, _ := json.Marshal(map[string]any{
			"choices": []any{map[string]any{"message": map[string]any{"content": content}}},
		})
		_, _ = w.Write(resp)
	}))
	t.Cleanup(srv.Close)
	t.Setenv("AI_BASE_URL", srv.URL)
	t.Setenv("AI_API_KEY", "test-key")
	t.Setenv("AI_VISION_MODEL", "vision-model")
	t.Setenv("AI_CHAT_MODEL", "chat-model")
	c := ai.NewClientFromEnv()
	if c == nil {
		t.Fatal("expected configured client")
	}
	return c
}

func toolText(t *testing.T, resp *rpcResponse) string {
	t.Helper()
	if resp == nil || resp.Error != nil {
		t.Fatalf("expected tool result, got %+v", resp)
	}
	res, ok := resp.Result.(callResult)
	if !ok || res.IsError {
		t.Fatalf("expected success result, got %+v", resp.Result)
	}
	return res.Content[0].Text
}

func TestHandleEstimateCallReturnsSources(t *testing.T) {
	c := stubAIClient(t, "", `{"min_idr": 50000, "max_idr": 150000}`)
	id := json.RawMessage(`1`)
	resp := handleEstimateCall(c, &id, json.RawMessage(`{"label":"Kemeja putih"}`))
	text := toolText(t, resp)
	for _, want := range []string{`"min_idr":50000`, `"confidence":"low"`, `"sources":[{"label":"Tokopedia"`} {
		if !strings.Contains(text, want) {
			t.Fatalf("missing %s in %s", want, text)
		}
	}
}

func TestHandleIdentifyCallEnrichesEstimatesWhenRequested(t *testing.T) {
	vision := `{"pieces":[{"category":"top","label":"White shirt","brand":"Uniqlo"}]}`
	c := stubAIClient(t, vision, `{"min_idr": 50000, "max_idr": 150000}`)
	resp := handleMessage(c, []byte(`{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"identify_outfit","arguments":{"image_url":"https://x.test/a.jpg","include_price_estimate":true,"condition":"thrift"}}}`))
	text := toolText(t, resp)
	for _, want := range []string{`"brand":"Uniqlo"`, `"price_estimate":{"min_idr":50000`, `"sources":[`} {
		if !strings.Contains(text, want) {
			t.Fatalf("missing %s in %s", want, text)
		}
	}
}

func TestHandleIdentifyCallSkipsEstimatesByDefault(t *testing.T) {
	vision := `{"pieces":[{"category":"top","label":"White shirt"}]}`
	c := stubAIClient(t, vision, `{"min_idr": 50000, "max_idr": 150000}`)
	resp := handleMessage(c, []byte(`{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"identify_outfit","arguments":{"image_url":"https://x.test/a.jpg"}}}`))
	text := toolText(t, resp)
	if !strings.Contains(text, `"price_estimate":null`) {
		t.Fatalf("default call must leave price_estimate null: %s", text)
	}
}

func TestParsePiecesIncludesLinks(t *testing.T) {
	out, err := parsePieces(`{"pieces":[{"category":"top","label":"White shirt"}]}`, 8)
	if err != nil || len(out) != 1 {
		t.Fatalf("expected 1 piece, got %+v %v", out, err)
	}
	if out[0].Links.TokopediaSearch == "" || out[0].Links.ShopeeSearch == "" || out[0].Links.GoogleShopping == "" {
		t.Fatalf("missing links: %+v", out[0].Links)
	}
	enc, _ := json.Marshal(outfitOutput{Pieces: out, PriceNote: priceNote})
	if !strings.Contains(string(enc), `"links":{`) {
		t.Fatalf("missing links object: %s", enc)
	}
}
