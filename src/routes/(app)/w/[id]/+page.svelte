<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import WishlistHeader from '$lib/components/blocks/gift/WishlistHeader.svelte';
	import WishlistDetailToolbar from '$lib/components/blocks/wishlist/WishlistDetailToolbar.svelte';
	import WishlistGiftDisplay from '$lib/components/blocks/wishlist/WishlistGiftDisplay.svelte';
	import WishlistModals from '$lib/components/blocks/wishlist/WishlistModals.svelte';
	import { setGiftsContext } from '$lib/modules/gifts/gifts.context.svelte.js';
	import { setLikesContext } from '$lib/modules/likes/likes.context.svelte.js';
	import { setSharingContext } from '$lib/modules/sharing/sharing.context.svelte.js';
	import { setWishlistThemeContext } from '$lib/modules/themes/themes.context.svelte.js';
	import { applyWishlistTheme, removeWishlistTheme } from '$lib/modules/themes/apply_theme.js';
	import { isCustomTheme, toWishlistTheme } from '$lib/modules/themes/types.js';
	import type { WishlistTheme } from '$lib/modules/themes/types.js';
	import {
		getWishlistByShortId,
		updateWishlist,
		archiveWishlist,
		unfollowWishlist,
		followWishlist,
	} from '$lib/modules/wishlists/wishlists.remote.js';
	import { getGiftsByWishlistShortId } from '$lib/modules/gifts/gifts.remote.js';
	import { getUserLikesForWishlist } from '$lib/modules/likes/likes.remote.js';
	import { reserveGift } from '$lib/modules/reservations/reservations.remote.js';
	import type { ReserveGiftInput } from '$lib/modules/reservations/types.js';
	import type { Wishlist, WishlistRole } from '$lib/modules/wishlists/types.js';
	import { untrack } from 'svelte';
	import { toastSuccess, toastError } from '$lib/components/base/toast/index.js';
	import { translateServerError } from '$lib/modules/errors/translate_server_error.js';
	import {
		createGift,
		updateGift as updateGiftRemote,
		deleteGift,
		reorderGifts,
		markGiftReceived,
		getPriorityLevels,
	} from '$lib/modules/gifts/gifts.remote.js';
	import type {
		GiftFilters,
		GiftSortOption,
		GiftForVisitor,
		GiftByRole,
		GiftPriorityLevel,
		CreateGiftInput,
		UpdateGiftInput,
		GiftViewMode,
	} from '$lib/modules/gifts/types.js';

	let { data } = $props();

	const shortId = $derived(page.params.id!);
	// Capture auth state before top-level await so Svelte doesn't warn about
	// reading reactive $props in an initialization block.
	const initialUser = untrack(() => data.user);
	const isAuthenticated = $derived(data.user !== null);

	// ── Reactive state (declared before await for synchronous context setup) ─

	let wishlist = $state<Wishlist & { ownerName: string; role: WishlistRole }>(undefined!);
	let gifts = $state<GiftByRole[]>([]);
	let role = $state<WishlistRole>('visitor');
	let likedGiftIds = $state.raw<string[]>([]);

	// ── Context setup (must be synchronous — before any await) ───────────────

	const giftsContext = untrack(() =>
		setGiftsContext(
			() => gifts,
			() => role,
			() => wishlist.status === 'archived',
		),
	);

	untrack(() => setLikesContext(() => likedGiftIds));

	const sharingContext = untrack(() =>
		setSharingContext(
			() => wishlist.shortId,
			() => wishlist.sharedAt !== null,
		),
	);

	const themeContext = untrack(() =>
		setWishlistThemeContext(() => toWishlistTheme(wishlist.theme, wishlist.customThemeColor)),
	);

	// ── Derived values ───────────────────────────────────────────────────────

	const isArchived = $derived(wishlist.status === 'archived');
	const isOwner = $derived(role === 'owner');
	const isModerator = $derived(role === 'moderator');
	const isOwnerOrModerator = $derived(role === 'owner' || role === 'moderator');
	const wishlistStatus = $derived(wishlist.status as 'draft' | 'active' | 'archived');
	const ownerIsModeratorLocal = $derived(wishlist.ownerIsModerator);

	// ── Remote data fetch ────────────────────────────────────────────────────

	const [wishlistData, giftsData] = await Promise.all([
		getWishlistByShortId(shortId),
		getGiftsByWishlistShortId(shortId),
	]);

	wishlist = wishlistData;
	gifts = giftsData.gifts;
	role = giftsData.role;

	if (initialUser !== null) {
		try {
			likedGiftIds = await getUserLikesForWishlist();
		} catch {
			// Guarded calls may fail for unauthenticated users — ignore
		}
	}

	// ── Refresh function ─────────────────────────────────────────────────────

	async function refreshData() {
		try {
			const [freshWishlist, freshGifts] = await Promise.all([
				getWishlistByShortId(shortId),
				getGiftsByWishlistShortId(shortId),
			]);
			wishlist = freshWishlist;
			gifts = freshGifts.gifts;
			role = freshGifts.role;
			if (isAuthenticated) {
				try {
					likedGiftIds = await getUserLikesForWishlist();
				} catch {
					// ignore
				}
			}
		} catch (thrown) {
			console.error('Failed to refresh wishlist data:', thrown);
		}
	}

	// ── Modal state ──────────────────────────────────────────────────────────

	let moderatorPanelOpen = $state(false);
	let giftModalOpen = $state(false);
	let giftModalMode = $state<'create' | 'edit'>('create');
	let selectedGift = $state<GiftByRole | null>(null);
	let priorityLevels = $state.raw<GiftPriorityLevel[]>([]);
	let isSubmitting = $state(false);
	let isDeleting = $state(false);

	// ── Theme selector dialog state ──────────────────────────────────────────

	let themeDialogOpen = $state(false);

	// ── Drag-and-drop state ──────────────────────────────────────────────────

	let draggedIndex = $state<number | null>(null);
	let dragOverIndex = $state<number | null>(null);

	// ── Reservation modal state ───────────────────────────────────────────────

	let reserveModalOpen = $state(false);
	let reservingGift = $state<GiftForVisitor | null>(null);
	let isReserving = $state(false);

	// ── Theme application via $effect ─────────────────────────────────────────

	let themeWrapperElement = $state<HTMLElement | null>(null);

	$effect(() => {
		if (themeWrapperElement === null) {
			return;
		}
		const theme = themeContext.effectiveTheme.current;
		applyWishlistTheme(themeWrapperElement, theme);
		return () => {
			if (themeWrapperElement !== null) {
				removeWishlistTheme(themeWrapperElement);
			}
		};
	});

	// ── Re-fetch on route param change ───────────────────────────────────────

	let lastLoadedId = shortId;

	$effect(() => {
		if (shortId === lastLoadedId) {
			return;
		}
		lastLoadedId = shortId;
		void refreshData();
	});

	// ── Gift display ─────────────────────────────────────────────────────────

	const displayedGifts = $derived(giftsContext.sortedAndFilteredGifts.current);
	const viewMode = $derived(giftsContext.viewMode.current);
	const totalCount = $derived(giftsContext.giftCount.current);
	const hasActiveFilters = $derived(giftsContext.hasActiveFilters.current);
	const isFilteredEmpty = $derived(displayedGifts.length === 0 && totalCount > 0);
	const isEmpty = $derived(totalCount === 0);

	// ── Computed: can user edit/delete the selected gift? ────────────────────

	const canEditSelectedGift = $derived.by(() => {
		if (selectedGift === null) {
			return false;
		}
		if (isModerator) {
			return true;
		}
		if (isOwner) {
			if (wishlist.sharedAt !== null) {
				return new Date(selectedGift.createdAt) > new Date(wishlist.sharedAt);
			}
			return true;
		}
		return false;
	});

	const canDeleteSelectedGift = $derived.by(() => {
		if (!canEditSelectedGift) {
			return false;
		}
		if (
			'reservedCount' in selectedGift! &&
			(selectedGift as { reservedCount: number }).reservedCount > 0
		) {
			return false;
		}
		return true;
	});

	// ── Event handlers ───────────────────────────────────────────────────────

	function handleModeratorsOpened() {
		moderatorPanelOpen = true;
	}

	async function handleSelfPromoted() {
		await refreshData();
	}

	function handleShareOpened() {
		sharingContext.openWizard();
	}

	function handleShared() {
		void refreshData();
	}

	function handleViewModeChange(mode: GiftViewMode) {
		giftsContext.viewMode.current = mode;
	}

	function handleSortChange(sort: GiftSortOption) {
		giftsContext.sortOption.current = sort;
	}

	function handleFilterChange(filters: GiftFilters) {
		giftsContext.filters.current = filters;
	}

	function clearFilters() {
		giftsContext.filters.current = { availableOnly: false, withLinkOnly: false };
	}

	async function openCreateModal() {
		await loadPriorityLevels();
		giftModalMode = 'create';
		selectedGift = null;
		giftModalOpen = true;
	}

	async function openEditModal(gift: GiftByRole) {
		if (!isOwnerOrModerator) {
			return;
		}
		await loadPriorityLevels();
		giftModalMode = 'edit';
		selectedGift = gift;
		giftModalOpen = true;
	}

	async function loadPriorityLevels() {
		try {
			priorityLevels = await getPriorityLevels(wishlist.id);
		} catch {
			priorityLevels = [];
		}
	}

	async function handleCreate(input: CreateGiftInput) {
		isSubmitting = true;
		try {
			await createGift(input);
			giftModalOpen = false;
			await refreshData();
		} catch (thrown) {
			console.error('Failed to create gift:', thrown);
		} finally {
			isSubmitting = false;
		}
	}

	async function handleUpdate(input: UpdateGiftInput) {
		isSubmitting = true;
		try {
			await updateGiftRemote(input);
			giftModalOpen = false;
			await refreshData();
		} catch (thrown) {
			console.error('Failed to update gift:', thrown);
		} finally {
			isSubmitting = false;
		}
	}

	async function handleDelete(giftId: string) {
		isDeleting = true;
		try {
			await deleteGift(giftId);
			giftModalOpen = false;
			await refreshData();
		} catch (thrown) {
			console.error('Failed to delete gift:', thrown);
		} finally {
			isDeleting = false;
		}
	}

	async function handleReceived(giftId: string, received: boolean) {
		try {
			await markGiftReceived({ giftId, received });
			await refreshData();
		} catch (thrown) {
			console.error('Failed to toggle received:', thrown);
		}
	}

	function handleGiftModalClose() {
		giftModalOpen = false;
		selectedGift = null;
	}

	async function handleUnfollow() {
		try {
			await unfollowWishlist(wishlist.id);
			toastSuccess(m.toast_unfollowed());
		} catch (thrown) {
			console.error('Failed to unfollow:', thrown);
			toastError(m.toast_unfollow_error());
		}
	}

	// ── Archive handler ───────────────────────────────────────────────────────

	async function handleArchive() {
		const confirmed = confirm(m.wishlist_archive_confirm_description());
		if (!confirmed) {
			return;
		}
		try {
			await archiveWishlist(wishlist.id);
			toastSuccess(m.toast_wishlist_archived());
			await refreshData();
		} catch (thrown) {
			console.error('Failed to archive wishlist:', thrown);
			toastError(m.toast_wishlist_archive_error());
		}
	}

	// ── Theme handlers ────────────────────────────────────────────────────────

	function handleThemePreview(theme: WishlistTheme) {
		themeContext.startPreview(theme);
	}

	function handleThemeCancel() {
		themeContext.cancelPreview();
		themeDialogOpen = false;
	}

	async function handleThemeSave(theme: WishlistTheme) {
		try {
			const themePreset = isCustomTheme(theme) ? 'custom' : theme;
			const customThemeColor = isCustomTheme(theme) ? theme.color : null;

			await updateWishlist({
				id: wishlist.id,
				theme: themePreset,
				customThemeColor,
			});

			wishlist.theme = themePreset;
			wishlist.customThemeColor = customThemeColor;
			themeContext.cancelPreview();
			themeDialogOpen = false;
			toastSuccess(m.toast_theme_saved());
		} catch (thrown) {
			console.error('Failed to save theme:', thrown);
			toastError(m.toast_theme_save_error());
		}
	}

	function handleThemeDialogOpenChange(open: boolean) {
		if (!open) {
			themeContext.cancelPreview();
		}
	}

	// ── Drag-and-drop handlers ────────────────────────────────────────────────

	function handleDragStart(event: DragEvent, index: number) {
		if (!isOwnerOrModerator) {
			return;
		}
		draggedIndex = index;
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'move';
			event.dataTransfer.setData('text/plain', String(index));
		}
	}

	function handleDragOver(event: DragEvent, index: number) {
		event.preventDefault();
		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = 'move';
		}
		dragOverIndex = index;
	}

	function handleDragLeave() {
		dragOverIndex = null;
	}

	async function handleDrop(event: DragEvent, dropIndex: number) {
		event.preventDefault();
		if (draggedIndex === null || draggedIndex === dropIndex) {
			draggedIndex = null;
			dragOverIndex = null;
			return;
		}

		const items = [...giftsContext.effectiveGifts.current];
		const [movedItem] = items.splice(draggedIndex, 1);
		if (movedItem === undefined) {
			draggedIndex = null;
			dragOverIndex = null;
			return;
		}
		items.splice(dropIndex, 0, movedItem);
		giftsContext.reorderGifts(items);

		draggedIndex = null;
		dragOverIndex = null;

		try {
			const reorderItems = items.map((item, index) => ({
				id: item.id,
				sortOrder: index,
			}));
			await reorderGifts(reorderItems);
			giftsContext.clearReorderOverride();
			await refreshData();
		} catch (thrown) {
			console.error('Failed to reorder gifts:', thrown);
			giftsContext.clearReorderOverride();
			await refreshData();
		}
	}

	function handleDragEnd() {
		draggedIndex = null;
		dragOverIndex = null;
	}

	// ── Reservation handlers ──────────────────────────────────────────────────

	function handleOpenReserveModal(giftItem: GiftForVisitor) {
		reservingGift = giftItem;
		reserveModalOpen = true;
	}

	function handleReserveModalClose() {
		reserveModalOpen = false;
		reservingGift = null;
	}

	async function handleReserve(input: ReserveGiftInput) {
		isReserving = true;
		try {
			await reserveGift(input);
			reserveModalOpen = false;
			reservingGift = null;
			toastSuccess(m.toast_gift_reserved());
			await refreshData();
		} catch (thrown) {
			toastError(translateServerError(thrown));
		} finally {
			isReserving = false;
		}
	}

	// ── Lifecycle: auto-follow on mount ───────────────────────────────────────

	onMount(async () => {
		if (isAuthenticated) {
			try {
				await followWishlist(wishlist.id);
			} catch {
				// Auto-follow failure is non-critical — ignore
			}
		}
	});
