// Bot demo untuk tab Whisper: canned auto-reply tanpa backend.
// Modul murni — tanpa dependensi svelte/supabase agar unit-testable.
// Anti-penyamaran: setiap permukaan memakai label bot yang eksplisit.
export const BOT_PEER_PREFIX = 'bot:';

/** Nama di daftar thread, mis. "Maya (bot)". */
export const BOT_LIST_SUFFIX = '(bot)';

/** Label di header thread. TIDAK BOLEH dihapus/diubah tanpa alasan. */
export const BOT_THREAD_LABEL = '(bot • auto-reply)';

/** Badge di daftar Whisper: menegaskan bot BUKAN manusia. */
export const BOT_BADGE = 'BUKAN manusia';

/** Setiap balasan bot WAJIB diakhiri kalimat ini. */
export const AUTO_REPLY_SUFFIX = 'Ini balasan otomatis.';

const CANNED: Record<string, string> = {
	maya: 'Hai! Aku lagi susun campus capsule dari Uniqlo — tee, chinos, dan sneakers yang gampang di-mix.',
	raka: 'Hai! Aku lagi coba runners Nike buat trip — cari yang enteng buat jalan jauh.',
	salsa: 'Hai! Aku lagi cari wedding guest look di Buttonscarves yang sopan tapi tetap cute.'
};

const FALLBACK_CANNED = 'Hai! Aku bot demo yang lagi jalan-jalan di mall.';

/** Peer id unik untuk thread bot, mis. "bot:maya". */
export function botPeerId(friendId: string): string {
	return `${BOT_PEER_PREFIX}${friendId}`;
}

/** True untuk peer id milik bot demo (bukan pengunjung manusia). */
export function isBotPeerId(peerId: string | null | undefined): boolean {
	return typeof peerId === 'string' && peerId.startsWith(BOT_PEER_PREFIX);
}

/** Kembalikan friend id dari peer id bot, atau null bila bukan bot. */
export function botIdFromPeerId(peerId: string | null | undefined): string | null {
	if (!isBotPeerId(peerId)) return null;
	const id = (peerId as string).slice(BOT_PEER_PREFIX.length);
	return id ? id : null;
}

/** Nama tampil di daftar Whisper, mis. "Maya (bot)". */
export function botDisplayName(name: string): string {
	return `${name} ${BOT_LIST_SUFFIX}`;
}

/**
 * Pilih balasan canned untuk bot. Murni: id sama → balasan sama.
 * Selalu 1–2 kalimat sesuai note mereka + diakhiri AUTO_REPLY_SUFFIX.
 */
export function botReplyFor(friendId: string, _userText?: string): string {
	const body = CANNED[friendId] ?? FALLBACK_CANNED;
	return `${body} ${AUTO_REPLY_SUFFIX}`;
}
