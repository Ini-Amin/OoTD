import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
 const response = await resolve(event);
 response.headers.set('X-Content-Type-Options', 'nosniff');
 response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
 if (event.url.protocol === 'https:') response.headers.set('Strict-Transport-Security', 'max-age=63072000');
 return response;
};
