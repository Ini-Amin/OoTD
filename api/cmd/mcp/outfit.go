package main

import (
	"encoding/json"
	"fmt"
	"net/url"
	"strings"

	"github.com/ootd/ootd-api/internal/ai"
)

// Tool surface: a single identify_outfit tool reusing internal/ai.

const (
	toolName           = "identify_outfit"
	defaultMaxPieces   = 8
	maxPiecesHardLimit = 20
)

// pieceCategories mirrors internal/httpapi/analyze.go so MCP output passes
// the same category allowlist as POST /v1/analyze.
var pieceCategories = map[string]bool{
	"hat": true, "top": true, "bottom": true,
	"shoes": true, "bag": true, "accessory": true,
}

type toolArguments struct {
	ImageURL  string `json:"image_url"`
	MaxPieces *int   `json:"max_pieces"`
}

// aiMagicResult mirrors the subset of the Magic Tag JSON we consume.
// (Box is validated for filtering but not echoed back to MCP clients.)
type aiMagicResult struct {
	Pieces []aiMagicPiece `json:"pieces"`
	Error  string         `json:"error"`
}

type aiMagicPiece struct {
	Category string `json:"category"`
	Label    string `json:"label"`
	Box      *struct {
		X float64 `json:"x"`
		Y float64 `json:"y"`
		W float64 `json:"w"`
		H float64 `json:"h"`
	} `json:"box"`
}

// outfitPiece is the honest MCP output shape. There is NO price data in
// this repo, so Price is always null — never invent a number or a brand.
type outfitPiece struct {
	Category    string   `json:"category"`
	Label       string   `json:"label"`
	Description string   `json:"description"`
	Price       *float64 `json:"price"`
}

type outfitOutput struct {
	Pieces    []outfitPiece `json:"pieces"`
	PriceNote string        `json:"price_note"`
}

const priceNote = "OoTD has no price catalog: every piece reports price null. " +
	"Connect a product/affiliate catalog to enable pricing."

func identifyInputSchema() any {
	return map[string]any{
		"type": "object",
		"properties": map[string]any{
			"image_url": map[string]any{
				"type":        "string",
				"format":      "uri",
				"description": "Public http(s) URL of the outfit photo to identify.",
			},
			"max_pieces": map[string]any{
				"type":        "integer",
				"default":     defaultMaxPieces,
				"minimum":     1,
				"maximum":     maxPiecesHardLimit,
				"description": "Maximum pieces to return (default 8).",
			},
		},
		"required":             []string{"image_url"},
		"additionalProperties": false,
	}
}

func handleMessage(client *ai.Client, msg []byte) *rpcResponse {
	var req rpcRequest
	if err := json.Unmarshal(msg, &req); err != nil {
		return newErrorResponse(nil, -32700, "parse error")
	}
	if req.JSONRPC != "2.0" || req.Method == "" {
		return newErrorResponse(req.ID, -32600, "invalid request")
	}
	if req.ID == nil {
		return nil // notification (e.g. notifications/initialized): ignore
	}
	switch req.Method {
	case "initialize":
		return &rpcResponse{JSONRPC: "2.0", ID: req.ID, Result: initializeResult{
			ProtocolVersion: protocolVersion,
			Capabilities:    map[string]any{"tools": map[string]any{}},
			ServerInfo:      serverInfo{Name: "ootd-identify-outfit", Version: "0.1.0"},
		}}
	case "tools/list":
		return &rpcResponse{JSONRPC: "2.0", ID: req.ID, Result: map[string]any{
			"tools": []mcpTool{{
				Name:        toolName,
				Description: "Identify garments in an outfit photo. Returns category/label/description per piece; price is always null (no catalog).",
				InputSchema: identifyInputSchema(),
			}},
		}}
	case "tools/call":
		return handleToolCall(client, req.ID, req.Params)
	default:
		return newErrorResponse(req.ID, -32601, "method not found: "+req.Method)
	}
}

