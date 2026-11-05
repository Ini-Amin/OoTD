// ootd-mail-capture: Email Worker for kancalabs.ai.id test addresses.
// On incoming mail it POSTs the raw message to the capture webhook, then
// drops it (only attach this worker to test/catch addresses, never real ones).
const CAPTURE_URL = 'https://webhook.site/0097fef4-45ae-4441-8cd6-2935831a8ef4';

export default {
	async email(message, env, ctx) {
		const text = await new Response(message.raw).text();
		ctx.waitUntil(
			fetch(CAPTURE_URL, {
				method: 'POST',
				headers: { 'content-type': 'message/rfc822' },
				body: text.slice(0, 500000)
			}).catch(() => {})
		);
		// No forward call: message is dropped after capture.
	}
};
