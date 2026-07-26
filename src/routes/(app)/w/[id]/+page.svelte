<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { afterNavigate, replaceState, goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { localizeInternalHref } from '$lib/i18n/locale.js';
	import WishlistHeader from '$lib/components/blocks/gift/WishlistHeader.svelte';
	import WishlistDetailToolbar from '$lib/components/blocks/wishlist/WishlistDetailToolbar.svelte';
	import WishlistGiftDisplay from '$lib/components/blocks/wishlist/WishlistGiftDisplay.svelte';
	import WishlistPreparingNotice from '$lib/components/blocks/wishlist/WishlistPreparingNotice.svelte';
	import WishlistModals from '$lib/components/blocks/wishlist/WishlistModals.svelte';
	import WishlistSettingsModal from '$lib/components/blocks/wishlist/WishlistSettingsModal.svelte';
	import EditRecipientDialog from '$lib/components/blocks/wishlist/EditRecipientDialog.svelte';
	import {
		WISHLIST_SETTINGS_TABS,
		isWishlistSettingsTab,
		type WishlistSettingsTab,
	} from '$lib/components/blocks/wishlist/wishlist_settings_modal_types.js';
	import {
		WISHLIST_SETTINGS_QUERY_PARAM,
		WISHLIST_GIFT_QUERY_PARAM,
	} from '$lib/modules/wishlists/wishlist_query_params.js';
	import ImportWizard from '$lib/components/blocks/import/ImportWizard.svelte';
	import { WIZARD_MODE } from '$lib/components/blocks/import/import_wizard_types.js';
	import { setGiftsContext } from '$lib/modules/gifts/gifts.context.svelte.js';
	import { setLikesContext } from '$lib/modules/likes/likes.context.svelte.js';
	import { setSharingContext } from '$lib/modules/sharing/sharing.context.svelte.js';
	import { wishlistSocialDescription } from '$lib/modules/sharing/social_description.js';
	import {
		getWishlistByShortId,
		archiveWishlist,
		unfollowWishlist,
		followWishlist,
	} from '$lib/modules/wishlists/wishlists.remote.js';
	import { getGiftsByWishlistShortId } from '$lib/modules/gifts/gifts.remote.js';
	import { getUserLikesForWishlist } from '$lib/modules/likes/likes.remote.js';
	import {
		reserveGift,
		unreserveGift,
		getReservationsForGift,
	} from '$lib/modules/reservations/reservations.remote.js';
	import { setReservationsContext } from '$lib/modules/reservations/reservations.context.svelte.js';
	import type {
		ReserveGiftInput,
		ReservationForModerator,
	} from '$lib/modules/reservations/types.js';
	import type { WishlistRole } from '$lib/modules/wishlists/types.js';
	import {
		canManageWishlist,
		REVERT_CAPABILITY,
		RESERVATION_RELEASE_CAPABILITY,
	} from '$lib/modules/wishlists/wishlist_capabilities.js';
	import type { Palette } from '$lib/theme/palettes.js';
	import { getWishlistEmoji } from '$lib/modules/wishlists/wishlist_theme.js';
	import { wishlistSocialImageUrl } from '$lib/modules/images/index.js';
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
	import { buildGiftCsv, giftCsvFilename, downloadGiftCsv } from '$lib/modules/import/index.js';
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

	// ── Reactive queries (issue #108) ────────────────────────────────────────
	//
	// The page consumes its remote queries reactively (tracked), so single-flight
	// refreshes that mutations trigger server-side ride back on the command
	// response and update the UI without any follow-up fetches.

	// Gift rows load client-side only, keeping the Cloudflare Worker SSR render
	// path below the free CPU budget (the `browser` gate skips the query on SSR).
	const giftsQuery = $derived(browser ? getGiftsByWishlistShortId(shortId) : null);
	const giftsResult = $derived(giftsQuery?.current);
	const gifts = $derived<GiftByRole[]>(giftsResult?.gifts ?? []);
	const isGiftDataLoading = $derived(giftsResult === undefined);

	const likesQuery = $derived(browser && isAuthenticated ? getUserLikesForWishlist() : null);
	const likedGiftIds = $derived(likesQuery?.current ?? []);

	// Optimistic palette: the override paints instantly on selection; the persisted
	// value rides back via setWishlistPalette's single-flight refresh.
	let paletteOverride = $state<Palette | null>(null);

	// Opens the "log in to like" prompt when an anonymous visitor taps the heart.
	let authPromptOpen = $state(false);

	// ── Context setup (must be synchronous – before any await) ───────────────

	const giftsContext = untrack(() =>
		setGiftsContext(
			() => gifts,
			() => role,
			() => wishlist?.status === 'archived',
			() => isAuthenticated,
			() => likedGiftIds,
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
			() => wishlist?.shortId ?? '',
			() => wishlist?.sharedAt != null,
		),
	);

	// Release wiring for every gift surface (issue #213). The capability is server-computed —
	// the administrator identity never reaches the client (REQ-7).
	untrack(() =>
		setReservationsContext(
			() => wishlist.reservationReleaseCapability,
			(giftId) => releaseLedgers[giftId] ?? [],
			handleRelease,
		),
	);

	// ── Remote data fetch ────────────────────────────────────────────────────

	// SSR fetches only wishlist metadata for title/OG/header. The plain awaited value
	// is required for <svelte:head> — reading post-await state through a memoized
	// $derived there collapses to undefined during async SSR and 500s (see
	// getSocialDescription). The reactive query shares the same client cache entry,
	// so hydration costs no second fetch and single-flight refreshes flow into
	// `wishlist` below; the awaited value doubles as the fallback while a new
	// shortId is loading after in-place navigation.
	// svelte-ignore state_referenced_locally
	const initialWishlist = await getWishlistByShortId(shortId);
	const wishlistQuery = $derived(getWishlistByShortId(shortId));
	const wishlist = $derived(wishlistQuery.current ?? initialWishlist);
	const role = $derived<WishlistRole>(giftsResult?.role ?? wishlist.role);

	// Per-gift release ledgers (issue #213). Fetched only for a viewer who has SOME release reach
	// and only for gifts that actually hold reservations, so the common visitor/obdarovaný path
	// (capability `none`) costs nothing at all. Each row already excludes the viewer's own
	// reservation, so an empty ledger means the release control stays hidden on that gift.
	const releaseLedgers = $derived.by(() => {
		const byGiftId: Record<string, ReservationForModerator[]> = {};
		if (wishlist.reservationReleaseCapability === RESERVATION_RELEASE_CAPABILITY.none) {
			return byGiftId;
		}
		for (const giftItem of gifts) {
			if (!('reservedCount' in giftItem) || giftItem.reservedCount === 0) {
				continue;
			}
			const rows = getReservationsForGift(giftItem.id).current?.reservations;
			if (rows !== undefined && rows.length > 0) {
				byGiftId[giftItem.id] = rows;
			}
		}
		return byGiftId;
	});

	// Fresh server gift data is authoritative — drop any optimistic reorder layer so
	// a stale pre-refresh order can never mask newly fetched gifts. Successful
	// reorders don't refetch (see handleReorder), so their optimistic order survives.
	$effect(() => {
		if (giftsResult !== undefined) {
			giftsContext.clearReorderOverride();
		}
	});

	// ── Derived values ───────────────────────────────────────────────────────

	const activePalette = $derived(paletteOverride ?? wishlist.palette);
	const isArchived = $derived(wishlist.status === 'archived');
	const isRecipient = $derived(role === 'recipient');
	// Full management gate (add/edit gifts, share, archive, settings): recipient OR správce.
	const canManage = $derived(canManageWishlist(role));
	const wishlistStatus = $derived(wishlist?.status as 'draft' | 'active' | 'archived');
	// Non-managers see a friendly „Seznam se připravuje" page on a draft list (never-shared or
	// reverted, issue #150) instead of the toolbar + gifts; the URL revives on (re-)share.
	const isPreparing = $derived(wishlistStatus === 'draft' && !canManage);
	// App admin with a revert action but no management rights: surface the settings gear so they
	// can reach the danger-only revert (issue #150). Non-hidden capability for a non-manager ⟺ admin.
	const adminSettingsAvailable = $derived(
		!canManage && wishlist?.revertCapability !== REVERT_CAPABILITY.hidden,
	);
	const recipientIsModerator = $derived(wishlist?.recipientIsModerator);
	// For-someone-else ⇔ no linked recipient account (management is via správci rows only).
	const isForSomeoneElse = $derived(wishlist?.recipientUserId == null);
	const themeEmoji = $derived(getWishlistEmoji(wishlist?.theme));
	function getWishlistPageUrl() {
		return `${SITE_URL}/w/${wishlist.shortId}`;
	}

	// OG/Twitter image (issue #117): a fixed-aspect crop honoring the `social` slot's saved
	// focal point, so the crawler-visible preview matches what the owner framed in the crop
	// editor instead of always serving the unmodified source image.
	function getWishlistSocialImageUrl() {
		const url = wishlistSocialImageUrl(
			wishlist.imageKey,
			wishlist.imageSlots,
			SOCIAL_PREVIEW_IMAGE_URL,
		);
		return url.startsWith('http') ? url : `${SITE_URL}${url}`;
	}

	// OG/Twitter description. A plain function (evaluated at render), NOT a $derived — reading
	// post-await state through a memoized $derived inside <svelte:head> collapses to undefined
	// during async SSR and 500s. Localized via Paraglide (issue #117). Sentence form
	// „Seznam přání pro {recipient}" on ALL lists — self lists included (2026-07-14 decision).
	function getSocialDescription() {
		return wishlistSocialDescription(wishlist.recipientDisplayName);
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

	// ── Palette dialog state (issue #102 REQ-5) ──────────────────────────────

	let paletteDialogOpen = $state(false);

	// ── Settings modal state (per-wishlist settings, moved from /w/<id>/settings) ─

	let settingsModalOpen = $state(false);
	let settingsModalTab = $state<WishlistSettingsTab>(WISHLIST_SETTINGS_TABS.details);

	// ── Edit-recipient dialog state (issue #150): one shared dialog, two entry points
	//    (header pencil + settings modal recipient row) ────────────────────────

	let recipientEditDialogOpen = $state(false);

	// ── Reservation modal state ───────────────────────────────────────────────

	let reserveModalOpen = $state(false);
	let reservingGift = $state<GiftForVisitor | null>(null);
	let isReserving = $state(false);

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

	function handleEditRecipientOpened() {
		recipientEditDialogOpen = true;
	}

	// Recipient change via the shared dialog (issue #150): the flip/rename command
	// single-flight-refreshes the page query (role, „Spravuje" line) and, for the flip, the
	// Moje seznamy/Spravované dashboards (issue #108) — nothing left to do here.
	async function handleRecipientChanged() {}

	function handleShareOpened() {
		sharingContext.openWizard();
	}

	function handleSettingsOpened() {
		settingsModalTab = WISHLIST_SETTINGS_TABS.details;
		settingsModalOpen = true;
	}

	function handleEditImage() {
		settingsModalTab = WISHLIST_SETTINGS_TABS.image;
		settingsModalOpen = true;
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
		giftsContext.filters.current = {
			availableOnly: false,
			withLinkOnly: false,
			likedOnly: false,
		};
	}

	async function openCreateModal() {
		await loadPriorityLevels();
		giftModalMode = 'create';
		selectedGift = null;
		giftModalOpen = true;
	}

	/** Opens the gift detail modal (issue #125): edit mode for managers, read-only for everyone
	 *  else. Priority levels are only needed by the edit form. */
	async function openEditModal(gift: GiftByRole) {
		if (canManage) {
			await loadPriorityLevels();
		}
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

	// Gift mutations rely on the command's server-side single-flight refresh: the
	// fresh gift list rides back on the command response and the tracked query
	// updates in place — no follow-up fetches, no metadata/likes/dashboard reloads
	// (issue #108, REQ-3/4/5).

	async function handleCreate(input: CreateGiftInput) {
		isSubmitting = true;
		try {
			await createGift(input);
			giftModalOpen = false;
			toastSuccess(m.toast_gift_created());
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
		} catch (thrown) {
			toastError(translateServerError(thrown));
		} finally {
			isDeleting = false;
		}
	}

	async function handleReceived(giftId: string, received: boolean) {
		try {
			await markGiftReceived({ giftId, received });
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

	// ── Export handler ────────────────────────────────────────────────────────

	// Exports gift DATA ONLY (name/notes/links/price), mirroring the import columns
	// for a round-trip. Never emits reservation state – the recipient must not infer
	// it, and reservations are not gift-catalog data (DECISIONS.md).
	function handleExport() {
		const csv = buildGiftCsv(
			gifts.map((gift) => ({
				name: gift.name,
				description: gift.description,
				links: gift.links ?? [],
				price: gift.price,
				currency: gift.currency,
			})),
		);
		downloadGiftCsv(csv, giftCsvFilename(wishlist.title, wishlist.shortId));
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
			// The command single-flight-refreshes the wishlist query (archived status).
			await archiveWishlist(wishlist.id);
			toastSuccess(m.toast_wishlist_archived());
		} catch (thrown) {
			console.error('Failed to archive wishlist:', thrown);
			toastError(m.toast_wishlist_archive_error());
		}
	}

	// ── Delete handler (issue #120) ────────────────────────────────────────────
	// The confirmation + deleteWishlist call live inside WishlistSettingsModal (danger-zone
	// tab); this callback only handles what must happen on THIS page after a successful delete:
	// navigate away since the wishlist no longer exists. The command already single-flight-
	// refreshes Moje seznamy/Spravované (issue #108), so the destination dashboards are current.
	async function handleWishlistDeleted() {
		await goto(localizeInternalHref(resolve('/my-lists')));
	}

	// ── Palette handler (issue #102 REQ-5) ────────────────────────────────────

	// Optimistic local update: the `data-palette` wrapper re-derives the whole token
	// subtree instantly; the picker persists via setWishlistPalette (whose server-side
	// single-flight refresh brings the persisted value back) and reverts on error.
	function handlePaletteSelect(palette: Palette) {
		paletteOverride = palette;
	}

	// ── Reorder handler (pointer + keyboard, mouse/touch/pen) ─────────────────

	// The card grid / list views drive reordering via pointer events (works on touch, unlike
	// native HTML5 DnD) and keyboard arrows on the grip. Both surfaces report a source→target
	// index pair over the rendered order and route through this single persistence path.
	async function handleReorder(fromIndex: number, toIndex: number) {
		if (!canManage || fromIndex === toIndex) {
			return;
		}

		const items = [...giftsContext.effectiveGifts.current];
		const [movedItem] = items.splice(fromIndex, 1);
		if (movedItem === undefined) {
			return;
		}
		items.splice(toIndex, 0, movedItem);
		giftsContext.reorderGifts(items);

		try {
			const reorderItems = items.map((item, index) => ({
				id: item.id,
				sortOrder: index,
			}));
			await reorderGifts(reorderItems);
			// Success: keep the optimistic override in place. Its objects are already the
			// rendered ones, so no data refetch is needed — avoiding the wholesale object
			// replacement that re-triggered every card's $derived (the disabled/dim flash).
			// The next real refresh (navigation, other mutation) clears the override so the
			// authoritative server order takes over.
		} catch (thrown) {
			// Failure: revert to the pre-drag order and re-sync with the server so the
			// visible order matches persisted state (existing error handling unchanged).
			console.error('Failed to reorder gifts:', thrown);
			giftsContext.clearReorderOverride();
			await getGiftsByWishlistShortId(shortId).refresh();
		}
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
			// The command single-flight-refreshes the gift list (reservation state).
			await reserveGift(input);
			reserveModalOpen = false;
			reservingGift = null;
			toastSuccess(m.toast_gift_reserved());
		} catch (thrown) {
			// Lost the race: someone reserved the last unit between page load and submit.
			// Rather than a generic "not enough available" error, sync the real state and
			// tell the visitor what actually happened. (Errors carry no single-flight
			// payload, so this path refreshes explicitly.)
			if (getServerErrorCode(thrown) === SERVER_ERROR.NOT_ENOUGH_AVAILABLE) {
				reserveModalOpen = false;
				reservingGift = null;
				await getGiftsByWishlistShortId(shortId).refresh();
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
		} catch (thrown) {
			toastError(translateServerError(thrown));
		}
	}

	/**
	 * Releasing SOMEONE ELSE's reservation (issue #213). The server re-checks the capability, so
	 * this path carries no authorization of its own. Returns whether the release went through, so
	 * the confirmation dialog stays open on a rejection.
	 */
	async function handleRelease(giftId: string, reservationId: string): Promise<boolean> {
		try {
			// The command single-flight-refreshes the gift list, so the freed capacity lands
			// immediately; the ledger is a separate query and has to drop the row explicitly.
			await unreserveGift({ reservationId });
			await getReservationsForGift(giftId).refresh();
			toastSuccess(m.toast_reservation_released());
			return true;
		} catch (thrown) {
			toastError(translateServerError(thrown));
			return false;
		}
	}

	// ── Lifecycle: auto-follow on mount ───────────────────────────────────────

	onMount(() => {
		// Auto-follow surfaces a shared list in the viewer's „Sledované". Skip it for anyone
		// who already owns or co-manages the list (it lives in „Moje seznamy" / „Spravované"):
		// the server no-ops for the recipient anyway, so this spares a wasted POST + DB
		// round-trip on every view, and it keeps a moderator from becoming a redundant follower.
		if (!isAuthenticated || canManage) {
			return;
		}
		followWishlist(initialWishlist.id).catch(() => {
			// Auto-follow failure is non-critical – ignore
		});
	});

	// The legacy /w/<id>/settings route redirects here with ?settings=<tab>; open the
	// modal on the requested tab, then strip the marker so reload/share won't reopen it.
	afterNavigate(() => {
		const requestedTab = page.url.searchParams.get(WISHLIST_SETTINGS_QUERY_PARAM);
		if (requestedTab === null) {
			return;
		}
		settingsModalTab = isWishlistSettingsTab(requestedTab)
			? requestedTab
			: WISHLIST_SETTINGS_TABS.details;
		settingsModalOpen = true;
		const cleanedUrl = new URL(page.url);
		cleanedUrl.searchParams.delete(WISHLIST_SETTINGS_QUERY_PARAM);
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- shallow cleanup of the current URL's query marker, not a route navigation
		replaceState(cleanedUrl, {});
	});

	// Gift deep-link from an in-app notification (issue #204): /w/<shortId>?gift=<id> opens
	// that gift's detail modal. Gifts load client-side only (see giftsQuery above), so this is
	// an $effect (not afterNavigate) — it must re-run once that query settles, not just on
	// navigation. A gift missing from the loaded list (deleted/archived, REQ-3) is not an
	// error: the marker is cleared and the visitor simply stays on the wishlist.
	$effect(() => {
		const requestedGiftId = page.url.searchParams.get(WISHLIST_GIFT_QUERY_PARAM);
		if (requestedGiftId === null || isGiftDataLoading) {
			return;
		}
		const matchedGift = gifts.find((gift) => gift.id === requestedGiftId);
		if (matchedGift !== undefined) {
			void openEditModal(matchedGift);
		}
		const cleanedUrl = new URL(page.url);
		cleanedUrl.searchParams.delete(WISHLIST_GIFT_QUERY_PARAM);
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- shallow cleanup of the current URL's query marker, not a route navigation
		replaceState(cleanedUrl, {});
	});
</script>

<!-- data-palette re-derives every color token for this subtree (see app.css), giving the
     wishlist its own per-list identity independent of the viewer's app palette. -->
<div data-palette={activePalette} class="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
	<WishlistHeader
		title={wishlist.title}
		recipientDisplayName={wishlist.recipientDisplayName}
		recipientImage={wishlist.recipientImage}
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
		oneditrecipient={handleEditRecipientOpened}
	/>

	{#if isPreparing}
		<WishlistPreparingNotice />
	{:else}
		<WishlistDetailToolbar
			{canManage}
			{adminSettingsAvailable}
			{role}
			{isArchived}
			{isAuthenticated}
			{viewMode}
			sortOption={giftsContext.sortOption.current}
			filters={giftsContext.filters.current}
			onviewmodechange={handleViewModeChange}
			onsortchange={handleSortChange}
			onfilterchange={handleFilterChange}
			onthemeopen={() => (paletteDialogOpen = true)}
			onsettings={handleSettingsOpened}
			onunfollow={handleUnfollow}
			onaddgift={openCreateModal}
			onbatchadd={openBatchAddDialog}
			onimport={openImportWizard}
			onexport={handleExport}
		/>

		<WishlistGiftDisplay
			gifts={displayedGifts}
			{role}
			{isArchived}
			{viewMode}
			isLoading={isGiftDataLoading}
			{isEmpty}
			{isFilteredEmpty}
			onedit={openEditModal}
			onreserve={handleOpenReserveModal}
			onunreserve={handleUnreserve}
			onaddgift={openCreateModal}
			onclearfilters={clearFilters}
			onreorder={handleReorder}
		/>
	{/if}
</div>

<WishlistModals
	{role}
	{canManage}
	{isAuthenticated}
	redirectHref={page.url.pathname}
	wishlistId={wishlist.id}
	wishlistTitle={wishlist.title}
	giftCount={totalCount}
	{recipientIsModerator}
	{isArchived}
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
	bind:paletteDialogOpen
	wishlistPalette={activePalette}
	bind:batchAddDialogOpen
	{isBatchSubmitting}
	bind:moderatorPanelOpen
	bind:authPromptOpen
	ongiftmodalclose={handleGiftModalClose}
	oncreate={handleCreate}
	onupdate={handleUpdate}
	ondelete={handleDelete}
	onreceived={handleReceived}
	ongiftreserve={handleOpenReserveModal}
	ongiftunreserve={handleUnreserve}
	onreservemodalclose={handleReserveModalClose}
	onreserve={handleReserve}
	onpaletteselect={handlePaletteSelect}
	onbatchsubmit={handleBatchSubmit}
	onbatchdialogopenchange={handleBatchDialogOpenChange}
/>

<!-- Per-wishlist settings modal (details / appearance / image). Mounted for every viewer:
     non-managers and archived lists get the read-only notice inside the dialog, preserving
     the old /w/<id>/settings deep-link behavior. -->
<WishlistSettingsModal
	bind:open={settingsModalOpen}
	bind:activeTab={settingsModalTab}
	{wishlist}
	{canManage}
	{role}
	revertCapability={wishlist.revertCapability}
	recipientDisplayName={wishlist.recipientDisplayName}
	{themeEmoji}
	onsaved={async () => {}}
	onpaletteselect={handlePaletteSelect}
	ondeleted={handleWishlistDeleted}
	oneditrecipient={handleEditRecipientOpened}
/>

<!-- Shared recipient dialog (issue #150): linked lists get the one-way flip with consequence
     copy (linked recipient only); free-text lists get the plain rename (any správce). -->
<EditRecipientDialog
	bind:open={recipientEditDialogOpen}
	wishlistId={wishlist.id}
	isLinkedRecipient={!isForSomeoneElse}
	recipientDisplayName={wishlist.recipientDisplayName}
	isShared={wishlist.sharedAt !== null}
	onchanged={handleRecipientChanged}
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