</script>

<div bind:this={themeWrapperElement} class="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
	<WishlistHeader
		title={wishlist.title}
		ownerName={wishlist.ownerName}
		description={wishlist.description}
		bannerImageKey={wishlist.bannerImageKey}
		eventDate={wishlist.eventDate}
		status={wishlistStatus}
		{role}
		giftCount={totalCount}
		ownerIsModerator={ownerIsModeratorLocal}
		themeGradient={themeContext.effectiveGradient.current}
		onshare={handleShareOpened}
		onmoderators={handleModeratorsOpened}
		onarchive={handleArchive}
	/>

	<WishlistDetailToolbar
		{isOwner}
		{isArchived}
		{isOwnerOrModerator}
		{viewMode}
		sortOption={giftsContext.sortOption.current}
		filters={giftsContext.filters.current}
		{hasActiveFilters}
		onviewmodechange={handleViewModeChange}
		onsortchange={handleSortChange}
		onfilterchange={handleFilterChange}
		onthemeopen={() => (themeDialogOpen = true)}
		onunfollow={handleUnfollow}
		onaddgift={openCreateModal}
	/>

	<WishlistGiftDisplay
		gifts={displayedGifts}
		{role}
		{isArchived}
		{isOwner}
		{isOwnerOrModerator}
		{viewMode}
		{isEmpty}
		{isFilteredEmpty}
		{draggedIndex}
		{dragOverIndex}
		onedit={openEditModal}
		onreserve={handleOpenReserveModal}
		onaddgift={openCreateModal}
		onclearfilters={clearFilters}
		ondragstart={handleDragStart}
		ondragover={handleDragOver}
		ondragleave={handleDragLeave}
		ondrop={handleDrop}
		ondragend={handleDragEnd}
	/>
