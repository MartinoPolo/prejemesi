export interface PriorityLevelLoaderState {
	ownerWishlistId: string | null;
	loadedWishlistId: string | null;
	requestedWishlistId: string | null;
	loadPromise: Promise<void> | null;
}

export function settlePriorityLevelLoad(
	state: PriorityLevelLoaderState,
	wishlistId: string,
	succeeded: boolean,
): PriorityLevelLoaderState {
	if (state.ownerWishlistId !== wishlistId || state.requestedWishlistId !== wishlistId) {
		return state;
	}

	return {
		...state,
		loadedWishlistId: succeeded ? wishlistId : null,
		requestedWishlistId: succeeded ? wishlistId : null,
		loadPromise: null,
	};
}

export function resetPriorityLevelLoaderForWishlistChange(
	state: PriorityLevelLoaderState,
	nextWishlistId: string,
): PriorityLevelLoaderState {
	if (state.ownerWishlistId === nextWishlistId) {
		return state;
	}

	return {
		ownerWishlistId: nextWishlistId,
		loadedWishlistId: null,
		requestedWishlistId: null,
		loadPromise: null,
	};
}
