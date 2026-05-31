<script lang="ts">
	import { Button } from '$lib/components/base/button/index.js';
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
	import { isCustomTheme } from '$lib/modules/themes/types.js';
	import type { WishlistTheme } from '$lib/modules/themes/types.js';
	import { updateWishlist } from '$lib/modules/wishlists/wishlists.remote.js';
	import { unfollowWishlist } from '$lib/modules/wishlists/wishlists.remote.js';
	import { reserveGift } from '$lib/modules/reservations/reservations.remote.js';
	import type { ReserveGiftInput } from '$lib/modules/reservations/types.js';
	import { untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import {
		createGift,
		updateGift as updateGiftRemote,
		deleteGift,
		reorderGifts,
		markGiftReceived,
		getPriorityLevels,
		getGiftsByWishlistShortId,
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

	const wishlist = $derived(data.wishlist);
	const role = $derived(data.role);
	const isArchived = $derived(wishlist.status === 'archived');
	const isOwner = $derived(role === 'owner');
	const isModerator = $derived(role === 'moderator');
	const isOwnerOrModerator = $derived(role === 'owner' || role === 'moderator');

	const giftsContext = untrack(() =>
		setGiftsContext(data.gifts, data.role, data.wishlist.status === 'archived'),
	);

	// Set likes context for visitor/moderator
	untrack(() => setLikesContext(data.userLikedGiftIds));

	// Set sharing context for owner
	const sharingContext = untrack(() =>
		setSharingContext(data.wishlist.shortId, data.wishlist.sharedAt !== null),
	);

	// Set wishlist theme context
	const themeContext = untrack(() =>
		setWishlistThemeContext(data.wishlist.theme, data.wishlist.customThemeColor),
	);

	// Wishlist status (reactive, updates after sharing)
	let wishlistStatus = $state(data.wishlist.status as 'draft' | 'active' | 'archived');

	// Moderator panel state
	let moderatorPanelOpen = $state(false);
	let ownerIsModeratorLocal = $state(data.wishlist.ownerIsModerator);

	function handleModeratorsOpened() {
		moderatorPanelOpen = true;
	}

	function handleSelfPromoted() {
		ownerIsModeratorLocal = true;
		// Refresh gifts to show reservation data for owner
		void refreshGifts();
	}

	function handleShareOpened() {
		sharingContext.openWizard();
	}

	function handleShared() {
		// Update local status to reflect sharing
		wishlistStatus = 'active';
	}

	const displayedGifts = $derived(giftsContext.sortedAndFilteredGifts.current);
	const viewMode = $derived(giftsContext.viewMode.current);
	const totalCount = $derived(giftsContext.giftCount.current);
	const hasActiveFilters = $derived(giftsContext.hasActiveFilters.current);
	const isFilteredEmpty = $derived(displayedGifts.length === 0 && totalCount > 0);
	const isEmpty = $derived(totalCount === 0);

	// Modal state
	let modalOpen = $state(false);
	let modalMode = $state<'create' | 'edit'>('create');
	let selectedGift = $state<GiftByRole | null>(null);
	let priorityLevels = $state<GiftPriorityLevel[]>([]);
	let isSubmitting = $state(false);
	let isDeleting = $state(false);

	// Theme selector sheet state
	let themeSheetOpen = $state(false);

	// Drag-and-drop state
	let draggedIndex = $state<number | null>(null);
	let dragOverIndex = $state<number | null>(null);

	// ── Theme application via $effect ──────────────────────────────────────────

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

	// Computed: can user edit/delete the selected gift?
	const canEditSelectedGift = $derived.by(() => {
		if (selectedGift === null) {
			return false;
		}
		if (isModerator) {
			return true;
		}
		if (isOwner) {
			// Owner can only edit gifts added after sharing
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
		// Cannot delete reserved gifts (only visible for visitor/moderator)
		if (
			'reservedCount' in selectedGift! &&
			(selectedGift as { reservedCount: number }).reservedCount > 0
		) {
			return false;
		}
		return true;
	});

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

	async function refreshGifts() {
		try {
			const result = await getGiftsByWishlistShortId(wishlist.shortId);
			giftsContext.replaceGifts(result.gifts);
		} catch (thrown) {
			console.error('Failed to refresh gifts:', thrown);
		}
	}

	async function handleCreate(input: CreateGiftInput) {
		isSubmitting = true;
		try {
			await createGift(input);
			modalOpen = false;
			await refreshGifts();
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
			await refreshGifts();
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
			await refreshGifts();
		} catch (thrown) {
			console.error('Failed to delete gift:', thrown);
		} finally {
			isDeleting = false;
		}
	}

	async function handleReceived(giftId: string, received: boolean) {
		try {
			await markGiftReceived(giftId, received);
			await refreshGifts();
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
			toast.success('Seznam jste prestali sledovat');
		} catch (thrown) {
			console.error('Failed to unfollow:', thrown);
			toast.error('Nepodarilo se prestat sledovat');
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

			themeContext.commitTheme(theme);
			themeSheetOpen = false;
			toast.success('Motiv byl ulozen');
		} catch (thrown) {
			console.error('Failed to save theme:', thrown);
			toast.error('Nepodarilo se ulozit motiv');
		}
	}

	// ── Drag-and-drop handlers ──────────────────────────────────────────────

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

		// Reorder locally
		const items = [...giftsContext.gifts.current];
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

		// Persist to server
		try {
			const reorderItems = items.map((item, index) => ({
				id: item.id,
				sortOrder: index,
			}));
			await reorderGifts(reorderItems);
		} catch (thrown) {
			console.error('Failed to reorder gifts:', thrown);
			await refreshGifts();
		}
	}

	function handleDragEnd() {
		draggedIndex = null;
		dragOverIndex = null;
	}

	// ── Reservation handlers ───────────────────────────────────────────────

	let reserveModalOpen = $state(false);
	let reservingGift = $state<GiftForVisitor | null>(null);
	let isReserving = $state(false);
	const isAuthenticated = $derived(data.isAuthenticated);

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
			toast.success('Darek byl rezervovan');
			await refreshGifts();
		} catch (thrown) {
			const message = thrown instanceof Error ? thrown.message : 'Rezervace se nezdarila';
			toast.error(message);
		} finally {
			isReserving = false;
		}
	}
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
					aria-label="Zmenit motiv"
					onclick={() => (themeSheetOpen = true)}
				>
					<PaletteIcon data-icon="inline-start" />
					Motiv
				</Button>
			{/if}
			{#if !isOwner && !isArchived}
				<Button size="sm" intent="ghost" onclick={handleUnfollow}>Prestat sledovat</Button>
			{/if}
			{#if isOwnerOrModerator && !isArchived}
				<Button size="sm" aria-label="Pridat darek" onclick={openCreateModal}>
					<PlusIcon data-icon="inline-start" />
					Pridat prani
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
				title="Seznam byl archivovan"
				description="Tento seznam byl archivovan a je prazdny."
			/>
		{:else if isOwner}
			<EmptyState
				emoji="🎁"
				title="Zatim tu nic neni"
				description="Pridej sva prvni prani a pak seznam sdilej."
			>
				{#snippet actions()}
					<Button aria-label="Pridat prvni prani" onclick={openCreateModal}>
						<PlusIcon data-icon="inline-start" />
						Pridat prvni prani
					</Button>
				{/snippet}
			</EmptyState>
		{:else}
			<EmptyState
				emoji="🎁"
				title="Tento seznam zatim nema zadne darky"
				description="Vlastnik jeste nepridal zadna prani."
			/>
		{/if}
	{:else if isFilteredEmpty}
		<!-- Empty state: filters returned nothing -->
		<EmptyState
			emoji="🔍"
			title="Zadna prani neodpovidaji filtrum"
			description="Zkuste zmenit nebo zrusit filtry."
		>
			{#snippet actions()}
				<Button intent="outline" onclick={clearFilters}>Zrusit filtry</Button>
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
