import { createContext } from 'svelte';
import { StateRaw } from '$lib/reactivity/state.svelte.js';
import { Derived } from '$lib/reactivity/derived.svelte.js';
import type { Wishlist } from './types.js';

type WishlistsContext = ReturnType<typeof createWishlistsContext>;

const [useWishlists, setWishlistsInternal] = createContext<WishlistsContext>();
export { useWishlists };

export function setWishlistsContext(initialWishlists: Wishlist[] = []) {
	const ctx = createWishlistsContext(initialWishlists);
	setWishlistsInternal(ctx);
	return ctx;
}

function createWishlistsContext(initialWishlists: Wishlist[]) {
	const wishlists = new StateRaw<Wishlist[]>(initialWishlists);
	const isCreateModalOpen = new StateRaw(false);

	const draftWishlists = new Derived(() => wishlists.current.filter((w) => w.status === 'draft'));
	const activeWishlists = new Derived(() =>
		wishlists.current.filter((w) => w.status === 'active'),
	);
	const archivedWishlists = new Derived(() =>
		wishlists.current.filter((w) => w.status === 'archived'),
	);

	function addWishlist(wishlist: Wishlist) {
		wishlists.current = [...wishlists.current, wishlist];
	}

	function updateWishlist(updated: Wishlist) {
		wishlists.current = wishlists.current.map((w) => (w.id === updated.id ? updated : w));
	}

	function removeWishlist(id: string) {
		wishlists.current = wishlists.current.filter((w) => w.id !== id);
	}

	function openCreateModal() {
		isCreateModalOpen.current = true;
	}

	function closeCreateModal() {
		isCreateModalOpen.current = false;
	}

	return {
		wishlists: wishlists.readonly(),
		draftWishlists,
		activeWishlists,
		archivedWishlists,
		isCreateModalOpen,
		addWishlist,
		updateWishlist,
		removeWishlist,
		openCreateModal,
		closeCreateModal,
	};
}
