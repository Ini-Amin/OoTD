<script lang="ts">
	import { onMount } from 'svelte';
	import { CATEGORIES, CATEGORY_LABEL, DEFAULT_BOX, type Category, type Piece } from '$lib/pieces';
	import { closet } from '$lib/closet.svelte';
	import { saved } from '$lib/saved.svelte';
	import { auth, authHeaders } from '$lib/auth.svelte';
	import {
		claimAutoTagAttempt,
		getCachedPieces,
		setCachedPieces,
		toValidPiece
	} from '$lib/pieceCache';
	import { decideSavePiece } from '$lib/saveGate';
	import { apiBase, previewOutfits, ratioOf, type Outfit } from '$lib/outfits';
	import {
		canDeleteComment,
		deleteComment,
		fetchComments,
		MAX_COMMENT_LEN,
		postComment,
		type CommentItem
	} from '$lib/comments';
	import { isBlocked } from '$lib/chatFilter';
	import CategoryIcon from '$lib/CategoryIcon.svelte';
	import OutfitCard from '$lib/OutfitCard.svelte';
	import { mergeFeedOutfits } from '$lib/feedMerge';
	import { findSimilar, SIMILAR_LIMIT } from '$lib/similar';

	const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

	let {
		id,
		onclose,
		candidates,
		onopen
	}: { id: string; onclose?: () => void; candidates?: Outfit[]; onopen?: (id: string) => void } =
		$props();

	let outfit = $state<Outfit | null>(null);
	let loading = $state(true);
	let error = $state<'notFound' | 'network' | null>(null);
	let errorMessage = $state('');
	let imageError = $state(false);

	let hoveredCategory = $state<Category | null>(null);
	let focusedCategory = $state<Category | null>(null);
	let activeCategory = $derived(hoveredCategory ?? focusedCategory);

	let copied = $state(false);
	let copyTimeout: ReturnType<typeof setTimeout> | undefined;

	let toast = $state<{ message: string; link?: string; linkText?: string } | null>(null);
	let toastTimeout: ReturnType<typeof setTimeout> | undefined;

	let currentRequestId = 0;

	// "Similar looks" candidate pool. The feed modal passes its already-loaded
	// list (zero new requests); a cold /o/{id} load scores the bundled
	// previews immediately, fires ONE lazy GET /v1/outfits, then rescores.
	// The pool is id-independent, so scoring always derives from the current
	// outfit — a slow pool response can never leak outfit A's ranking into B.
	let poolApi = $state<Outfit[] | null>(null);
	let poolSettled = $state(false);
	let poolStarted = false;

	let poolReady = $derived(candidates !== undefined || poolSettled);
	let pool = $derived<Outfit[]>(
		candidates ?? (poolApi ? mergeFeedOutfits(poolApi, previewOutfits) : previewOutfits)
	);

	// Real (UUID) looks never recommend seeded preview demos (their
	// comment/save endpoints 404); preview looks may recommend peers.
	let excludeIds = $derived.by<ReadonlySet<string>>(() => {
		if (outfit && uuidPattern.test(outfit.id)) {
			return new Set(previewOutfits.map((o) => o.id));
		}
		return new Set<string>();
	});

	let similar = $derived<Outfit[]>(
		outfit ? findSimilar(outfit, pool, { excludeIds, limit: SIMILAR_LIMIT }) : []
	);

	let comments = $state<CommentItem[]>([]);
	let commentTotal = $state(0);
	let commentsLoading = $state(false);
	let commentsError = $state('');
	let commentsUnavailable = $state(false);
	let commentDraft = $state('');
	// Rune count: the server caps at 500 runes, while maxlength/.length
	// count UTF-16 units (an emoji-heavy draft would hit the box cap early).
	let commentRunes = $derived([...commentDraft.trim()].length);
	let posting = $state(false);
	let deletingId = $state<string | null>(null);
	let commentRequestId = 0;

	// AI-tagged pieces for THIS outfit id only (from cache or a fresh
	// background /v1/analyze call). Scoped by outfit id so a slow response
	// can never leak boxes into another outfit.
	let autoTag = $state<{ outfitId: string; pieces: Piece[] } | null>(null);

	// Tagging lifecycle for THIS outfit id. togglePiece waits for an
	// in-flight attempt so saves never store DEFAULT_BOX guesses (face crops).
	let autoTagState = $state<{ outfitId: string; status: 'tagging' | 'done' | 'failed' } | null>(
		null
	);
	let autoTagPromise: Promise<void> | null = null;

	let isSaved = $derived(outfit ? saved.has(outfit.id) : false);
	let saveCount = $derived(outfit ? outfit.savedBy + (isSaved ? 1 : 0) : 0);
	let username = $derived(outfit ? outfit.handle.replace(/^@/, '') : '');

	let pieces = $derived<Piece[]>(
		(() => {
			const current = outfit;
			if (!current) return [];
			if (current.pieces && current.pieces.length > 0) return current.pieces;
			if (autoTag && autoTag.outfitId === current.id && autoTag.pieces.length > 0) {
				return autoTag.pieces;
			}
			return CATEGORIES.map((cat) => ({
				id: `${current.id}:${cat}`,
				category: cat,
				label: CATEGORY_LABEL[cat],
				x: DEFAULT_BOX[cat].x,
				y: DEFAULT_BOX[cat].y,
				w: DEFAULT_BOX[cat].w,
				h: DEFAULT_BOX[cat].h
			}));
		})()
	);

	let activePiece = $derived(activeCategory ? pieces.find((p) => p.category === activeCategory) : null);

	// Only outfits with real tagged pieces (e.g. via Magic Tag) get a highlight
	// box. Synthetic suggested regions stay clickable for the closet, but never
	// render a floating box over nothing. Cached/fresh auto-tag boxes count as
	// real: they are model output, not DEFAULT_BOX guesses.
	let hasTaggedPieces = $derived(
		!!(
			outfit &&
			((outfit.pieces && outfit.pieces.length > 0) ||
				(autoTag && autoTag.outfitId === outfit.id && autoTag.pieces.length > 0))
		)
	);

	let showAiBadge = $derived(
		!!(
			outfit &&
			!(outfit.pieces && outfit.pieces.length > 0) &&
			autoTag &&
			autoTag.outfitId === outfit.id &&
			autoTag.pieces.length > 0
		)
	);

	function showToast(message: string, link?: string, linkText?: string) {
		clearTimeout(toastTimeout);
		toast = { message, link, linkText };
		toastTimeout = setTimeout(() => {
			toast = null;
		}, 4000);
	}

	async function togglePiece(piece: Piece) {
		if (!outfit || !outfit.imageUrl || !outfit.imageUrl.trim() || imageError) return;
		if (closet.has(piece.id)) {
			closet.remove(piece.id);
			showToast('Removed');
			return;
		}
		// Only real AI boxes may be saved. Synthetic DEFAULT_BOX guesses put
		// faces on the mannequin torso, so they are never stored.
		const outfitId = outfit.id;
		const tagging =
			autoTagState?.outfitId === outfitId && autoTagState.status === 'tagging'
				? autoTagPromise
				: null;
		const decision = decideSavePiece({
			hasTaggedPieces,
			authed: !!auth.token,
			taggingInFlight: !!tagging
		});
		let toSave = piece;
		if (decision.action === 'refuse') {
			showToast(
				decision.reason === 'signin'
					? 'Sign in so AI can tag the pieces first'
					: 'AI could not tag this photo — try an outfit photo'
			);
			return;
		}
		if (decision.action === 'wait' && tagging) {
			showToast('Waiting for AI tagging…');
			await tagging;
			if (!outfit || outfit.id !== outfitId || !hasTaggedPieces) {
				showToast('AI could not tag this photo — try an outfit photo');
				return;
			}
			const fresh = pieces.find((p) => p.category === piece.category);
			if (!fresh) return;
			toSave = fresh;
		}
		closet.add({
			...toSave,
			outfitId: outfit.id,
			outfitTitle: outfit.title,
			imageUrl: outfit.imageUrl
		});
		showToast(`Saved ${toSave.label} to your closet`, '/mannequin', 'Open mannequin');
	}

	async function handleShare() {
		if (!outfit || typeof window === 'undefined') return;
		// Always share the canonical deep link so Share works from the feed
		// modal too (where location.href is the feed, not the look).
		const url = `${window.location.origin}/o/${outfit.id}`;
		const shareData = { title: outfit.title, text: outfit.title, url };
		if (
			typeof navigator !== 'undefined' &&
			navigator.share &&
			(!navigator.canShare || navigator.canShare(shareData))
		) {
			try {
				await navigator.share(shareData);
				return;
			} catch (err: unknown) {
				if (err instanceof Error && err.name === 'AbortError') return;
			}
		}
		if (typeof navigator !== 'undefined' && navigator.clipboard) {
			try {
				await navigator.clipboard.writeText(url);
				copied = true;
				clearTimeout(copyTimeout);
				copyTimeout = setTimeout(() => {
					copied = false;
				}, 2000);
				showToast('Link copied');
			} catch {
				showToast('Could not copy link');
			}
		} else {
			showToast('Could not copy link');
		}
	}

	type AnalyzePiece = {
		category: string;
		label: string;
		box?: { x: number; y: number; w: number; h: number };
	};

	// Background Magic Tag for untagged outfits. Silent by design: any
	// failure (401/429/503/network, empty/invalid pieces) keeps the current
	// untagged behavior with no error UI.
	async function autoTagOutfit(outfitId: string, imageUrl: string) {
		const finish = (status: 'done' | 'failed') => {
			if (autoTagState?.outfitId === outfitId) autoTagState = { outfitId, status };
		};
		try {
			const res = await fetch(`${apiBase}/v1/analyze`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', ...authHeaders() },
				body: JSON.stringify({ image_url: imageUrl })
			});
			if (!res.ok) {
				finish('failed');
				return;
			}
			const data = (await res.json()) as { pieces?: AnalyzePiece[] };
			const mapped: Piece[] = [];
			for (const item of data.pieces ?? []) {
				const piece = toValidPiece(outfitId, { ...item, ...(item.box ?? {}) });
				if (piece) mapped.push(piece);
			}
			if (mapped.length === 0) {
				finish('failed');
				return;
			}
			setCachedPieces(outfitId, mapped);
			if (outfit?.id === outfitId) {
				autoTag = { outfitId, pieces: mapped };
			}
			finish('done');
		} catch {
			finish('failed');
			// Silent: keep untagged behavior.
		}
	}

	function formatCommentTime(iso: string): string {
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return '';
		return d.toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	async function loadComments(targetId: string, fallbackTotal: number) {
		const req = ++commentRequestId;
		comments = [];
		commentsError = '';
		commentsUnavailable = false;
		commentDraft = '';
		commentTotal = fallbackTotal;
		// Preview looks (ids like 'look-001') are not in the DB: the
		// comments endpoints 404, so degrade gracefully instead of fetching.
		if (!uuidPattern.test(targetId)) {
			commentsUnavailable = true;
			return;
		}
		commentsLoading = true;
		const result = await fetchComments(targetId);
		if (req !== commentRequestId) return;
		commentsLoading = false;
		if (result.ok) {
			comments = result.comments;
			commentTotal = result.commentCount;
		} else if (result.status === 404) {
			commentsUnavailable = true;
		} else {
			commentsError = result.error;
		}
	}

	async function submitComment() {
		if (!outfit || posting) return;
		const body = commentDraft.trim();
		if (!body) return;
		if ([...body].length > MAX_COMMENT_LEN) {
			commentsError = `Comment is too long (max ${MAX_COMMENT_LEN} characters).`;
			return;
		}
		if (isBlocked(body)) {
			commentsError = 'Comment rejected: inappropriate language.';
			return;
		}
		const token = auth.token;
		if (!token) return;
		posting = true;
		commentsError = '';
		const result = await postComment(outfit.id, body, token);
		posting = false;
		if (!outfit) return;
		if (result.ok) {
			comments = [...comments, result.comment];
			commentTotal += 1;
			commentDraft = '';
		} else {
			commentsError = result.error;
		}
	}

	async function removeComment(commentId: string) {
		if (!outfit || deletingId) return;
		const token = auth.token;
		if (!token) return;
		deletingId = commentId;
		const result = await deleteComment(outfit.id, commentId, token);
		deletingId = null;
		if (!outfit) return;
		if (result.ok) {
			comments = comments.filter((c) => c.id !== commentId);
			commentTotal = Math.max(0, commentTotal - 1);
			showToast('Comment deleted');
		} else {
			commentsError = result.error;
		}
	}

	async function loadOutfit(targetId: string) {
		if (!targetId) {
			loading = false;
			error = 'notFound';
			outfit = null;
			return;
		}
		const req = ++currentRequestId;
		loading = true;
		error = null;
		errorMessage = '';
		imageError = false;
		comments = [];
		commentTotal = 0;
		commentsError = '';
		commentsUnavailable = false;

		// Preview ids (look-*) are local-only and never in the DB: resolve
		// them without a doomed API fetch (which 404s, logs a console
		// error, and previously bypassed the preview fallback below).
		const local = previewOutfits.find((o) => o.id === targetId);
		if (local) {
			outfit = local;
			loading = false;
			void loadComments(local.id, local.commentCount ?? 0);
			return;
		}

		try {
			const res = await fetch(`${apiBase}/v1/outfits/${encodeURIComponent(targetId)}`);
			if (req !== currentRequestId) return;
			if (res.status === 404) {
				error = 'notFound';
				outfit = null;
				return;
			}
			if (!res.ok) {
				throw new Error(`Failed to load look (${res.status})`);
			}
			const data = (await res.json()) as { outfit: Outfit };
			if (req !== currentRequestId) return;
			outfit = data.outfit;
			void loadComments(outfit.id, outfit.commentCount ?? 0);
		} catch (err) {
			if (req !== currentRequestId) return;
			const fallback = previewOutfits.find((o) => o.id === targetId);
			if (fallback) {
				outfit = fallback;
				error = null;
				void loadComments(fallback.id, fallback.commentCount ?? 0);
			} else {
				error = 'network';
				errorMessage = err instanceof Error ? err.message : 'Network error';
				outfit = null;
			}
		} finally {
			if (req === currentRequestId) {
				loading = false;
			}
		}
	}

	onMount(() => {
		closet.init();
		saved.init();
		return () => {
			clearTimeout(toastTimeout);
			clearTimeout(copyTimeout);
		};
	});

	$effect(() => {
		const currentId = id;
		imageError = false;
		loadOutfit(currentId);
	});

	// Cold-load pool upgrade: without it a direct-loaded real look could only
	// recommend previews (excluded above) and the section would stay empty.
	// At most one fetch per mount; failures silently keep preview scoring.
	$effect(() => {
		if (candidates !== undefined || poolStarted) return;
		poolStarted = true;
		// Deliberately no currentRequestId guard here: unlike loadOutfit,
		// the pool is outfit-independent (scoring always re-derives from
		// the current outfit), so a response that lands after an id change
		// is still valid. Discarding it would leave real looks with a
		// permanently empty section until remount.
		fetch(`${apiBase}/v1/outfits`)
			.then(async (res) => {
				if (!res.ok) throw new Error('pool fetch failed');
				const data = (await res.json()) as { outfits?: Outfit[] };
				poolApi = Array.isArray(data.outfits) ? data.outfits : [];
			})
			.catch(() => {
				// Silent: keep the preview-scored result.
			})
			.finally(() => {
				poolSettled = true;
			});
	});

	// Auto Magic Tag: untagged outfit + signed in + no cache entry ->
	// one background POST /v1/analyze (https photos only, once per outfit
	// per session). Re-runs when the session token arrives after load.
	$effect(() => {
		const current = outfit;
		if (!current) return;
		if (current.pieces && current.pieces.length > 0) return;
		const cached = getCachedPieces(current.id);
		if (cached && cached.length > 0) {
			autoTag = { outfitId: current.id, pieces: cached };
			return;
		}
		const url = current.imageUrl?.trim() ?? '';
		if (!url.toLowerCase().startsWith('https://')) return;
		if (!auth.token) return;
		if (!claimAutoTagAttempt(current.id)) return;
		autoTagState = { outfitId: current.id, status: 'tagging' };
		autoTagPromise = autoTagOutfit(current.id, url);
	});
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape' && onclose) {
			onclose();
		}
	}}
