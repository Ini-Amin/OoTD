// Moderasi chat mall: filter kata kasar ID+EN + throttle anti-spam.
// Modul murni — tanpa dependensi svelte/supabase agar unit-testable.
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

/**
 * True when the text contains a blocked word. Matching is whole-word and
 * case-insensitive: "anjir" hits but "belanja" passes, "shit" hits but
 * "shitake" passes.
 */
export function isBlocked(text: string): boolean {
	const words = text.toLowerCase().split(/[^\p{L}]+/u);
	for (const w of words) {
		if (w && BLOCKED.has(w)) return true;
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
