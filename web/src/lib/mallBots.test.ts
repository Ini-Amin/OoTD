// Bot demo Whisper: peer id, label anti-penyamaran, canned reply.
// Run: npm run test (node:test, no dependencies).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
	AUTO_REPLY_SUFFIX,
	BOT_BADGE,
	BOT_LIST_SUFFIX,
	BOT_PEER_PREFIX,
	BOT_THREAD_LABEL,
	botDisplayName,
	botIdFromPeerId,
	botPeerId,
	botReplyFor,
	isBotPeerId
} from './mallBots.ts';
import { mallFriends } from './mall.ts';

describe('bot peer ids', () => {
	it('round-trips friend id <-> peer id', () => {
		assert.equal(botPeerId('maya'), 'bot:maya');
		assert.equal(botIdFromPeerId('bot:maya'), 'maya');
		assert.equal(BOT_PEER_PREFIX, 'bot:');
	});

	it('detects bot peers and rejects humans/empty', () => {
		assert.equal(isBotPeerId('bot:raka'), true);
		assert.equal(isBotPeerId('some-client-id'), false);
		assert.equal(isBotPeerId('bot:'), true);
		assert.equal(isBotPeerId(null), false);
		assert.equal(isBotPeerId(undefined), false);
		assert.equal(isBotPeerId(''), false);
	});

	it('returns null for non-bot and empty ids', () => {
		assert.equal(botIdFromPeerId('some-client-id'), null);
		assert.equal(botIdFromPeerId('bot:'), null);
		assert.equal(botIdFromPeerId(null), null);
		assert.equal(botIdFromPeerId(undefined), null);
	});
});

describe('bot labels (never impersonate a human)', () => {
	it('pins the exact thread label and badge strings', () => {
		assert.equal(BOT_THREAD_LABEL, '(bot • auto-reply)');
		assert.equal(BOT_LIST_SUFFIX, '(bot)');
		assert.equal(BOT_BADGE, 'BUKAN manusia');
	});

	it('renders list names as "Maya (bot)"', () => {
		assert.equal(botDisplayName('Maya'), 'Maya (bot)');
	});
});

describe('botReplyFor', () => {
	it('covers every demo friend in mallFriends', () => {
		assert.ok(mallFriends.length >= 3);
		for (const f of mallFriends) {
			const reply = botReplyFor(f.id, 'halo');
			assert.ok(reply.length > AUTO_REPLY_SUFFIX.length, `${f.id} has a body`);
			assert.ok(reply.endsWith(AUTO_REPLY_SUFFIX), `${f.id} ends with auto-reply note`);
		}
	});

	it('matches each friend note (campus capsule / runners / wedding)', () => {
		assert.match(botReplyFor('maya'), /campus capsule/i);
		assert.match(botReplyFor('raka'), /runner/i);
		assert.match(botReplyFor('salsa'), /wedding/i);
	});

	it('is pure: same id always gives the same reply', () => {
		assert.equal(botReplyFor('maya', 'hi'), botReplyFor('maya', 'apa kabar?'));
	});

	it('falls back safely for unknown ids, still labeled auto', () => {
		const reply = botReplyFor('nobody');
		assert.ok(reply.endsWith(AUTO_REPLY_SUFFIX));
		assert.match(reply, /bot demo/i);
	});
});
