/** Max comment length in runes, matching the server-side validateComment cap. */
export const MAX_COMMENT_LEN = 500;

// Mirrors apiBase in outfits.ts, resolved lazily so this module stays
// loadable under node:test (which cannot resolve $lib or import.meta.env).
function apiBaseUrl(): string {
	const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
	return env?.VITE_API_URL ?? 'http://localhost:8080';
}

export type CommentAuthor = {
	username: string;
	displayName: string;
	handle: string;
};

export type CommentItem = {
	id: string;
	body: string;
	createdAt: string;
	author: CommentAuthor;
};

function isValidCommentItem(item: unknown): item is CommentItem {
	if (!item || typeof item !== 'object') return false;
	const c = item as Record<string, unknown>;
	const a = c.author as Record<string, unknown> | null;
	return (
		typeof c.id === 'string' &&
		typeof c.body === 'string' &&
		typeof c.createdAt === 'string' &&
		!!a &&
		typeof a.username === 'string' &&
		typeof a.displayName === 'string' &&
		typeof a.handle === 'string'
	);
}

export type FetchCommentsResult =
	| { ok: true; comments: CommentItem[]; commentCount: number }
	| { ok: false; error: string; status: number };

/** GET /v1/outfits/{id}/comments (public). Oldest-first, at most 100. */
export async function fetchComments(outfitId: string): Promise<FetchCommentsResult> {
	try {
		const res = await fetch(`${apiBaseUrl()}/v1/outfits/${encodeURIComponent(outfitId)}/comments`);
		if (res.status === 404) {
			return { ok: false, error: 'Comments unavailable for this look.', status: 404 };
		}
		if (!res.ok) {
			return { ok: false, error: `Server error (${res.status}).`, status: res.status };
		}
		const data = (await res.json().catch(() => null)) as {
			comments?: unknown;
			commentCount?: unknown;
		} | null;
		if (!data || !Array.isArray(data.comments)) {
			return { ok: false, error: 'Server error: bad comments response.', status: res.status };
		}
		return {
			ok: true,
			comments: data.comments.filter(isValidCommentItem),
			commentCount: typeof data.commentCount === 'number' ? data.commentCount : 0
		};
	} catch {
		return { ok: false, error: 'Network error: could not load comments.', status: 0 };
	}
}

export type PostCommentResult =
	| { ok: true; comment: CommentItem }
	| { ok: false; error: string; status: number };

/** POST /v1/outfits/{id}/comments. Error strings mirror the /new form messages. */
export async function postComment(
	outfitId: string,
	body: string,
	token: string
): Promise<PostCommentResult> {
	try {
		const res = await fetch(`${apiBaseUrl()}/v1/outfits/${encodeURIComponent(outfitId)}/comments`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
			body: JSON.stringify({ body })
		});
		if (res.status === 201) {
			const data = (await res.json().catch(() => null)) as { comment?: unknown } | null;
			if (data?.comment && isValidCommentItem(data.comment)) {
				return { ok: true, comment: data.comment };
			}
			return { ok: false, error: 'Server error (201).', status: 201 };
		}
		if (res.status === 401) {
			return { ok: false, error: 'Your session expired. Sign in again.', status: 401 };
		}
		if (res.status === 429) {
			return { ok: false, error: 'Too many comments. Try again in a bit.', status: 429 };
		}
		if (res.status === 400 || res.status === 404) {
			const data = (await res.json().catch(() => ({}))) as { error?: string };
			return { ok: false, error: data.error ?? 'Validation failed.', status: res.status };
		}
		return { ok: false, error: `Server error (${res.status}).`, status: res.status };
	} catch {
		return { ok: false, error: 'Network error: could not post comment.', status: 0 };
	}
}

export type DeleteCommentResult =
	| { ok: true }
	| { ok: false; error: string; status: number };

/** DELETE /v1/outfits/{id}/comments/{commentId}. */
export async function deleteComment(
	outfitId: string,
	commentId: string,
	token: string
): Promise<DeleteCommentResult> {
	try {
		const res = await fetch(
			`${apiBaseUrl()}/v1/outfits/${encodeURIComponent(outfitId)}/comments/${encodeURIComponent(commentId)}`,
			{ method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
		);
		if (res.status === 204) return { ok: true };
		if (res.status === 401) {
			return { ok: false, error: 'Your session expired. Sign in again.', status: 401 };
		}
		if (res.status === 404) {
			return { ok: false, error: 'Comment not found.', status: 404 };
		}
		return { ok: false, error: `Server error (${res.status}).`, status: res.status };
	} catch {
		return { ok: false, error: 'Network error: could not delete comment.', status: 0 };
	}
}

/**
 * Whether the delete button should render for a comment. Mirrors the
 * server rule (comments.go): the comment author or the outfit owner may
 * delete. Pure so it stays unit-testable.
 */
export function canDeleteComment(
	commentUsername: string,
	outfitHandle: string,
	profileUsername: string | null | undefined
): boolean {
	if (!profileUsername) return false;
	if (commentUsername === profileUsername) return true;
	return outfitHandle.replace(/^@/, '') === profileUsername;
}
