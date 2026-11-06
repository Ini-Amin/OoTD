package ai

import (
	"testing"
)

func TestParseEstimateOK(t *testing.T) {
	r, err := ParseEstimate(`{"min_idr": 50000, "max_idr": 150000}`)
	if err != nil {
		t.Fatal(err)
	}
	if r.MinIDR != 50000 || r.MaxIDR != 150000 {
		t.Fatalf("unexpected range: %+v", r)
	}
}

func TestParseEstimateStripsCodeFences(t *testing.T) {
	r, err := ParseEstimate("```json\n{\"min_idr\": 10000, \"max_idr\": 20000}\n```")
	if err != nil {
		t.Fatal(err)
	}
	if r.MinIDR != 10000 || r.MaxIDR != 20000 {
		t.Fatalf("unexpected range: %+v", r)
	}
}

func TestParseEstimateRejectsAbsurd(t *testing.T) {
	bad := []string{
		`{oops`,
		`{"pieces":[]}`,
		`{"min_idr": 50000}`,
		`{"min_idr": 0, "max_idr": 100}`,
		`{"min_idr": -5, "max_idr": 100}`,
		`{"min_idr": 200, "max_idr": 100}`,
		`{"min_idr": 50.5, "max_idr": 100}`,
		`{"min_idr": "murah", "max_idr": 100}`,
		`{"min_idr": 1, "max_idr": 1000000001}`,
		`{"min_idr": null, "max_idr": null}`,
	}
	for _, raw := range bad {
		if _, err := ParseEstimate(raw); err == nil {
			t.Fatalf("expected rejection for %q", raw)
		}
	}
}

func TestParseEstimateBoundaryOK(t *testing.T) {
	r, err := ParseEstimate(`{"min_idr": 1, "max_idr": 1000000000}`)
	if err != nil {
		t.Fatal(err)
	}
	if r.MinIDR != 1 || r.MaxIDR != 1000000000 {
		t.Fatalf("unexpected range: %+v", r)
	}
	equal, err := ParseEstimate(`{"min_idr": 75000, "max_idr": 75000}`)
	if err != nil || equal.MinIDR != 75000 {
		t.Fatalf("min==max must be allowed, got %+v %v", equal, err)
	}
}

func strptr(s string) *string { return &s }

func TestSanitizeBrand(t *testing.T) {
	if got := SanitizeBrand(nil); got != nil {
		t.Fatalf("nil must stay nil, got %q", *got)
	}
	if got := SanitizeBrand(strptr("")); got != nil {
		t.Fatal("empty must become nil")
	}
	if got := SanitizeBrand(strptr("   ")); got != nil {
		t.Fatal("blank must become nil")
	}
	long := ""
	for len(long) <= MaxBrandLen {
		long += "abcdefghij"
	}
	if got := SanitizeBrand(strptr(long)); got != nil {
		t.Fatal("overlong must become nil")
	}
	got := SanitizeBrand(strptr("  Uniqlo  "))
	if got == nil || *got != "Uniqlo" {
		t.Fatalf("expected trimmed brand, got %+v", got)
	}
}
