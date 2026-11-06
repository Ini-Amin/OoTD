package httpapi

import (
	"encoding/json"
	"strings"
	"testing"
	"time"
)

func TestVerifyIngestSignatureRoundtrip(t *testing.T) {
	secret := "test-secret"
	body := []byte(`{"platform":"instagram","external_id":"m1"}`)
	now := time.Now()
	header := signIngestBody(secret, body, now)
	if err := verifyIngestSignature(secret, body, header, now); err != nil {
		t.Fatalf("valid signature rejected: %v", err)
	}
}

func TestVerifyIngestSignatureRejects(t *testing.T) {
	secret := "test-secret"
	body := []byte(`{"platform":"instagram","external_id":"m1"}`)
	now := time.Now()
	valid := signIngestBody(secret, body, now)
	cases := map[string]struct {
		secret string
		body   []byte
		header string
		now    time.Time
	}{
		"wrong secret":  {secret: "other", body: body, header: valid, now: now},
		"tampered body": {secret: secret, body: []byte(`{"platform":"instagram","external_id":"m2"}`), header: valid, now: now},
		"empty header":  {secret: secret, body: body, header: "", now: now},
		"bad format":    {secret: secret, body: body, header: "v1=abc", now: now},
		"bad hex":       {secret: secret, body: body, header: "t=123,v1=zzz", now: now},
		"short mac":     {secret: secret, body: body, header: "t=123,v1=abcd", now: now},
		"stale":         {secret: secret, body: body, header: signIngestBody(secret, body, now.Add(-10*time.Minute)), now: now},
		"future":        {secret: secret, body: body, header: signIngestBody(secret, body, now.Add(10*time.Minute)), now: now},
		"bad timestamp": {secret: secret, body: body, header: "t=soon,v1=" + strings.Repeat("ab", 32), now: now},
	}
	for name, c := range cases {
		if err := verifyIngestSignature(c.secret, c.body, c.header, c.now); err == nil {
			t.Fatalf("%s: expected rejection", name)
		}
	}
}

func TestVerifyIngestSignatureSkewBoundary(t *testing.T) {
	secret := "s"
	body := []byte(`{}`)
	now := time.Now()
	edge := signIngestBody(secret, body, now.Add(-ingestClockSkew))
	if err := verifyIngestSignature(secret, body, edge, now); err != nil {
		t.Fatalf("skew edge must pass: %v", err)
	}
}

func TestValidateIngestMention(t *testing.T) {
	full := ingestMentionInput{
		Platform: "instagram", ExternalID: "m-123", AuthorHandle: "@brand",
		ImageURL: "https://cdn.test/a.jpg", Caption: "nice fit",
		OccurredAt: "2026-11-06T10:00:00Z",
	}
	clean, err := validateIngestMention(full)
	if err != nil {
		t.Fatalf("full payload rejected: %v", err)
	}
	if clean.Platform != "instagram" || clean.OccurredAt == nil {
		t.Fatalf("fields lost: %+v", clean)
	}
	minimal := ingestMentionInput{Platform: "x", ExternalID: "e1", ImageURL: "http://cdn.test/a.jpg"}
	if _, err := validateIngestMention(minimal); err != nil {
		t.Fatalf("minimal payload rejected: %v", err)
	}
	bad := []ingestMentionInput{
		{ExternalID: "e1", ImageURL: "https://cdn.test/a.jpg"},                                    // no platform
		{Platform: strings.Repeat("p", 33), ExternalID: "e1", ImageURL: "https://cdn.test/a.jpg"}, // platform long
		{Platform: "x", ImageURL: "https://cdn.test/a.jpg"},                                       // no external_id
		{Platform: "x", ExternalID: "e1"},                                                         // no image
		{Platform: "x", ExternalID: "e1", ImageURL: "ftp://cdn.test/a.jpg"},                       // bad scheme
		{Platform: "x", ExternalID: "e1", ImageURL: "https://cdn.test/a.jpg", Caption: strings.Repeat("c", 2001)},
		{Platform: "x", ExternalID: "e1", ImageURL: "https://cdn.test/a.jpg", OccurredAt: "kemarin"},
		{Platform: "x", ExternalID: "e1", ImageURL: "https://cdn.test/a.jpg", AuthorHandle: strings.Repeat("h", 81)},
	}
	for i, in := range bad {
		if _, err := validateIngestMention(in); err == nil {
			t.Fatalf("case %d (%+v): expected rejection", i, in)
		}
	}
}

func TestIngestInputRejectsUnknownFields(t *testing.T) {
	dec := json.NewDecoder(strings.NewReader(`{"platform":"x","external_id":"e","image_url":"https://c/a.jpg","admin":true}`))
	dec.DisallowUnknownFields()
	var in ingestMentionInput
	if err := dec.Decode(&in); err == nil {
		t.Fatal("unknown field should be rejected")
	}
}

func TestIngestStatusesAllowlist(t *testing.T) {
	for _, s := range []string{"queued", "processing", "done", "failed"} {
		if !ingestStatuses[s] {
			t.Fatalf("status %q must be allowed", s)
		}
	}
	if ingestStatuses["open"] {
		t.Fatal("status open must not be allowed")
	}
}
