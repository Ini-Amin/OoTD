package main

import (
	"encoding/json"
	"fmt"
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
	// estimateNote aliases the shared ai.EstimateNote so MCP and ingest
	// snapshots label estimates identically.
	estimateNote = ai.EstimateNote
)

var estimateConditions = map[string]bool{"new": true, "thrift": true}

type estimateArguments struct {
	Label     string `json:"label"`
	Category  string `json:"category"`
	Condition string `json:"condition"`
}

// estimateOutput is the wrapped honesty shape: a range plus explicit
// low-confidence labelling. Sources are marketplace SEARCH URLs (not shops
// or listings); never add brand fields here.
type estimateOutput struct {
	MinIDR     int64         `json:"min_idr"`
	MaxIDR     int64         `json:"max_idr"`
	Currency   string        `json:"currency"`
	Confidence string        `json:"confidence"`
	Note       string        `json:"note"`
	Sources    []pieceSource `json:"sources,omitempty"`
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
	out.Sources = pieceSources(buildPieceLinks(label))
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

// parseEstimate validates the model's {"min_idr":N,"max_idr":M} JSON via the
// shared ai.ParseEstimate honesty gate and wraps it for MCP output.
// Pure: unit-testable with fixtures, no AI.
func parseEstimate(raw string) (estimateOutput, error) {
	r, err := ai.ParseEstimate(raw)
	if err != nil {
		return estimateOutput{}, err
	}
	return estimateOutput{
		MinIDR:     r.MinIDR,
		MaxIDR:     r.MaxIDR,
		Currency:   "IDR",
		Confidence: "low",
		Note:       estimateNote,
	}, nil
}
