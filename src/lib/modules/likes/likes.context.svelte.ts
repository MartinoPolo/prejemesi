import { createContext } from 'svelte';
import { StateRaw } from '$lib/reactivity/state.svelte.js';

type LikesContext = ReturnType<typeof createLikesContext>;

const [useLikes, setLikesInternal] = createContext<LikesContext>();
export { useLikes };

export function setLikesContext(initialLikedGiftIds: string[]) {
	const context = createLikesContext(initialLikedGiftIds);
	setLikesInternal(context);
	return context;
}

function createLikesContext(initialLikedGiftIds: string[]) {
	const likedGiftIds = new StateRaw<Set<string>>(new Set(initialLikedGiftIds));

	function isLiked(giftId: string): boolean {
		return likedGiftIds.current.has(giftId);
	}

	/** Optimistic toggle — returns the new liked state */
	function optimisticToggle(giftId: string): boolean {
		const currentSet = new Set(likedGiftIds.current);
		const wasLiked = currentSet.has(giftId);

		if (wasLiked) {
			currentSet.delete(giftId);
		} else {
			currentSet.add(giftId);
		}

		likedGiftIds.current = currentSet;
		return !wasLiked;
	}

	/** Revert optimistic toggle on error */
	function revertToggle(giftId: string, wasLiked: boolean) {
		const currentSet = new Set(likedGiftIds.current);

		if (wasLiked) {
			currentSet.add(giftId);
		} else {
			currentSet.delete(giftId);
		}

		likedGiftIds.current = currentSet;
	}

	return {
		likedGiftIds,
		isLiked,
		optimisticToggle,
		revertToggle,
	};
}
