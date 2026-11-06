// Moderasi chat mall: filter kata kasar ID+EN + throttle anti-spam.
// Modul murni — tanpa dependensi svelte/supabase agar unit-testable.
// Note: the ID_BLOCKED/EN_BLOCKED lists AND the matching algorithm are
// ported server-side in api/internal/httpapi/moderation.go — keep both in sync.
const ID_BLOCKED = [
	'anjir',
	'anjing',
	'asu',
	'babi',
	'bajingan',
	'bangsat',
	'bego',
	'goblok',
	'jancuk',
	'jancok',
	'kampret',
	'keparat',
	'kontol',
	'laknat',
	'memek',
	'ngentot',
	'pepek',
	'tolol'
];

const EN_BLOCKED = [
	'ass',
	'asshole',
	'bastard',
	'bitch',
	'cock',
	'cunt',
	'dick',
	'fuck',
	'fucker',
	'fucking',
	'pussy',
	'shit',
	'slut',
	'whore'
];

const BLOCKED = new Set([...ID_BLOCKED, ...EN_BLOCKED]);

/** Min gap between two sends from the same tab. */
export const THROTTLE_MS = 2000;

const LEET: Record<string, string> = {
	'0': 'o',
	'1': 'i',
	'3': 'e',
	'4': 'a',
	'5': 's',
	'7': 't',
	'@': 'a',
	$: 's',
	'+': 't'
};

/**
 * Lowercase one whitespace-delimited token, map leet chars, and drop
 * remaining separators, so "F.U.C.K" and "sh1t" become "fuck" and "shit".
 * Comparison stays whole-token (never substring), so innocent words like
 * "scunthorpe" and "shitake" still pass.
 */
function normalizeToken(tok: string): string {
	let out = '';
	for (const ch of tok.toLowerCase()) {
		const sub = LEET[ch];
		if (sub !== undefined) out += sub;
		else if (/\p{L}/u.test(ch)) out += ch;
	}
	return out;
}

/**
 * True when the text contains a blocked word. Matching is whole-word and
 * case-insensitive after separator/leet normalization: "anjir" hits but
 * "belanja" passes, "shit" hits but "shitake" passes, and "f.u.c.k" hits.
 * Spaced-out letters ("f u c k") still pass — tracked v1 limitation.
 */
export function isBlocked(text: string): boolean {
	for (const tok of text.split(/\s+/)) {
		if (tok && BLOCKED.has(normalizeToken(tok))) return true;
	}
	return false;
}

/**
 * True when `now` is too soon after the last send in `history`.
 * Pure so the store (which owns the history) stays thin and this stays testable.
 */
export function shouldThrottle(history: number[], now: number): boolean {
	if (history.length === 0) return false;
	return now - history[history.length - 1] < THROTTLE_MS;
}