/>

<article class="viewer-card">
	{#if onclose}
		<button type="button" class="close-button" onclick={onclose} aria-label="Close">
			<svg
				width="18"
				height="18"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<line x1="18" y1="6" x2="6" y2="18"></line>
				<line x1="6" y1="6" x2="18" y2="18"></line>
			</svg>
		</button>
	{/if}

	{#if toast}
		<aside class="toast" role="status" aria-live="polite">
			<span>{toast.message}</span>
			{#if toast.link && toast.linkText}
				<a href={toast.link} class="toast-link">{toast.linkText}</a>
			{/if}
		</aside>
	{/if}

	{#if loading}
		<div class="card-loading" aria-busy="true" aria-label="Loading look">
			<div class="skeleton-photo"></div>
			<div class="skeleton-meta">
				<div class="skeleton-line skeleton-title"></div>
				<div class="skeleton-line skeleton-creator"></div>
				<div class="skeleton-line skeleton-caption"></div>
				<div class="skeleton-line skeleton-caption-short"></div>
			</div>
		</div>
	{:else if error === 'notFound'}
		<div class="card-state">
			<p class="state-message">This look is gone or private.</p>
		</div>
	{:else if error === 'network'}
		<div class="card-state">
			<p class="state-message">{errorMessage || 'Network error: could not connect to server.'}</p>
			<button type="button" class="retry-btn" onclick={() => loadOutfit(id)}>Retry</button>
		</div>
	{:else if outfit}
		<div class="card-content">
			<div class="photo-pane">
				<div class="photo-wrapper">
					{#if outfit.imageUrl && outfit.imageUrl.trim() && !imageError}
						<div class="photo-frame">
							<img
								src={outfit.imageUrl}
								alt={outfit.title}
								width={outfit.imageWidth}
								height={outfit.imageHeight}
								class="photo-img"
								onerror={() => {
									imageError = true;
								}}
							/>
							{#if activePiece && hasTaggedPieces}
								<div
									class="piece-highlight"
									style={`left: ${activePiece.x * 100}%; top: ${activePiece.y * 100}%; width: ${activePiece.w * 100}%; height: ${activePiece.h * 100}%;`}
								></div>
							{/if}
						</div>
					{:else}
						<div
							class="photo-fallback"
							style={`aspect-ratio: ${ratioOf(outfit)}; --card-accent: ${outfit.accent};`}
							role="img"
							aria-label={`${outfit.title} visual`}
						>
							<span class="fallback-mark">OoTD</span>
						</div>
					{/if}

					<aside class="category-strip" aria-label="Pieces">
						{#each CATEGORIES as cat (cat)}
							{@const piece = pieces.find((p) => p.category === cat)}
							{@const isPieceSaved = piece ? closet.has(piece.id) : false}
							{@const hasImage = Boolean(outfit.imageUrl && outfit.imageUrl.trim() && !imageError)}
							{@const isDisabled = !piece || !hasImage}
							{@const buttonTitle = !hasImage
								? 'No photo to crop from'
								: !piece
									? `No ${CATEGORY_LABEL[cat]} tagged`
									: isPieceSaved
										? `Remove ${piece.label}`
										: `Save ${piece.label} to closet`}
							<div class="strip-item">
								<button
									type="button"
									class="category-btn"
									class:saved={isPieceSaved}
									class:dimmed={!piece}
									disabled={isDisabled}
									title={buttonTitle}
									aria-pressed={isPieceSaved}
									aria-label={piece ? piece.label : CATEGORY_LABEL[cat]}
									onmouseenter={() => {
										if (piece) hoveredCategory = cat;
									}}
									onmouseleave={() => {
										if (hoveredCategory === cat) hoveredCategory = null;
									}}
									onfocus={() => {
										if (piece) focusedCategory = cat;
									}}
									onblur={() => {
										if (focusedCategory === cat) focusedCategory = null;
									}}
									onclick={() => {
										if (piece && hasImage) togglePiece(piece);
									}}
								>
									<CategoryIcon category={cat} size={20} />
								</button>
								{#if activeCategory === cat && piece}
									<div class="tooltip" role="tooltip">
										{piece.label}
									</div>
								{/if}
							</div>
						{/each}
					</aside>
				</div>
			</div>

			<div class="meta-pane">
				<div class="meta-header">
					<h1 class="outfit-title">{outfit.title}</h1>
					{#if showAiBadge}
						<span class="ai-badge">AI tagged</span>
					{/if}
					<a href={`/u/${username}`} class="creator-link">
						<span class="creator-avatar" style={`--avatar-accent: ${outfit.accent}`} aria-hidden="true">
							{outfit.creator ? outfit.creator.slice(0, 1) : ''}
						</span>
						<span class="creator-info">
							<span class="creator-name">{outfit.creator}</span>
							<span class="creator-handle">{outfit.handle}</span>
						</span>
					</a>
				</div>

				{#if outfit.caption}
					<p class="caption">{outfit.caption}</p>
				{/if}

				{#if outfit.tags && outfit.tags.length > 0}
					<p class="tags">{outfit.tags.map((t) => (t.startsWith('#') ? t : `#${t}`)).join(' ')}</p>
				{/if}

				<div class="meta-footer">
					<div class="counts-row">
						<span class="save-count">♡ {saveCount}</span>
						<span class="comment-count">💬 {commentTotal}</span>
					</div>
					<div class="actions-row">
						<button
							type="button"
							class="save-look-btn"
							class:saved={isSaved}
							aria-pressed={isSaved}
							onclick={() => outfit && saved.toggle(outfit)}
						>
							<span aria-hidden="true" class="heart-icon">{isSaved ? '♥' : '♡'}</span>
							<span>{isSaved ? 'Saved look' : 'Save look'}</span>
						</button>

						<button type="button" class="share-btn" onclick={handleShare}>
							Share
						</button>

						{#if copied}
							<span class="copy-notice" role="status">Link copied</span>
						{/if}
					</div>
				</div>

				<section class="comments" aria-label="Comments">
					<h2 class="comments-title">
						Comments{#if !commentsUnavailable} ({commentTotal}){/if}
					</h2>
					{#if commentsUnavailable}
						<p class="quiet-state">Comments unavailable for preview looks.</p>
					{:else if commentsLoading}
						<p class="quiet-state">Loading comments…</p>
					{:else}
						{#if commentsError}
							<p class="error-region" role="alert">{commentsError}</p>
						{/if}
						{#if comments.length === 0}
							<p class="quiet-state">No comments yet. Be the first to share your thoughts.</p>
						{:else}
							<ol class="comment-list">
								{#each comments as c (c.id)}
									<li class="comment">
										<div class="comment-head">
											<a href={`/u/${c.author.username}`} class="comment-author">
												{c.author.displayName}
											</a>
											<span class="comment-handle">{c.author.handle}</span>
											<time class="comment-time" datetime={c.createdAt}>
												{formatCommentTime(c.createdAt)}
											</time>
										</div>
										<p class="comment-body">{c.body}</p>
										{#if canDeleteComment(c.author.username, outfit.handle, auth.profile?.username)}
											<button
												type="button"
												class="comment-delete"
												disabled={deletingId === c.id}
												onclick={() => removeComment(c.id)}
											>
												{deletingId === c.id ? 'Deleting…' : 'Delete'}
											</button>
										{/if}
									</li>
								{/each}
							</ol>
							{#if commentTotal > comments.length}
								<p class="quiet-state">
									Showing {comments.length} of {commentTotal} comments.
								</p>
							{/if}
						{/if}
						{#if !auth.ready}
							<p class="quiet-state">Loading...</p>
						{:else if !auth.session}
							<p class="quiet-state">
								<a href={`/login?next=${encodeURIComponent(`/o/${outfit.id}`)}`}>
									Sign in to comment.
								</a>
							</p>
						{:else if auth.profile === null}
							<p class="quiet-state">
								<a href="/welcome">Finish setting up your profile first.</a>
							</p>
						{:else if auth.profile}
							<form
								class="composer"
								onsubmit={(e) => {
									e.preventDefault();
									submitComment();
								}}
							>
								<label class="composer-label" for="comment-box">
									Comment as @{auth.profile.username}
								</label>
								<textarea
									id="comment-box"
									bind:value={commentDraft}
									rows="3"
									placeholder="Share your thoughts…"
									disabled={posting}
								></textarea>
								<div class="composer-row">
									<span class="char-count" class:over={commentRunes > MAX_COMMENT_LEN}
										>{commentRunes}/{MAX_COMMENT_LEN}</span
									>
									<button
										type="submit"
										class="comment-submit"
										disabled={posting || !commentDraft.trim() || commentRunes > MAX_COMMENT_LEN}
									>
										{posting ? 'Posting…' : 'Post'}
									</button>
								</div>
							</form>
						{/if}
					{/if}
				</section>

				{#if poolReady}
					<section class="similar" aria-label="Similar looks">
						<h2 class="similar-title">Looks like this</h2>
						{#if similar.length > 0}
							<div class="similar-grid">
								{#each similar as item (item.id)}
									<OutfitCard outfit={item} {onopen} />
								{/each}
							</div>
						{:else}
							<p class="quiet-state">No similar looks yet — explore the feed for more ideas.</p>
						{/if}
					</section>
				{/if}
			</div>
		</div>
	{/if}
</article>

<style>
	.viewer-card {
		position: relative;
		width: 100%;
		max-width: 72rem;
		max-height: 90vh;
		background: var(--t-surface);
		border-radius: var(--t-radius);
		border: 1px solid var(--t-line);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		box-sizing: border-box;
		font-family: var(--t-font);
		color: var(--t-fg);
	}

	.close-button {
		position: absolute;
		top: 1rem;
		right: 1rem;
		z-index: 25;
		width: 2.25rem;
		height: 2.25rem;
		border-radius: 9999px;
		border: 1px solid var(--t-line);
		background: var(--t-surface);
		color: var(--t-fg);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		padding: 0;
		transition: background-color 0.15s ease, border-color 0.15s ease;
	}

	.close-button:hover {
		background: var(--t-tint);
		border-color: var(--t-muted);
	}

	.close-button:focus-visible {
		outline: 2px solid var(--t-accent);
		outline-offset: 2px;
	}

	.toast {
		position: absolute;
		bottom: 1.5rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 40;
		display: inline-flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.625rem 1rem;
		background: var(--t-surface);
		color: var(--t-fg);
		border: 1px solid var(--t-line);
		border-radius: var(--t-radius);
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
		font-size: 0.85rem;
		white-space: nowrap;
	}

	.toast-link {
		color: var(--t-accent);
		font-weight: 600;
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.toast-link:focus-visible {
		outline: 2px solid var(--t-accent);
		outline-offset: 2px;
	}

	.card-loading {
		display: flex;
		flex-direction: row;
		align-items: stretch;
		width: 100%;
		min-height: 24rem;
	}

	.skeleton-photo {
		flex: 1;
		min-height: 24rem;
		background: var(--t-tint);
		animation: pulse 1.6s ease-in-out infinite;
	}

	.skeleton-meta {
		width: 22rem;
		padding: 2.25rem 2rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		border-left: 1px solid var(--t-line);
	}

	.skeleton-line {
		height: 1rem;
		background: var(--t-tint);
		border-radius: var(--t-radius);
		animation: pulse 1.6s ease-in-out infinite;
	}

	.skeleton-title {
		height: 1.75rem;
		width: 75%;
	}

	.skeleton-creator {
		width: 45%;
	}

	.skeleton-caption {
		width: 90%;
	}

	.skeleton-caption-short {
		width: 60%;
	}

	.card-state {
		padding: 5rem 2rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1.25rem;
		text-align: center;
	}

	.state-message {
		font-size: 1rem;
		color: var(--t-muted);
		margin: 0;
	}

	.retry-btn {
		padding: 0.5rem 1.25rem;
		border-radius: var(--t-radius);
		border: 1px solid var(--t-line);
		background: var(--t-surface);
		color: var(--t-fg);
		font-size: 0.85rem;
		font-weight: 500;
		cursor: pointer;
		transition: background-color 0.15s ease, border-color 0.15s ease;
	}

	.retry-btn:hover {
		background: var(--t-tint);
		border-color: var(--t-muted);
	}

	.retry-btn:focus-visible {
		outline: 2px solid var(--t-accent);
		outline-offset: 2px;
	}

	.card-content {
		display: flex;
		flex-direction: row;
		align-items: stretch;
		width: 100%;
		max-height: 90vh;
		overflow: hidden;
	}

	.photo-pane {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.5rem;
		background: var(--t-bg);
		position: relative;
	}

	.photo-wrapper {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		max-width: 100%;
		max-height: 80vh;
	}

	.photo-frame {
		position: relative;
		display: inline-block;
		line-height: 0;
		max-height: 80vh;
		max-width: 100%;
		border-radius: var(--t-radius);
		overflow: hidden;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
	}

	.photo-img {
		display: block;
		max-height: 80vh;
		max-width: 100%;
		width: auto;
		height: auto;
		object-fit: contain;
		border-radius: var(--t-radius);
	}

	.photo-fallback {
		width: 100%;
		min-width: 18rem;
		max-width: 32rem;
		max-height: 80vh;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--t-radius);
		border: 1px solid var(--t-line);
		background: linear-gradient(
			160deg,
			var(--card-accent) 0%,
			color-mix(in srgb, var(--card-accent) 40%, var(--t-surface)) 100%
		);
	}

	.fallback-mark {
		font-size: 1.25rem;
		font-weight: 500;
		letter-spacing: 0.25em;
		text-transform: uppercase;
		color: #ffffff;
		opacity: 0.9;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
	}

	.piece-highlight {
		position: absolute;
		border: 1.5px solid var(--t-accent);
		background: color-mix(in srgb, var(--t-accent) 22%, transparent);
		border-radius: var(--t-radius);
		pointer-events: none;
		box-sizing: border-box;
		z-index: 2;
		transition: all 0.15s ease;
	}

	.category-strip {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.375rem;
		background: var(--t-surface);
		border: 1px solid var(--t-line);
		border-radius: 9999px;
		align-items: center;
		flex-shrink: 0;
		z-index: 5;
	}

	.strip-item {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.category-btn {
		width: 2.25rem;
		height: 2.25rem;
		border-radius: 9999px;
		border: 1px solid transparent;
		background: transparent;
		color: var(--t-fg);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		padding: 0;
		transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
	}

	.category-btn:hover:not(:disabled) {
		background: var(--t-tint);
		border-color: var(--t-line);
		transform: scale(1.05);
	}

	.category-btn:focus-visible {
		outline: 2px solid var(--t-accent);
		outline-offset: 2px;
	}

	.category-btn.saved {
		background: var(--t-fg);
		color: var(--t-bg);
		border-color: var(--t-fg);
	}

	.category-btn.saved:hover:not(:disabled) {
		background: var(--t-fg);
		color: var(--t-bg);
		opacity: 0.9;
	}

	.category-btn:disabled,
	.category-btn.dimmed {
		opacity: 0.25;
		cursor: not-allowed;
	}

	.tooltip {
		position: absolute;
		right: calc(100% + 8px);
		top: 50%;
		transform: translateY(-50%);
		background: var(--t-fg);
		color: var(--t-bg);
		padding: 0.25rem 0.5rem;
		border-radius: var(--t-radius);
		font-size: 0.75rem;
		font-weight: 500;
		white-space: nowrap;
		pointer-events: none;
		z-index: 30;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
	}

	.meta-pane {
		width: 22rem;
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		padding: 2.25rem 2rem;
		border-left: 1px solid var(--t-line);
		background: var(--t-surface);
		overflow-y: auto;
		box-sizing: border-box;
	}

	.meta-header {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.outfit-title {
		font-size: 1.35rem;
		font-weight: 500;
		line-height: 1.3;
		margin: 0;
		color: var(--t-fg);
		letter-spacing: -0.01em;
	}

	.ai-badge {
		display: inline-block;
		font-size: 0.68rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--t-fg);
		border: 1px solid var(--t-line);
		border-radius: 9999px;
		padding: 0.1rem 0.5rem;
		margin-top: 0.35rem;
		opacity: 0.75;
	}

	.creator-link {
		display: inline-flex;
		align-items: center;
		gap: 0.625rem;
		text-decoration: none;
		color: inherit;
		width: fit-content;
	}

	.creator-link:hover .creator-name {
		text-decoration: underline;
	}

	.creator-link:focus-visible {
		outline: 2px solid var(--t-accent);
		outline-offset: 2px;
		border-radius: var(--t-radius);
	}

	.creator-avatar {
		width: 1.75rem;
		height: 1.75rem;
		border-radius: 9999px;
		background: var(--avatar-accent, var(--t-tint));
		color: #ffffff;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		flex-shrink: 0;
	}

	.creator-info {
		display: flex;
		flex-direction: column;
		font-size: 0.8rem;
		line-height: 1.25;
	}

	.creator-name {
		font-weight: 500;
		color: var(--t-fg);
	}

	.creator-handle {
		color: var(--t-muted);
		font-size: 0.75rem;
	}

	.caption {
		font-size: 0.9rem;
		line-height: 1.5;
		color: var(--t-fg);
		margin: 0;
		opacity: 0.9;
	}

	.tags {
		font-size: 0.8rem;
		color: var(--t-muted);
		line-height: 1.4;
		margin: 0;
		font-family: var(--t-font);
	}

	.meta-footer {
		margin-top: auto;
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
		padding-top: 1.25rem;
		border-top: 1px solid var(--t-line);
	}

	.counts-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		font-size: 0.85rem;
		color: var(--t-muted);
	}

	.actions-row {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		flex-wrap: wrap;
		position: relative;
	}

	.save-look-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.5rem 0.875rem;
		border-radius: var(--t-radius);
		border: 1px solid var(--t-line);
		background: var(--t-surface);
		color: var(--t-fg);
		font-size: 0.85rem;
		font-weight: 500;
		cursor: pointer;
		transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
	}

	.save-look-btn:hover {
		background: var(--t-tint);
		border-color: var(--t-muted);
	}

	.save-look-btn.saved {
		background: var(--t-fg);
		color: var(--t-bg);
		border-color: var(--t-fg);
	}

	.save-look-btn:focus-visible {
		outline: 2px solid var(--t-accent);
		outline-offset: 2px;
	}

	.share-btn {
		display: inline-flex;
		align-items: center;
		padding: 0.5rem 0.875rem;
		border-radius: var(--t-radius);
		border: 1px solid var(--t-line);
		background: var(--t-surface);
		color: var(--t-fg);
		font-size: 0.85rem;
		font-weight: 500;
		cursor: pointer;
		transition: background-color 0.15s ease, border-color 0.15s ease;
	}

	.share-btn:hover {
		background: var(--t-tint);
		border-color: var(--t-muted);
	}

	.share-btn:focus-visible {
		outline: 2px solid var(--t-accent);
		outline-offset: 2px;
	}

	.copy-notice {
		font-size: 0.8rem;
		color: var(--t-muted);
		animation: fadeIn 0.2s ease;
	}

	.comments {
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
		padding-top: 1.25rem;
		border-top: 1px solid var(--t-line);
	}

	.comments-title {
		font-size: 0.95rem;
		font-weight: 600;
		margin: 0;
		color: var(--t-fg);
	}

	.similar {
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
		padding-top: 1.25rem;
		border-top: 1px solid var(--t-line);
	}

	.similar-title {
		font-size: 0.95rem;
		font-weight: 600;
		margin: 0;
		color: var(--t-fg);
	}

	.similar-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.75rem;
		align-items: start;
	}

	.similar-grid :global(.outfit-card) {
		margin-bottom: 0;
	}

	.quiet-state {
		font-size: 0.85rem;
		color: var(--t-muted);
		margin: 0;
		line-height: 1.5;
	}

	.quiet-state a {
		color: var(--t-accent);
		text-underline-offset: 2px;
	}

	.error-region {
		font-size: 0.85rem;
		color: #b3261e;
		background: color-mix(in srgb, #b3261e 8%, var(--t-surface));
		border: 1px solid color-mix(in srgb, #b3261e 30%, var(--t-line));
		border-radius: var(--t-radius);
		padding: 0.5rem 0.75rem;
		margin: 0;
		line-height: 1.4;
	}

	.comment-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
	}

	.comment {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		padding-bottom: 0.875rem;
		border-bottom: 1px solid var(--t-line);
	}

	.comment:last-child {
		border-bottom: none;
		padding-bottom: 0;
	}

	.comment-head {
		display: flex;
		align-items: baseline;
		gap: 0.4rem;
		flex-wrap: wrap;
	}

	.comment-author {
		font-size: 0.82rem;
		font-weight: 600;
		color: var(--t-fg);
		text-decoration: none;
	}

	.comment-author:hover {
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.comment-handle,
	.comment-time {
		font-size: 0.75rem;
		color: var(--t-muted);
	}

	.comment-time {
		margin-left: auto;
	}

	.comment-body {
		font-size: 0.87rem;
		line-height: 1.5;
		color: var(--t-fg);
		margin: 0;
		overflow-wrap: anywhere;
		white-space: pre-wrap;
	}

	.comment-delete {
		align-self: flex-start;
		padding: 0.15rem 0;
		border: none;
		background: none;
		color: var(--t-muted);
		font-size: 0.75rem;
		cursor: pointer;
	}

	.comment-delete:hover:not(:disabled) {
		color: var(--t-fg);
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.comment-delete:disabled {
		opacity: 0.5;
		cursor: wait;
	}

	.composer {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.composer-label {
		font-size: 0.78rem;
		color: var(--t-muted);
	}

	.composer textarea {
		resize: vertical;
		min-height: 4.25rem;
		padding: 0.6rem 0.75rem;
		border-radius: var(--t-radius);
		border: 1px solid var(--t-line);
		background: var(--t-bg);
		color: var(--t-fg);
		font: inherit;
		font-size: 0.87rem;
		line-height: 1.5;
	}

	.composer textarea:focus-visible {
		outline: 2px solid var(--t-accent);
		outline-offset: 1px;
	}

	.composer-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.625rem;
	}

	.char-count {
		font-size: 0.75rem;
		color: var(--t-muted);
	}

	.char-count.over {
		color: #b3261e;
		font-weight: 600;
	}

	.comment-submit {
		padding: 0.45rem 1rem;
		border-radius: var(--t-radius);
		border: 1px solid var(--t-fg);
		background: var(--t-fg);
		color: var(--t-bg);
		font-size: 0.82rem;
		font-weight: 600;
		cursor: pointer;
	}

	.comment-submit:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.comment-submit:focus-visible,
	.comment-delete:focus-visible,
	.comment-author:focus-visible,
	.quiet-state a:focus-visible {
		outline: 2px solid var(--t-accent);
		outline-offset: 2px;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 0.5;
		}
		50% {
			opacity: 0.9;
		}
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@media (max-width: 860px) {
		.viewer-card {
			max-height: none;
			height: auto;
		}

		.card-content {
			flex-direction: column;
			max-height: none;
		}

		.photo-pane {
			padding: 1.25rem 1rem;
			flex: none;
		}

		.photo-wrapper {
			flex-direction: column;
			gap: 0.75rem;
			max-height: none;
		}

		.photo-frame {
			max-height: 55vh;
		}

		.photo-img {
			max-height: 55vh;
		}

		.photo-fallback {
			max-height: 55vh;
		}

		.category-strip {
			flex-direction: row;
			padding: 0.375rem 0.5rem;
		}

		.tooltip {
			left: 50%;
			top: auto;
			bottom: calc(100% + 8px);
			transform: translateX(-50%);
		}

		.meta-pane {
			width: 100%;
			border-left: none;
			border-top: 1px solid var(--t-line);
			padding: 1.5rem 1.25rem;
			overflow-y: visible;
		}

		.similar-grid {
			grid-template-columns: 1fr;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.category-btn,
		.save-look-btn,
		.share-btn,
		.close-button,
		.retry-btn,
		.piece-highlight,
		.skeleton-photo,
		.skeleton-line {
			transition: none !important;
			transform: none !important;
			animation: none !important;
		}
	}
</style>
