import { createContext } from 'svelte';
import { Derived } from '$lib/reactivity/derived.svelte.js';
import { SvelteMap } from 'svelte/reactivity';

type LikesContext = ReturnType<typeof createLikesContext>;

const [useLikes, setLikesInternal] = createContext<LikesContext>();
export { useLikes };

/**
 * Persists a like and reports the authoritative state back, standing in for the real
 * `toggleLike` remote function. Only the landing demo supplies one: its gifts are
 * fixtures with no database row, so they need their own slug-keyed endpoint.
 */
export type ToggleLikeOverride = (giftId: string) => Promise<{ liked: boolean; likeCount: number }>;

export function setLikesContext(
	getLikedIds: () => string[],
	isAuthenticated: () => boolean,
	onRequireAuth: () => void,
	toggleLike?: ToggleLikeOverride,
) {
	const context = createLikesContext(getLikedIds, isAuthenticated, onRequireAuth, toggleLike);
	setLikesInternal(context);
	return context;
}

function createLikesContext(
	getLikedIds: () => string[],
	isAuthenticated: () => boolean,
	onRequireAuth: () => void,
	toggleLike: ToggleLikeOverride | undefined,
) {
	const baseLikedIds = new Derived(() => new Set(getLikedIds()));
	const overrides = new SvelteMap<string, boolean>();

	function isLiked(giftId: string): boolean {
		const override = overrides.get(giftId);
		if (override !== undefined) {
			return override;
		}
		return baseLikedIds.current.has(giftId);
	}

	function optimisticToggle(giftId: string): boolean {
		const wasLiked = isLiked(giftId);
		overrides.set(giftId, !wasLiked);
		return !wasLiked;
	}

	function revertToggle(giftId: string, wasLiked: boolean) {
		void wasLiked;
		overrides.delete(giftId);
	}

	return {
		baseLikedIds,
		overrides,
		isLiked,
		optimisticToggle,
		revertToggle,
		/** Whether the current visitor is logged in (likes require an account). */
		isAuthenticated,
		/** Invoked when an anonymous visitor attempts to like – prompts them to log in. */
		requireAuth: onRequireAuth,
		/** Optional stand-in for the real `toggleLike` remote function; see the type. */
		toggleLike,
	};
}
