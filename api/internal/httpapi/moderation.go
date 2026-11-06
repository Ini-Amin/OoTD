package httpapi

import (
	"strings"
	"unicode"
)

// Server-side port of web/src/lib/chatFilter.ts. The TS module has no Go
// import path and client checks are bypassable, so the API enforces the
// blocklist here. Keep the word lists AND the matching algorithm in sync
// with chatFilter.ts.
var blockedWords = map[string]bool{
	// ID_BLOCKED
	"anjir": true, "anjing": true, "asu": true, "babi": true,
	"bajingan": true, "bangsat": true, "bego": true, "goblok": true,
	"jancuk": true, "jancok": true, "kampret": true, "keparat": true,
	"kontol": true, "laknat": true, "memek": true, "ngentot": true,
	"pepek": true, "tolol": true,
	// EN_BLOCKED
	"ass": true, "asshole": true, "bastard": true, "bitch": true,
	"cock": true, "cunt": true, "dick": true, "fuck": true,
	"fucker": true, "fucking": true, "pussy": true, "shit": true,
	"slut": true, "whore": true,
}

// leetSpeak maps common leetspeak substitutions back to letters.
var leetSpeak = map[rune]rune{
	'0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't',
	'@': 'a', '$': 's', '+': 't',
}

// normalizeToken lowercases one whitespace-delimited token, maps leet chars,
// and drops remaining separators, so "F.U.C.K" and "sh1t" become "fuck" and
// "shit". Comparison stays whole-token (never substring), so innocent words
// like "scunthorpe" and "shitake" still pass.
func normalizeToken(tok string) string {
	var b strings.Builder
	for _, r := range strings.ToLower(tok) {
		if sub, ok := leetSpeak[r]; ok {
			b.WriteRune(sub)
		} else if unicode.IsLetter(r) {
			b.WriteRune(r)
		}
	}
	return b.String()
}

// isBlockedComment reports whether text contains a blocked word. Matching is
// whole-word and case-insensitive after separator/leet normalization:
// "anjir" hits but "belanja" passes; "f.u.c.k" and "sh1t" also hit.
// Spaced-out letters ("f u c k") and novel misspellings still pass —
// tracked v1 limitation, same as the mall-chat filter.
func isBlockedComment(text string) bool {
	for _, tok := range strings.Fields(text) {
		if blockedWords[normalizeToken(tok)] {
			return true
		}
	}
	return false
}