</div>

<WishlistModals
	{isOwner}
	{isOwnerOrModerator}
	{isAuthenticated}
	wishlistId={wishlist.id}
	wishlistTitle={wishlist.title}
	giftCount={totalCount}
	ownerIsModerator={ownerIsModeratorLocal}
	bind:giftModalOpen
	{giftModalMode}
	{selectedGift}
	{priorityLevels}
	{canDeleteSelectedGift}
	{isSubmitting}
	{isDeleting}
	bind:reserveModalOpen
	{reservingGift}
	{isReserving}
	bind:themeDialogOpen
	activeTheme={themeContext.activeTheme.current}
	bind:moderatorPanelOpen
	ongiftmodalclose={handleGiftModalClose}
	oncreate={handleCreate}
	onupdate={handleUpdate}
	ondelete={handleDelete}
	onreceived={handleReceived}
	onreservemodalclose={handleReserveModalClose}
	onreserve={handleReserve}
	onshared={handleShared}
	onthemedialogopenchange={handleThemeDialogOpenChange}
	onthemepreview={handleThemePreview}
	onthemesave={handleThemeSave}
	onthemecancel={handleThemeCancel}
	onmoderatorselfpromoted={handleSelfPromoted}
/>

<!-- OpenGraph Meta Tags -->
<svelte:head>
	<title>{wishlist.title} — Darecky</title>
	<meta property="og:title" content={wishlist.title} />
	<meta property="og:description" content="Seznam prani od {wishlist.ownerName}" />
	<meta property="og:type" content="website" />
	<meta
		property="og:url"
		content="{typeof window !== 'undefined' ? window.location.origin : ''}/w/{wishlist.shortId}"
	/>
	{#if wishlist.thumbnailImageKey}
		<meta property="og:image" content={wishlist.thumbnailImageKey} />
	{/if}
</svelte:head>
