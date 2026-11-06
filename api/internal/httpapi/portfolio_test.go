package httpapi

import (
	"errors"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
)

func TestValidatePortfolioLink(t *testing.T) {
	validReq := "c0000000-0000-0000-0000-000000000001"
	validOut := "a0000000-0000-0000-0000-000000000001"
	badUUID := "not-a-valid-uuid"

	tests := []struct {
		name    string
		input   portfolioLinkInput
		wantErr bool
	}{
		{
			name:    "valid",
			input:   portfolioLinkInput{RequestID: validReq, OutfitID: validOut},
			wantErr: false,
		},
		{
			name:    "missing requestId",
			input:   portfolioLinkInput{OutfitID: validOut},
			wantErr: true,
		},
		{
			name:    "missing outfitId",
			input:   portfolioLinkInput{RequestID: validReq},
			wantErr: true,
		},
		{
			name:    "bad requestId uuid",
			input:   portfolioLinkInput{RequestID: badUUID, OutfitID: validOut},
			wantErr: true,
		},
		{
			name:    "bad outfitId uuid",
			input:   portfolioLinkInput{RequestID: validReq, OutfitID: badUUID},
			wantErr: true,
		},
		{
			name:    "whitespace-only ids",
			input:   portfolioLinkInput{RequestID: "   ", OutfitID: "  "},
			wantErr: true,
		},
		{
			name:    "padded uuids trimmed",
			input:   portfolioLinkInput{RequestID: "  " + validReq + " ", OutfitID: validOut + "  "},
			wantErr: false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			cleaned, err := validatePortfolioLink(tc.input)
			if (err != nil) != tc.wantErr {
				t.Fatalf("validatePortfolioLink() error = %v, wantErr = %v", err, tc.wantErr)
			}
			if !tc.wantErr {
				if cleaned.RequestID != strings.TrimSpace(tc.input.RequestID) {
					t.Errorf("got requestId %q, want trimmed input", cleaned.RequestID)
				}
				if cleaned.OutfitID != strings.TrimSpace(tc.input.OutfitID) {
					t.Errorf("got outfitId %q, want trimmed input", cleaned.OutfitID)
				}
			}
		})
	}
}

func TestPortfolioConflictMessage(t *testing.T) {
	tests := []struct {
		name    string
		err     error
		wantMsg string
		wantOK  bool
	}{
		{
			name: "request race",
			err: &pgconn.PgError{
				Code:           "23505",
				ConstraintName: "maker_portfolio_request_id_key",
			},
			wantMsg: "request already showcased",
			wantOK:  true,
		},
		{
			name: "outfit reuse",
			err: &pgconn.PgError{
				Code:           "23505",
				ConstraintName: "maker_portfolio_maker_id_outfit_id_key",
			},
			wantMsg: "outfit already showcased",
			wantOK:  true,
		},
		{
			name:    "non-unique pg error falls through",
			err:     &pgconn.PgError{Code: "40001"},
			wantMsg: "",
			wantOK:  false,
		},
		{
			name:    "non-pg error falls through",
			err:     errors.New("boom"),
			wantMsg: "",
			wantOK:  false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			msg, ok := portfolioConflictMessage(tc.err)
			if ok != tc.wantOK || msg != tc.wantMsg {
				t.Fatalf("portfolioConflictMessage() = (%q, %v), want (%q, %v)", msg, ok, tc.wantMsg, tc.wantOK)
			}
		})
	}
}
