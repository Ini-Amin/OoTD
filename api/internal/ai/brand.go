package ai

import "strings"

// MaxBrandLen caps model-returned brand names, mirroring the 80-char label cap.
const MaxBrandLen = 80

// SanitizeBrand normalizes a model-returned brand name to an honest value:
// trimmed, at most MaxBrandLen chars, else nil. Empty, overlong, or missing
// brands become nil — the "no visible logo" default from MagicTagSystemPrompt.
// Pure: shared by the MCP server and the ingest worker so both apply one rule.
func SanitizeBrand(brand *string) *string {
	if brand == nil {
		return nil
	}
	b := strings.TrimSpace(*brand)
	if b == "" || len(b) > MaxBrandLen {
		return nil
	}
	return &b
}
