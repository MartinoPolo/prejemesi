import { createContext } from 'svelte';
import { Derived } from '$lib/reactivity/derived.svelte.js';
import { SvelteMap } from 'svelte/reactivity';

type LikesContext = ReturnType<typeof createLikesContext>;

const [useLikes, setLikesInternal] = createContext<LikesContext>();
export { useLikes };

export function setLikesContext(
	getLikedIds: () => string[],
	isAuthenticated: () => boolean,
	onRequireAuth: () => void,
) {
	const context = createLikesContext(getLikedIds, isAuthenticated, onRequireAuth);
	setLikesInternal(context);
	return context;
}

function createLikesContext(
	getLikedIds: () => string[],
	isAuthenticated: () => boolean,
	onRequireAuth: () => void,
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
	};
}