func handleToolCall(client *ai.Client, id *json.RawMessage, params json.RawMessage) *rpcResponse {
	var call struct {
		Name      string          `json:"name"`
		Arguments json.RawMessage `json:"arguments"`
	}
	if err := json.Unmarshal(params, &call); err != nil {
		return newErrorResponse(id, -32602, "invalid params")
	}
	if call.Name != toolName {
		return newErrorResponse(id, -32602, "unknown tool: "+call.Name)
	}
	var args toolArguments
	dec := json.NewDecoder(strings.NewReader(string(call.Arguments)))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&args); err != nil {
		return toolError(id, "arguments must be {image_url, max_pieces?}: "+compactErr(err))
	}
	imgURL, err := normalizeImageURL(args.ImageURL)
	if err != nil {
		return toolError(id, err.Error())
	}
	maxPieces, err := normalizeMaxPieces(args.MaxPieces)
	if err != nil {
		return toolError(id, err.Error())
	}
	if client == nil {
		return toolError(id, "ai not configured: set AI_BASE_URL/AI_API_KEY/AI_VISION_MODEL")
	}
	raw, err := client.AnalyzeOutfit(imgURL)
	if err != nil {
		return toolError(id, "ai request failed: "+compactErr(err))
	}
	pieces, err := parsePieces(raw, maxPieces)
	if err != nil {
		return toolError(id, err.Error())
	}
	text, err := json.Marshal(outfitOutput{Pieces: pieces, PriceNote: priceNote})
	if err != nil {
		return toolError(id, "encode output: "+compactErr(err))
	}
	return &rpcResponse{JSONRPC: "2.0", ID: id, Result: callResult{
		Content: []contentText{{Type: "text", Text: string(text)}},
	}}
}

func toolError(id *json.RawMessage, msg string) *rpcResponse {
	return &rpcResponse{JSONRPC: "2.0", ID: id, Result: callResult{
		Content: []contentText{{Type: "text", Text: msg}},
		IsError: true,
	}}
}

// normalizeImageURL applies the same rule as POST /v1/analyze:
// the URL must be absolute http(s).
func normalizeImageURL(s string) (string, error) {
	u, err := url.ParseRequestURI(strings.TrimSpace(s))
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") {
		return "", fmt.Errorf("image_url must be a valid http(s) URL")
	}
	return u.String(), nil
}

func normalizeMaxPieces(p *int) (int, error) {
	if p == nil {
		return defaultMaxPieces, nil
	}
	if *p < 1 || *p > maxPiecesHardLimit {
		return 0, fmt.Errorf("max_pieces must be 1-%d", maxPiecesHardLimit)
	}
	return *p, nil
}

// parsePieces decodes the Magic Tag JSON, applies the same sanitize rules
// as POST /v1/analyze (category allowlist, label trim/max 80, box bounds),
// and maps to the honest MCP output shape. Pure: unit-testable.
func parsePieces(raw string, maxPieces int) ([]outfitPiece, error) {
	cleaned := stripCodeFences(raw)
	var res aiMagicResult
	if err := json.Unmarshal([]byte(cleaned), &res); err != nil {
		return nil, fmt.Errorf("ai returned invalid JSON")
	}
	if res.Error != "" {
		return nil, fmt.Errorf("photo does not look like an outfit")
	}
	out := make([]outfitPiece, 0, len(res.Pieces))
	for _, p := range res.Pieces {
		if !pieceCategories[p.Category] {
			continue
		}
		label := strings.TrimSpace(p.Label)
		if label == "" || len(label) > 80 {
			continue
		}
		if p.Box != nil {
			b := p.Box
			if b.X < 0 || b.X > 1 || b.Y < 0 || b.Y > 1 ||
				b.W <= 0 || b.W > 1 || b.H <= 0 || b.H > 1 ||
				b.X+b.W > 1 || b.Y+b.H > 1 {
				continue
			}
		}
		out = append(out, outfitPiece{
			Category:    p.Category,
			Label:       label,
			Description: label,
			Price:       nil,
		})
		if len(out) >= maxPieces {
			break
		}
	}
	if out == nil {
		out = []outfitPiece{}
	}
	return out, nil
}

func stripCodeFences(s string) string {
	s = strings.TrimSpace(s)
	s = strings.TrimPrefix(s, "```json")
	s = strings.TrimPrefix(s, "```")
	s = strings.TrimSuffix(s, "```")
	return strings.TrimSpace(s)
}

func compactErr(err error) string {
	s := strings.ReplaceAll(strings.TrimSpace(err.Error()), "\n", " ")
	if len(s) > 300 {
		return s[:300] + "…"
	}
	return s
}
