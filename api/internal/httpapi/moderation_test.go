package httpapi

import "testing"

// Port of web/src/lib/chatFilter.test.ts isBlocked cases.
func TestIsBlockedComment(t *testing.T) {
	tests := []struct {
		name    string
		text    string
		blocked bool
	}{
		{name: "indonesian word", text: "anjir", blocked: true},
		{name: "indonesian uppercase", text: "ANJIR parah", blocked: true},
		{name: "indonesian with punctuation", text: "dasar bangsat!", blocked: true},
		{name: "indonesian mixed case", text: "Goblok lu", blocked: true},
		{name: "english word", text: "fuck you", blocked: true},
		{name: "english uppercase", text: "FUCK", blocked: true},
		{name: "english in sentence", text: "shit happens", blocked: true},
		{name: "mild word allowed", text: "what the hell is this", blocked: false},
		{name: "normal chat id", text: "halo semuanya!", blocked: false},
		{name: "normal chat en", text: "hello, where is Zara?", blocked: false},
		{name: "empty", text: "", blocked: false},
		{name: "whitespace", text: "   ", blocked: false},
		{name: "substring belanja passes", text: "belanja", blocked: false},
		{name: "substring in sentence passes", text: "mau belanja di Zara", blocked: false},
		{name: "substring shellfish passes", text: "classic shellfish", blocked: false},
		{name: "substring shitake passes", text: "shitake mushrooms", blocked: false},
		{name: "word with punctuation hits", text: "eh anjir!", blocked: true},
		{name: "separator evasion hits", text: "f.u.c.k this", blocked: true},
		{name: "underscore evasion hits", text: "F_U_C_K", blocked: true},
		{name: "dash evasion hits", text: "a-n-j-i-r", blocked: true},
		{name: "leet digits hit", text: "sh1t happens", blocked: true},
		{name: "leet at-sign hits", text: "@ss", blocked: true},
		{name: "leet mixed hits", text: "b1tch please", blocked: true},
		{name: "scunthorpe passes", text: "scunthorpe problem", blocked: false},
		{name: "single letters pass", text: "a b c", blocked: false},
		{name: "pronouns pass", text: "I love u", blocked: false},
		{name: "abbreviation passes", text: "from the u.s.a", blocked: false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := isBlockedComment(tt.text); got != tt.blocked {
				t.Errorf("isBlockedComment(%q) = %v, want %v", tt.text, got, tt.blocked)
			}
		})
	}
}
