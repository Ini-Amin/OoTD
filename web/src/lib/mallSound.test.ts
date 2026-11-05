// Preferensi + bip suara Mall3D: default mati, persist localStorage.
// Run: npm run test (node:test, no dependencies).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
	clickOscillatorSpec,
	formatSoundPref,
	parseSoundPref,
	playClick,
	readSoundEnabled,
	SOUND_STORAGE_KEY,
	toggleSoundPref,
	writeSoundEnabled
} from './mallSound.ts';

function fakeStorage(initial: Record<string, string> = {}) {
	const map = new Map(Object.entries(initial));
	return {
		getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
		setItem: (k: string, v: string) => void map.set(k, v)
	};
}

describe('parseSoundPref', () => {
	it('defaults to OFF for missing and garbage values', () => {
		assert.equal(parseSoundPref(null), false);
		assert.equal(parseSoundPref(undefined), false);
		assert.equal(parseSoundPref(''), false);
		assert.equal(parseSoundPref('0'), false);
		assert.equal(parseSoundPref('off'), false);
		assert.equal(parseSoundPref('yes-please'), false);
	});

	it('accepts truthy spellings', () => {
		assert.equal(parseSoundPref('1'), true);
		assert.equal(parseSoundPref('on'), true);
		assert.equal(parseSoundPref('true'), true);
	});
});

describe('formatSoundPref / toggleSoundPref', () => {
	it('round-trips through parse', () => {
		assert.equal(parseSoundPref(formatSoundPref(true)), true);
		assert.equal(parseSoundPref(formatSoundPref(false)), false);
		assert.equal(formatSoundPref(true), '1');
		assert.equal(formatSoundPref(false), '0');
	});

	it('toggles', () => {
		assert.equal(toggleSoundPref(false), true);
		assert.equal(toggleSoundPref(true), false);
	});
});

describe('read/writeSoundEnabled', () => {
	it('reads the stored key, defaulting to OFF', () => {
		assert.equal(SOUND_STORAGE_KEY, 'ootd-mall-sound');
		assert.equal(readSoundEnabled(fakeStorage()), false);
		assert.equal(readSoundEnabled(fakeStorage({ [SOUND_STORAGE_KEY]: '1' })), true);
		assert.equal(readSoundEnabled(null), false);
	});

	it('persists and survives failing storage', () => {
		const s = fakeStorage();
		writeSoundEnabled(true, s);
		assert.equal(s.getItem(SOUND_STORAGE_KEY), '1');
		writeSoundEnabled(false, s);
		assert.equal(s.getItem(SOUND_STORAGE_KEY), '0');
		writeSoundEnabled(true, null); // must not throw
		const broken = {
			getItem: () => {
				throw new Error('blocked');
			},
			setItem: () => {
				throw new Error('blocked');
			}
		};
		assert.equal(readSoundEnabled(broken), false);
		writeSoundEnabled(true, broken); // must not throw
	});
});

describe('clickOscillatorSpec', () => {
	it('is a short rising blip', () => {
		const spec = clickOscillatorSpec();
		assert.ok(spec.startFreq > 0);
		assert.ok(spec.endFreq > spec.startFreq);
		assert.ok(spec.durationSec > 0 && spec.durationSec < 0.2);
	});
});

describe('playClick', () => {
	it('is a silent no-op without a browser (never throws)', () => {
		assert.equal(playClick(), false);
	});
});
