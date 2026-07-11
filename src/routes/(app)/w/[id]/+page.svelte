<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { localizeInternalHref } from '$lib/i18n/locale.js';
	import { onMount } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import WishlistHeader from '$lib/components/blocks/gift/WishlistHeader.svelte';
	import WishlistDetailToolbar from '$lib/components/blocks/wishlist/WishlistDetailToolbar.svelte';
	import WishlistGiftDisplay from '$lib/components/blocks/wishlist/WishlistGiftDisplay.svelte';
	import WishlistModals from '$lib/components/blocks/wishlist/WishlistModals.svelte';
	import ImportWizard from '$lib/components/blocks/import/ImportWizard.svelte';
	import { WIZARD_MODE } from '$lib/components/blocks/import/import_wizard_types.js';
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
	import { refreshWishlistDashboards } from '$lib/modules/wishlists/dashboard_refresh.js';
	import { getGiftsByWishlistShortId } from '$lib/modules/gifts/gifts.remote.js';
	import { getUserLikesForWishlist } from '$lib/modules/likes/likes.remote.js';
	import { reserveGift, unreserveGift } from '$lib/modules/reservations/reservations.remote.js';
	import type { ReserveGiftInput } from '$lib/modules/reservations/types.js';
	import type { Wishlist, WishlistRole } from '$lib/modules/wishlists/types.js';
	import { canManageWishlist } from '$lib/modules/wishlists/wishlist_capabilities.js';
	import {
		getThemePreset,
		type DashboardWishlistTheme,
	} from '$lib/modules/wishlists/wishlist_theme.js';
	import { wishlistImageUrl } from '$lib/modules/images/index.js';
	import { SITE_URL, SOCIAL_PREVIEW_IMAGE_URL } from '$lib/config/site.js';
	import { untrack } from 'svelte';
	import { toastSuccess, toastError } from '$lib/components/base/toast/index.js';
	import {
		translateServerError,
		getServerErrorCode,
	} from '$lib/modules/errors/translate_server_error.js';
	import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
	import {
		createGift,
		updateGift as updateGiftRemote,
		deleteGift,
		reorderGifts,
		markGiftReceived,
		getPriorityLevels,
	} from '$lib/modules/gifts/gifts.remote.js';
	import { importGifts } from '$lib/modules/import/import.remote.js';
	import {
		ownerSharedGiftDeleteGraceExpiresAt,
		preShareOwnerFullEditGraceExpiresAt,
	} from '$lib/modules/gifts/gift_deletion_rules.js';
	import type {
		GiftFilters,
		GiftSortOption,
		GiftForVisitor,
		GiftByRole,
		GiftPriorityLevel,
		GiftDraftInput,
		CreateGiftInput,
		UpdateGiftInput,
		GiftViewMode,
	} from '$lib/modules/gifts/types.js';

	let { data } = $props();

	const shortId = $derived(page.params.id!);
	const isAuthenticated = $derived(data.user !== null);

	// ── Reactive state (declared before await for synchronous context setup) ─

	let wishlist = $state<
		Wishlist & { recipientDisplayName: string; managerNames: string[]; role: WishlistRole }
	>(undefined!);
	let gifts = $state<GiftByRole[]>([]);
	let role = $state<WishlistRole>('visitor');
	let likedGiftIds = $state.raw<string[]>([]);
	let isGiftDataLoading = $state(true);

	// Opens the "log in to like" prompt when an anonymous visitor taps the heart.
	let authPromptOpen = $state(false);

	// ── Context setup (must be synchronous – before any await) ───────────────

	const giftsContext = untrack(() =>
		setGiftsContext(
			() => gifts,
			() => role,
			() => wishlist.status === 'archived',
			() => isAuthenticated,
		),
	);

	untrack(() =>
		setLikesContext(
			() => likedGiftIds,
			() => isAuthenticated,
			() => {
				authPromptOpen = true;
			},
		),
	);

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
	const isRecipient = $derived(role === 'recipient');
	// Full management gate (add/edit gifts, share, archive, settings): recipient OR správce.
	const canManage = $derived(canManageWishlist(role));
	const wishlistStatus = $derived(wishlist.status as 'draft' | 'active' | 'archived');
	const recipientIsModerator = $derived(wishlist.recipientIsModerator);
	// For-someone-else ⇔ no linked recipient account (management is via správci rows only).
	const isForSomeoneElse = $derived(wishlist.recipientUserId === null);
	const themeEmoji = $derived(getThemePreset(wishlist.theme as DashboardWishlistTheme).emoji);
	function getWishlistPageUrl() {
		return `${SITE_URL}/w/${wishlist.shortId}`;
	}

	function getWishlistSocialImageUrl() {
		const imagePath = wishlistImageUrl(wishlist.imageKey);
		return imagePath === null ? SOCIAL_PREVIEW_IMAGE_URL : `${SITE_URL}${imagePath}`;
	}

	// OG/Twitter description. A plain function (evaluated at render), NOT a $derived — reading
	// post-await state through a memoized $derived inside <svelte:head> collapses to undefined
	// during async SSR and 500s. For-someone lists read „…pro {recipient}"; self lists keep the
	// original wording, sourced from recipientDisplayName.
	function getSocialDescription() {
		if (wishlist.recipientUserId === null) {
			return m.wishlist_og_description_recipient({
				recipient: wishlist.recipientDisplayName,
			});
		}
		return `Seznam prani od ${wishlist.recipientDisplayName}`;
	}

	// ── Remote data fetch ────────────────────────────────────────────────────

	// SSR fetches only wishlist metadata for title/OG/header. Gift rows render client-side
	// after mount to keep the Cloudflare Worker render path below the free CPU budget.
	// svelte-ignore state_referenced_locally
	const wishlistData = await getWishlistByShortId(shortId);

	wishlist = wishlistData;
	role = wishlistData.role;

	// ── Refresh function ─────────────────────────────────────────────────────

	async function refreshData() {
		try {
			// SvelteKit caches query results by arguments – .refresh() invalidates the cache,
			// then we re-fetch to get the updated values
			await Promise.all([
				getWishlistByShortId(shortId).refresh(),
				getGiftsByWishlistShortId(shortId).refresh(),
			]);
			const [freshWishlist, freshGifts] = await Promise.all([
				getWishlistByShortId(shortId),
				getGiftsByWishlistShortId(shortId),
			]);
			wishlist = freshWishlist;
			gifts = freshGifts.gifts;
			role = freshGifts.role;
			await refreshLikedGiftIds({ refresh: true });
			await refreshWishlistDashboards();
		} catch (thrown) {
			console.error('Failed to refresh wishlist data:', thrown);
		} finally {
			isGiftDataLoading = false;
		}
	}

	async function loadGiftData() {
		isGiftDataLoading = true;
		try {
			const giftsData = await getGiftsByWishlistShortId(shortId);
			gifts = giftsData.gifts;
			role = giftsData.role;
			await refreshLikedGiftIds();
		} catch (thrown) {
			console.error('Failed to load wishlist gifts:', thrown);
			toastError(translateServerError(thrown));
		} finally {
			isGiftDataLoading = false;
		}
	}

	async function refreshLikedGiftIds({ refresh = false }: { refresh?: boolean } = {}) {
		if (!isAuthenticated) {
			likedGiftIds = [];
			return;
		}

		try {
			if (refresh) {
				await getUserLikesForWishlist().refresh();
			}
			likedGiftIds = await getUserLikesForWishlist();
		} catch {
			likedGiftIds = [];
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

	// ── Batch add dialog state ───────────────────────────────────────────────

	let batchAddDialogOpen = $state(false);
	let isBatchSubmitting = $state(false);

	// ── Import wizard state ──────────────────────────────────────────────────

	let importWizardOpen = $state(false);

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

	// svelte-ignore state_referenced_locally (intentional baseline snapshot for the change-detection effect below)
	let lastLoadedId = shortId;

	$effect(() => {
		if (shortId === lastLoadedId) {
			return;
		}
		lastLoadedId = shortId;
		isGiftDataLoading = true;
		void refreshData();
	});

	// ── Gift display ─────────────────────────────────────────────────────────

	const displayedGifts = $derived(giftsContext.sortedAndFilteredGifts.current);
	const viewMode = $derived(giftsContext.viewMode.current);
	const totalCount = $derived(giftsContext.giftCount.current);
	const headerGiftCount = $derived(isGiftDataLoading && gifts.length === 0 ? null : totalCount);
	const isFilteredEmpty = $derived(displayedGifts.length === 0 && totalCount > 0);
	const isEmpty = $derived(totalCount === 0);

	// ── Computed: can user edit/delete the selected gift? ────────────────────

	// Ticking clock driving the live grace countdown + re-lock (issue #83); seeded now, advanced by
	// the effect below while the modal is open.
	let graceClockNow = $state(new Date());

	// Full edit grace: a pre-share gift is fully editable for 2 minutes after sharing only.
	// Later edits update the transparency badge but never reopen name/delete grace.
	const selectedFullEditGraceExpiresAt = $derived.by(() => {
		// Post-share edit locks bind the linked recipient (the person the list is for), never a
		// správce — a moderator edits freely. Self-promotion changes only reservation visibility,
		// so a self-promoted recipient stays subject to the lock.
		if (selectedGift === null || !isRecipient || wishlist.sharedAt === null) {
			return null;
		}
		return preShareOwnerFullEditGraceExpiresAt({
			wishlistSharedAt: wishlist.sharedAt,
			giftCreatedAt: selectedGift.createdAt,
		});
	});

	const selectedDeleteGraceExpiresAt = $derived.by(() => {
		if (selectedGift === null || !isRecipient || wishlist.sharedAt === null) {
			return null;
		}
		return ownerSharedGiftDeleteGraceExpiresAt({
			wishlistSharedAt: wishlist.sharedAt,
			giftCreatedAt: selectedGift.createdAt,
		});
	});
	const selectedClockExpiresAt = $derived(
		selectedFullEditGraceExpiresAt ?? selectedDeleteGraceExpiresAt,
	);
	const isSelectedGiftWithinFullEditGrace = $derived(
		selectedFullEditGraceExpiresAt !== null &&
			graceClockNow.getTime() < selectedFullEditGraceExpiresAt.getTime(),
	);
	const isSelectedGiftWithinDeleteGrace = $derived(
		selectedDeleteGraceExpiresAt !== null &&
			graceClockNow.getTime() < selectedDeleteGraceExpiresAt.getTime(),
	);
	const selectedActiveGraceExpiresAt = $derived(
		isSelectedGiftWithinFullEditGrace
			? selectedFullEditGraceExpiresAt
			: isSelectedGiftWithinDeleteGrace
				? selectedDeleteGraceExpiresAt
				: null,
	);
	const selectedGraceMessage = $derived(
		isSelectedGiftWithinFullEditGrace ? m.gift_grace_hint : m.gift_delete_grace_hint,
	);

	// Advance the clock once per second while the modal is open; self-stops once the window closes
	// and is torn down when the modal closes (no timer leak).
	$effect(() => {
		if (!giftModalOpen || selectedClockExpiresAt === null) {
			return;
		}
		const expiry = selectedClockExpiresAt.getTime();
		graceClockNow = new Date();
		const id = setInterval(() => {
			graceClockNow = new Date();
			if (graceClockNow.getTime() >= expiry) {
				clearInterval(id); // window closed – the lock has already flipped
			}
		}, 1000);
		return () => clearInterval(id);
	});

	// Post-share-locked means a pre-share gift's initial full-edit grace has closed.
	const postShareLockSelectedGift = $derived(
		selectedFullEditGraceExpiresAt !== null && !isSelectedGiftWithinFullEditGrace,
	);

	const canDeleteSelectedGift = $derived.by(() => {
		if (selectedGift === null) {
			return false;
		}
		if (postShareLockSelectedGift) {
			return false;
		}
		if (
			'reservedCount' in selectedGift &&
			(selectedGift as { reservedCount: number }).reservedCount > 0
		) {
			return false;
		}
		if (isRecipient && wishlist.sharedAt !== null) {
			return isSelectedGiftWithinDeleteGrace;
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

	function handleSettingsOpened() {
		void goto(localizeInternalHref(resolve('/(app)/w/[id]/settings', { id: shortId })));
	}

	function handleEditImage() {
		// resolve() handles the route; the #image fragment cannot be expressed through it.
		void goto(
			`${localizeInternalHref(resolve('/(app)/w/[id]/settings', { id: shortId }))}#image`,
		);
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
		if (!canManage) {
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
			toastSuccess(m.toast_gift_created());
			await refreshData();
		} catch (thrown) {
			toastError(translateServerError(thrown));
		} finally {
			isSubmitting = false;
		}
	}

	async function handleUpdate(input: UpdateGiftInput) {
		isSubmitting = true;
		try {
			await updateGiftRemote(input);
			giftModalOpen = false;
			toastSuccess(m.toast_gift_updated());
			await refreshData();
		} catch (thrown) {
			toastError(translateServerError(thrown));
		} finally {
			isSubmitting = false;
		}
	}

	async function handleDelete(giftId: string) {
		isDeleting = true;
		try {
			await deleteGift(giftId);
			giftModalOpen = false;
			toastSuccess(m.toast_gift_deleted());
			await refreshData();
		} catch (thrown) {
			toastError(translateServerError(thrown));
		} finally {
			isDeleting = false;
		}
	}

	async function handleReceived(giftId: string, received: boolean) {
		try {
			await markGiftReceived({ giftId, received });
			await refreshData();
		} catch (thrown) {
			toastError(translateServerError(thrown));
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

	// ── Import wizard handlers ───────────────────────────────────────────────

	const importExistingGifts = $derived(
		gifts.map((gift) => ({ name: gift.name, links: gift.links ?? [] })),
	);

	function openImportWizard() {
		importWizardOpen = true;
	}

	async function handleImportSuccess() {
		await refreshData();
	}

	// ── Batch add handlers ───────────────────────────────────────────────────

	function openBatchAddDialog() {
		batchAddDialogOpen = true;
	}

	async function handleBatchSubmit(drafts: GiftDraftInput[]) {
		isBatchSubmitting = true;
		try {
			const created = await importGifts({ wishlistId: wishlist.id, gifts: drafts });
			batchAddDialogOpen = false;
			toastSuccess(m.toast_batch_add_success({ count: created.length }));
			await refreshData();
		} catch (thrown) {
			toastError(translateServerError(thrown));
		} finally {
			isBatchSubmitting = false;
		}
	}

	function handleBatchDialogOpenChange(open: boolean) {
		batchAddDialogOpen = open;
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
			await refreshWishlistDashboards();
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
		if (!canManage) {
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
			// Lost the race: someone reserved the last unit between page load and submit.
			// Rather than a generic "not enough available" error, sync the real state and
			// tell the visitor what actually happened.
			if (getServerErrorCode(thrown) === SERVER_ERROR.NOT_ENOUGH_AVAILABLE) {
				reserveModalOpen = false;
				reservingGift = null;
				await refreshData();
				toastError(m.toast_gift_just_reserved());
			} else {
				toastError(translateServerError(thrown));
			}
		} finally {
			isReserving = false;
		}
	}

	async function handleUnreserve(giftItem: GiftForVisitor) {
		if (giftItem.myReservationId === null) {
			return;
		}
		try {
			await unreserveGift({ reservationId: giftItem.myReservationId });
			toastSuccess(m.toast_gift_unreserved());
			await refreshData();
		} catch (thrown) {
			toastError(translateServerError(thrown));
		}
	}

	// ── Lifecycle: auto-follow on mount ───────────────────────────────────────

	onMount(() => {
		void loadClientSideWishlistData();
	});

	async function loadClientSideWishlistData() {
		await Promise.all([
			loadGiftData(),
			(async () => {
				if (!isAuthenticated) {
					return;
				}

				try {
					await followWishlist(wishlist.id);
				} catch {
					// Auto-follow failure is non-critical – ignore
				}
			})(),
		]);
	}
</script>

<!-- data-palette re-derives every color token for this subtree (see app.css), giving the
     wishlist its own per-list identity independent of the viewer's app palette. -->
<div
	bind:this={themeWrapperElement}
	data-palette={wishlist.palette}
	class="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6"
>
	<WishlistHeader
		title={wishlist.title}
		recipientDisplayName={wishlist.recipientDisplayName}
		{isForSomeoneElse}
		managerNames={wishlist.managerNames}
		description={wishlist.description}
		imageKey={wishlist.imageKey}
		imageSlots={wishlist.imageSlots}
		{themeEmoji}
		eventDate={wishlist.eventDate}
		status={wishlistStatus}
		{role}
		giftCount={headerGiftCount}
		{recipientIsModerator}
		onshare={handleShareOpened}
		onmoderators={handleModeratorsOpened}
		onarchive={handleArchive}
		oneditimage={handleEditImage}
	/>

	<WishlistDetailToolbar
		{canManage}
		{role}
		{isArchived}
		{isAuthenticated}
		{viewMode}
		sortOption={giftsContext.sortOption.current}
		filters={giftsContext.filters.current}
		onviewmodechange={handleViewModeChange}
		onsortchange={handleSortChange}
		onfilterchange={handleFilterChange}
		onthemeopen={() => (themeDialogOpen = true)}
		onsettings={handleSettingsOpened}
		onunfollow={handleUnfollow}
		onaddgift={openCreateModal}
		onbatchadd={openBatchAddDialog}
		onimport={openImportWizard}
	/>

	<WishlistGiftDisplay
		gifts={displayedGifts}
		{role}
		{isArchived}
		{viewMode}
		isLoading={isGiftDataLoading}
		{isEmpty}
		{isFilteredEmpty}
		{draggedIndex}
		{dragOverIndex}
		onedit={openEditModal}
		onreserve={handleOpenReserveModal}
		onunreserve={handleUnreserve}
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
	{role}
	{canManage}
	{isAuthenticated}
	wishlistId={wishlist.id}
	wishlistTitle={wishlist.title}
	giftCount={totalCount}
	{recipientIsModerator}
	bind:giftModalOpen
	{giftModalMode}
	{selectedGift}
	{priorityLevels}
	postShareLocked={postShareLockSelectedGift}
	{canDeleteSelectedGift}
	graceExpiresAt={selectedActiveGraceExpiresAt}
	graceMessage={selectedGraceMessage}
	graceNow={graceClockNow}
	{isSubmitting}
	{isDeleting}
	bind:reserveModalOpen
	{reservingGift}
	{isReserving}
	bind:themeDialogOpen
	activeTheme={themeContext.activeTheme.current}
	bind:batchAddDialogOpen
	{isBatchSubmitting}
	bind:moderatorPanelOpen
	bind:authPromptOpen
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
	onbatchsubmit={handleBatchSubmit}
	onbatchdialogopenchange={handleBatchDialogOpenChange}
/>

{#if canManage}
	<ImportWizard
		bind:open={importWizardOpen}
		mode={WIZARD_MODE.append}
		wishlistId={wishlist.id}
		wishlistShortId={wishlist.shortId}
		wishlistTitle={wishlist.title}
		priorityLevelCount={priorityLevels.length}
		existingGifts={importExistingGifts}
		suppressNavigation
		onsuccess={handleImportSuccess}
	/>
{/if}

<svelte:head>
	<title>{wishlist.title} – Přejeme si</title>
	<meta property="og:title" content={wishlist.title} />
	<meta property="og:description" content={getSocialDescription()} />
	<meta property="og:type" content="website" />
	<meta property="og:url" content={getWishlistPageUrl()} />
	<meta property="og:image" content={getWishlistSocialImageUrl()} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:alt" content={wishlist.title} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={wishlist.title} />
	<meta name="twitter:description" content={getSocialDescription()} />
	<meta name="twitter:image" content={getWishlistSocialImageUrl()} />
	<link rel="canonical" href={getWishlistPageUrl()} />
</svelte:head>
