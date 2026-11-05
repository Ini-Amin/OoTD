// Efek suara klik Mall3D: WebAudio oscillator bip pendek, tanpa file audio.
// Default MATI (tidak mengagetkan, tanpa autoplay); preferensi di localStorage.
// Inti murni (parse/format/spec) unit-testable; playClick aman di node (no-op).
export const SOUND_STORAGE_KEY = 'ootd-mall-sound';

export type ClickSpec = {
	/** Frekuensi awal oscillator (Hz). */
	startFreq: number;
	/** Frekuensi akhir oscillator (Hz). */
	endFreq: number;
	/** Durasi bip (detik). */
	durationSec: number;
};

/** Bip klik pendek: 660→880 Hz, 70 ms. */
export function clickOscillatorSpec(): ClickSpec {
	return { startFreq: 660, endFreq: 880, durationSec: 0.07 };
}

/** Parse nilai localStorage. Default MATI untuk nilai asing/kosong. */
export function parseSoundPref(value: unknown): boolean {
	return value === '1' || value === 'on' || value === 'true';
}

/** Format preferensi untuk localStorage. */
export function formatSoundPref(enabled: boolean): string {
	return enabled ? '1' : '0';
}

export function toggleSoundPref(current: boolean): boolean {
	return !current;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function defaultStorage(): StorageLike | null {
	try {
		if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
	} catch {
		// Akses localStorage diblokir (mode privat) → anggap default.
	}
	return null;
}

/** Baca preferensi suara; default MATI bila tak tersimpan / tak tersedia. */
export function readSoundEnabled(storage: StorageLike | null = defaultStorage()): boolean {
	try {
		if (!storage) return false;
		return parseSoundPref(storage.getItem(SOUND_STORAGE_KEY));
	} catch {
		return false;
	}
}

/** Simpan preferensi suara; tidak pernah throw. */
export function writeSoundEnabled(
	enabled: boolean,
	storage: StorageLike | null = defaultStorage()
): void {
	try {
		storage?.setItem(SOUND_STORAGE_KEY, formatSoundPref(enabled));
	} catch {
		// localStorage penuh/diblokir → suara tetap jalan sesi ini.
	}
}

let sharedCtx: AudioContext | null = null;

/**
 * Bunyikan bip klik bila suara dinyalakan. Panggil dari user gesture
 * (klik tombol) agar tidak kena blokir autoplay. True bila berbunyi.
 * Aman di SSR/node: no-op false tanpa throw.
 */
export function playClick(): boolean {
	try {
		if (!readSoundEnabled()) return false;
		if (typeof window === 'undefined') return false;
		const AC =
			window.AudioContext ??
			(window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
		if (!AC) return false;
		sharedCtx ??= new AC();
		if (sharedCtx.state === 'suspended') void sharedCtx.resume();
		const spec = clickOscillatorSpec();
		const t = sharedCtx.currentTime;
		const osc = sharedCtx.createOscillator();
		const gain = sharedCtx.createGain();
		osc.type = 'sine';
		osc.frequency.setValueAtTime(spec.startFreq, t);
		osc.frequency.exponentialRampToValueAtTime(spec.endFreq, t + spec.durationSec);
		gain.gain.setValueAtTime(0.0001, t);
		gain.gain.exponentialRampToValueAtTime(0.2, t + 0.01);
		gain.gain.exponentialRampToValueAtTime(0.0001, t + spec.durationSec);
		osc.connect(gain);
		gain.connect(sharedCtx.destination);
		osc.start(t);
		osc.stop(t + spec.durationSec + 0.02);
		return true;
	} catch {
		return false;
	}
}
