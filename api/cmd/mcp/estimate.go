package main

import (
	"encoding/json"
	"fmt"
	"math"
	"strings"

	"github.com/ootd/ootd-api/internal/ai"
)

// Tool surface, part 2: estimate_price.
//
// HONESTY GATE (hard requirement): OoTD has no price catalog and no brand
// data, so this tool never returns a precise price or a brand. It asks the
// chat model for a WIDE integer range, validates it defensively, and wraps
// it with currency IDR, confidence "low", and an explicit note that the
// numbers are an AI guess, not market prices. Anything absurd from the
// model (missing/non-integer/non-positive/min>max/over 1e9 IDR) is
// rejected as a tool error — never clamped into a fake-looking number.

const (
	estimateToolName = "estimate_price"
	// maxEstimateIDR rejects absurd model output (Rp1 miliar for one
	// garment). Rejection beats clamping: clamping fabricates precision.
	maxEstimateIDR = 1_000_000_000
	estimateNote   = "Estimasi AI, bukan harga pasar aktual"
)

var estimateConditions = map[string]bool{"new": true, "thrift": true}

type estimateArguments struct {
	Label     string `json:"label"`
	Category  string `json:"category"`
	Condition string `json:"condition"`
}

// estimateOutput is the wrapped honesty shape: a range plus explicit
// low-confidence labelling. Never add brand/shop fields here.
type estimateOutput struct {
	MinIDR     int64  `json:"min_idr"`
	MaxIDR     int64  `json:"max_idr"`
	Currency   string `json:"currency"`
	Confidence string `json:"confidence"`
	Note       string `json:"note"`
}

func estimateInputSchema() any {
	return map[string]any{
		"type": "object",
		"properties": map[string]any{
			"label": map[string]any{
				"type":        "string",
				"description": "Garment description, e.g. 'Oversized white poplin shirt'.",
			},
			"category": map[string]any{
				"type":        "string",
				"enum":        []string{"hat", "top", "bottom", "shoes", "bag", "accessory"},
				"description": "Optional OoTD category; must be a valid piece category when given.",
			},
			"condition": map[string]any{
				"type":        "string",
				"enum":        []string{"new", "thrift"},
				"default":     "new",
				"description": "Optional condition; default new.",
			},
		},
		"required":             []string{"label"},
		"additionalProperties": false,
	}
}

func handleEstimateCall(client *ai.Client, id *json.RawMessage, argsRaw json.RawMessage) *rpcResponse {
	var args estimateArguments
	dec := json.NewDecoder(strings.NewReader(string(argsRaw)))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&args); err != nil {
		return toolError(id, "arguments must be {label, category?, condition?}: "+compactErr(err))
	}
	label, category, condition, err := normalizeEstimateArgs(args)
	if err != nil {
		return toolError(id, err.Error())
	}
	if client == nil {
		return toolError(id, "ai not configured: set AI_BASE_URL/AI_API_KEY/AI_CHAT_MODEL")
	}
	raw, err := client.EstimatePrice(label, category, condition)
	if err != nil {
		return toolError(id, "ai request failed: "+compactErr(err))
	}
	out, err := parseEstimate(raw)
	if err != nil {
		return toolError(id, err.Error())
	}
	text, err := json.Marshal(out)
	if err != nil {
		return toolError(id, "encode output: "+compactErr(err))
	}
	return &rpcResponse{JSONRPC: "2.0", ID: id, Result: callResult{
		Content: []contentText{{Type: "text", Text: string(text)}},
	}}
}

// normalizeEstimateArgs trims and validates tool input. Pure: unit-testable.
func normalizeEstimateArgs(a estimateArguments) (label, category, condition string, err error) {
	label = strings.TrimSpace(a.Label)
	if label == "" || len(label) > 80 {
		return "", "", "", fmt.Errorf("label must be 1-80 chars")
	}
	category = strings.TrimSpace(a.Category)
	if category != "" && !pieceCategories[category] {
		return "", "", "", fmt.Errorf("category must be one of: hat, top, bottom, shoes, bag, accessory")
	}
	condition = strings.TrimSpace(a.Condition)
	if condition == "" {
		condition = "new"
	}
	if !estimateConditions[condition] {
		return "", "", "", fmt.Errorf(`condition must be "new" or "thrift"`)
	}
	return label, category, condition, nil
}

// parseEstimate decodes the model's {"min_idr":N,"max_idr":M} JSON and
// enforces the honesty gate. Pure: unit-testable with fixtures, no AI.
func parseEstimate(raw string) (estimateOutput, error) {
	var v struct {
		Min *float64 `json:"min_idr"`
		Max *float64 `json:"max_idr"`
	}
	if err := json.Unmarshal([]byte(stripCodeFences(raw)), &v); err != nil {
		return estimateOutput{}, fmt.Errorf("ai returned invalid JSON")
	}
	if v.Min == nil || v.Max == nil {
		return estimateOutput{}, fmt.Errorf("ai returned invalid price range")
	}
	min, max := *v.Min, *v.Max
	if math.IsNaN(min) || math.IsNaN(max) ||
		min != math.Trunc(min) || max != math.Trunc(max) ||
		min < 1 || max < 1 || min > max || max > maxEstimateIDR {
		return estimateOutput{}, fmt.Errorf("ai returned invalid price range")
	}
	return estimateOutput{
		MinIDR:     int64(min),
		MaxIDR:     int64(max),
		Currency:   "IDR",
		Confidence: "low",
		Note:       estimateNote,
	}, nil
}
