package ai

import (
	"encoding/json"
	"fmt"
	"math"
	"strings"
)

// Price-estimate parsing shared by the MCP server and the ingest worker.
//
// HONESTY GATE (hard requirement): OoTD has no price catalog and no brand
// data, so callers must never present these numbers as market prices. The
// model returns a WIDE integer range; anything absurd (missing, non-integer,
// non-positive, min>max, over MaxEstimateIDR) is rejected — never clamped
// into a fake-looking number.

// MaxEstimateIDR rejects absurd model output (Rp1 miliar for one garment).
// Rejection beats clamping: clamping fabricates precision.
const MaxEstimateIDR = 1_000_000_000

// EstimateNote labels every estimate as an AI guess, never a market price.
// Shared by the MCP server and the ingest worker so the wording cannot drift.
const EstimateNote = "Estimasi AI, bukan harga pasar aktual"

// EstimateRange is a validated model price range in whole IDR.
type EstimateRange struct {
	MinIDR int64
	MaxIDR int64
}

// ParseEstimate decodes the model's {"min_idr":N,"max_idr":M} JSON and
// enforces the honesty gate. Pure: unit-testable with fixtures, no AI.
func ParseEstimate(raw string) (EstimateRange, error) {
	var v struct {
		Min *float64 `json:"min_idr"`
		Max *float64 `json:"max_idr"`
	}
	if err := json.Unmarshal([]byte(stripEstimateFences(raw)), &v); err != nil {
		return EstimateRange{}, fmt.Errorf("ai returned invalid JSON")
	}
	if v.Min == nil || v.Max == nil {
		return EstimateRange{}, fmt.Errorf("ai returned invalid price range")
	}
	min, max := *v.Min, *v.Max
	if math.IsNaN(min) || math.IsNaN(max) ||
		min != math.Trunc(min) || max != math.Trunc(max) ||
		min < 1 || max < 1 || min > max || max > MaxEstimateIDR {
		return EstimateRange{}, fmt.Errorf("ai returned invalid price range")
	}
	return EstimateRange{MinIDR: int64(min), MaxIDR: int64(max)}, nil
}

func stripEstimateFences(s string) string {
	s = strings.TrimSpace(s)
	s = strings.TrimPrefix(s, "```json")
	s = strings.TrimPrefix(s, "```")
	s = strings.TrimSuffix(s, "```")
	return strings.TrimSpace(s)
}
