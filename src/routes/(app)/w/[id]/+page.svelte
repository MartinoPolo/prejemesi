<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/base/button/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import * as Sheet from '$lib/components/base/sheet/index.js';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import PaletteIcon from '@lucide/svelte/icons/palette';
	import GripVerticalIcon from '@lucide/svelte/icons/grip-vertical';
	import WishlistHeader from '$lib/components/blocks/gift/WishlistHeader.svelte';
	import GiftSortFilter from '$lib/components/blocks/gift/GiftSortFilter.svelte';
	import GiftViewSwitcher from '$lib/components/blocks/gift/GiftViewSwitcher.svelte';
	import GiftCard from '$lib/components/blocks/gift/GiftCard.svelte';
	import GiftListItem from '$lib/components/blocks/gift/GiftListItem.svelte';
	import GiftCompactRow from '$lib/components/blocks/gift/GiftCompactRow.svelte';
	import EmptyState from '$lib/components/blocks/dashboard/EmptyState.svelte';
	import GiftDetailModal from '$lib/components/blocks/gift/GiftDetailModal.svelte';
	import ReserveModal from '$lib/components/blocks/reservation/ReserveModal.svelte';
	import ShareWizard from '$lib/components/blocks/sharing/ShareWizard.svelte';
	import ThemeSelector from '$lib/components/blocks/theme/ThemeSelector.svelte';
	import ModeratorPanel from '$lib/components/blocks/moderator/ModeratorPanel.svelte';
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
		unfollowWishlist,
		followWishlist,
	} from '$lib/modules/wishlists/wishlists.remote.js';
	import { getGiftsByWishlistShortId } from '$lib/modules/gifts/gifts.remote.js';
	import { getUserLikesForWishlist } from '$lib/modules/likes/likes.remote.js';
	import { reserveGift } from '$lib/modules/reservations/reservations.remote.js';
	import type { ReserveGiftInput } from '$lib/modules/reservations/types.js';
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
	} from '$lib/modules/gifts/types.js';
	import { cn } from '$lib/utils.js';

	let { data } = $props();

	const shortId = page.params.id!;
	// Capture auth state before top-level await so Svelte doesn't warn about
	// reading reactive $props in an initialization block.
	const initialUser = untrack(() => data.user);
	const isAuthenticated = $derived(data.user !== null);

	// ── Remote data fetch ────────────────────────────────────────────────────

	const [wishlistData, giftsData] = await Promise.all([
		getWishlistByShortId(shortId),
		getGiftsByWishlistShortId(shortId),
	]);

	let userLikedGiftIds: string[] = [];
	if (initialUser !== null) {
		try {
			userLikedGiftIds = await getUserLikesForWishlist();
		} catch {
			// Guarded calls may fail for unauthenticated users — ignore
		}
	}

	// ── Reactive state (initialized from remote data) ───────────────────────

	let wishlist = $state(wishlistData);
	let gifts = $state(giftsData.gifts);
	let role = $state(giftsData.role);
	let likedGiftIds = $state.raw(userLikedGiftIds);

	// ── Refresh function (replaces invalidate('app:wishlist-data')) ──────────

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

	// ── Derived values ───────────────────────────────────────────────────────

	const isArchived = $derived(wishlist.status === 'archived');
	const isOwner = $derived(role === 'owner');
	const isModerator = $derived(role === 'moderator');
	const isOwnerOrModerator = $derived(role === 'owner' || role === 'moderator');
	const wishlistStatus = $derived(wishlist.status as 'draft' | 'active' | 'archived');
	const ownerIsModeratorLocal = $derived(wishlist.ownerIsModerator);

	// ── Context setup ────────────────────────────────────────────────────────

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

	// ── Modal state ──────────────────────────────────────────────────────────

	let moderatorPanelOpen = $state(false);
	let modalOpen = $state(false);
	let modalMode = $state<'create' | 'edit'>('create');
	let selectedGift = $state<GiftByRole | null>(null);
	let priorityLevels = $state.raw<GiftPriorityLevel[]>([]);
	let isSubmitting = $state(false);
	let isDeleting = $state(false);

	// ── Theme selector sheet state ───────────────────────────────────────────

	let themeSheetOpen = $state(false);

	// ── Drag-and-drop state ──────────────────────────────────────────────────

	let draggedIndex = $state<number | null>(null);
	let dragOverIndex = $state<number | null>(null);

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

	function handleViewModeChange(mode: typeof viewMode) {
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
		modalMode = 'create';
		selectedGift = null;
		modalOpen = true;
	}

	async function openEditModal(gift: GiftByRole) {
		if (!isOwnerOrModerator) {
			return;
		}
		await loadPriorityLevels();
		modalMode = 'edit';
		selectedGift = gift;
		modalOpen = true;
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
			modalOpen = false;
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
			modalOpen = false;
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
			modalOpen = false;
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

	function handleModalClose() {
		modalOpen = false;
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

	// ── Theme handlers ────────────────────────────────────────────────────────

	function handleThemePreview(theme: WishlistTheme) {
		themeContext.startPreview(theme);
	}

	function handleThemeCancel() {
		themeContext.cancelPreview();
		themeSheetOpen = false;
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

			themeContext.cancelPreview();
			await refreshData();
			themeSheetOpen = false;
			toastSuccess(m.toast_theme_saved());
		} catch (thrown) {
			console.error('Failed to save theme:', thrown);
			toastError(m.toast_theme_save_error());
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

	let reserveModalOpen = $state(false);
	let reservingGift = $state<GiftForVisitor | null>(null);
	let isReserving = $state(false);

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
	<!-- Wishlist Header -->
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
		onshare={handleShareOpened}
		onmoderators={handleModeratorsOpened}
	/>

	<!-- Toolbar -->
	<div class="flex flex-wrap items-center gap-3">
		<GiftViewSwitcher value={viewMode} onchange={handleViewModeChange} />

		<GiftSortFilter
			sortValue={giftsContext.sortOption.current}
			filters={giftsContext.filters.current}
			{hasActiveFilters}
			onsortchange={handleSortChange}
			onfilterchange={handleFilterChange}
		/>

		<div class="ml-auto flex items-center gap-2">
			{#if isOwner && !isArchived}
				<Button
					size="sm"
					intent="outline"
					aria-label={m.wishlist_detail_change_theme()}
					onclick={() => (themeSheetOpen = true)}
				>
					<PaletteIcon data-icon="inline-start" />
					{m.wishlist_detail_theme_button()}
				</Button>
			{/if}
			{#if !isOwner && !isArchived}
				<Button size="sm" intent="ghost" onclick={handleUnfollow}
					>{m.wishlist_detail_unfollow()}</Button
				>
			{/if}
			{#if isOwnerOrModerator && !isArchived}
				<Button
					size="sm"
					aria-label={m.wishlist_detail_add_gift_label()}
					onclick={openCreateModal}
				>
					<PlusIcon data-icon="inline-start" />
					{m.wishlist_detail_add_wish()}
				</Button>
			{/if}
		</div>
	</div>

	<!-- Gift Display -->
	{#if isEmpty}
		<!-- Empty state: no gifts at all -->
		{#if isArchived}
			<EmptyState
				emoji="🗄️"
				title={m.wishlist_detail_archived_empty_title()}
				description={m.wishlist_detail_archived_empty_description()}
			/>
		{:else if isOwner}
			<EmptyState
				emoji="🎁"
				title={m.wishlist_detail_owner_empty_title()}
				description={m.wishlist_detail_owner_empty_description()}
			>
				{#snippet actions()}
					<Button
						aria-label={m.wishlist_detail_add_first_wish_label()}
						onclick={openCreateModal}
					>
						<PlusIcon data-icon="inline-start" />
						{m.wishlist_detail_add_first_wish()}
					</Button>
				{/snippet}
			</EmptyState>
		{:else}
			<EmptyState
				emoji="🎁"
				title={m.wishlist_detail_visitor_empty_title()}
				description={m.wishlist_detail_visitor_empty_description()}
			/>
		{/if}
	{:else if isFilteredEmpty}
		<!-- Empty state: filters returned nothing -->
		<EmptyState
			emoji="🔍"
			title={m.wishlist_detail_no_filter_results_title()}
			description={m.wishlist_detail_no_filter_results_description()}
		>
			{#snippet actions()}
				<Button intent="outline" onclick={clearFilters}
					>{m.wishlist_detail_clear_filters()}</Button
				>
			{/snippet}
		</EmptyState>
	{:else if viewMode === 'card'}
		<!-- Card Grid -->
		<div class="grid gap-5" style:grid-template-columns="repeat(auto-fill, minmax(280px, 1fr))">
			{#each displayedGifts as giftItem, index (giftItem.id)}
				<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
				<div
					class={cn(
						'relative transition-opacity',
						isOwnerOrModerator && 'cursor-pointer',
						draggedIndex === index && 'opacity-40',
						dragOverIndex === index && 'ring-2 ring-primary ring-offset-2 rounded-xl',
					)}
					role={isOwnerOrModerator ? 'button' : undefined}
					tabindex={isOwnerOrModerator ? 0 : undefined}
					onclick={() => openEditModal(giftItem)}
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							openEditModal(giftItem);
						}
					}}
					draggable={isOwnerOrModerator}
					ondragstart={(e) => handleDragStart(e, index)}
					ondragover={(e) => handleDragOver(e, index)}
					ondragleave={handleDragLeave}
					ondrop={(e) => handleDrop(e, index)}
					ondragend={handleDragEnd}
				>
					{#if isOwnerOrModerator}
						<div
							class="absolute top-2 left-2 z-10 cursor-grab rounded bg-background/80 p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:opacity-100"
							style="opacity: 0.6"
						>
							<GripVerticalIcon class="size-4 text-muted-foreground" />
						</div>
					{/if}
					<GiftCard
						gift={giftItem}
						{role}
						{isArchived}
						onreserve={handleOpenReserveModal}
					/>
				</div>
			{/each}
		</div>
	{:else if viewMode === 'list'}
		<!-- List View -->
		<div class="flex flex-col">
			{#each displayedGifts as giftItem, index (giftItem.id)}
				<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
				<div
					class={cn(
						'relative transition-opacity',
						isOwnerOrModerator && 'cursor-pointer',
						draggedIndex === index && 'opacity-40',
						dragOverIndex === index && 'bg-primary/5',
					)}
					role={isOwnerOrModerator ? 'button' : undefined}
					tabindex={isOwnerOrModerator ? 0 : undefined}
					onclick={() => openEditModal(giftItem)}
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							openEditModal(giftItem);
						}
					}}
					draggable={isOwnerOrModerator}
					ondragstart={(e) => handleDragStart(e, index)}
					ondragover={(e) => handleDragOver(e, index)}
					ondragleave={handleDragLeave}
					ondrop={(e) => handleDrop(e, index)}
					ondragend={handleDragEnd}
				>
					<GiftListItem
						gift={giftItem}
						{role}
						{isArchived}
						onreserve={handleOpenReserveModal}
					/>
				</div>
			{/each}
		</div>
	{:else}
		<!-- Compact Table View -->
		<div class="overflow-x-auto">
			<table class="w-full">
				<thead>
					<tr class="border-b-2 border-border">
						{#if isOwnerOrModerator}
							<th class="w-8 px-1"></th>
						{/if}
						<th
							class="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
						>
							Nazev
						</th>
						<th
							class="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
						>
							Odkaz
						</th>
						<th
							class="px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
						>
							Cena
						</th>
						{#if !isOwner}
							<th
								class="px-3 py-2 text-center text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
							>
								&#9825;
							</th>
							<th
								class="px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
							>
								Akce
							</th>
						{/if}
					</tr>
				</thead>
				<tbody>
					{#each displayedGifts as giftItem (giftItem.id)}
						<GiftCompactRow
							gift={giftItem}
							{role}
							{isArchived}
							onclick={() => {
								if (isOwnerOrModerator) openEditModal(giftItem);
							}}
							onreserve={handleOpenReserveModal}
						/>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<!-- Gift Detail Modal -->
{#if isOwnerOrModerator}
	<GiftDetailModal
		bind:open={modalOpen}
		mode={modalMode}
		gift={selectedGift}
		wishlistId={wishlist.id}
		{priorityLevels}
		{isOwner}
		canDelete={canDeleteSelectedGift}
		{isSubmitting}
		{isDeleting}
		oncreate={handleCreate}
		onupdate={handleUpdate}
		ondelete={handleDelete}
		onreceived={handleReceived}
		onclose={handleModalClose}
	/>
{/if}

<!-- Reserve Modal (visitor/moderator only, hidden for owner) -->
{#if !isOwner}
	<ReserveModal
		bind:open={reserveModalOpen}
		gift={reservingGift}
		{isAuthenticated}
		isSubmitting={isReserving}
		onreserve={handleReserve}
		onclose={handleReserveModalClose}
	/>
{/if}

<!-- Share Wizard (owner only) -->
{#if isOwner}
	<ShareWizard
		wishlistId={wishlist.id}
		wishlistTitle={wishlist.title}
		giftCount={totalCount}
		onshared={handleShared}
	/>
{/if}

<!-- Theme Selector Sheet (owner only) -->
{#if isOwner}
	<Sheet.Root
		bind:open={themeSheetOpen}
		onOpenChange={(open) => {
			if (open !== true) {
				themeContext.cancelPreview();
			}
		}}
	>
		<Sheet.Content side="right" class="w-full sm:max-w-md">
			<Sheet.Header>
				<Sheet.Title>Motiv seznamu</Sheet.Title>
				<Sheet.Description>Zvolte prednastaveny motiv nebo vlastni barvu.</Sheet.Description
				>
			</Sheet.Header>
			<div class="px-4 py-4">
				<ThemeSelector
					currentTheme={themeContext.activeTheme.current}
					onsave={handleThemeSave}
					oncancel={handleThemeCancel}
					onpreview={handleThemePreview}
				/>
			</div>
		</Sheet.Content>
	</Sheet.Root>
{/if}

<!-- Moderator Panel (owner only) -->
{#if isOwner}
	<ModeratorPanel
		wishlistId={wishlist.id}
		ownerIsModerator={ownerIsModeratorLocal}
		bind:open={moderatorPanelOpen}
		onselfpromoted={handleSelfPromoted}
	/>
{/if}

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
