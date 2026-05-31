<script lang="ts">
	import { Button } from '$lib/components/base/button/index.js';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import GripVerticalIcon from '@lucide/svelte/icons/grip-vertical';
	import WishlistHeader from '$lib/components/blocks/gift/WishlistHeader.svelte';
	import GiftSortFilter from '$lib/components/blocks/gift/GiftSortFilter.svelte';
	import GiftViewSwitcher from '$lib/components/blocks/gift/GiftViewSwitcher.svelte';
	import GiftCard from '$lib/components/blocks/gift/GiftCard.svelte';
	import GiftListItem from '$lib/components/blocks/gift/GiftListItem.svelte';
	import GiftCompactRow from '$lib/components/blocks/gift/GiftCompactRow.svelte';
	import EmptyState from '$lib/components/blocks/dashboard/EmptyState.svelte';
	import GiftDetailModal from '$lib/components/blocks/gift/GiftDetailModal.svelte';
	import { setGiftsContext } from '$lib/modules/gifts/gifts.context.svelte.js';
	import { untrack } from 'svelte';
	import {
		createGift,
		updateGift,
		deleteGift,
		reorderGifts,
		markGiftReceived,
		getPriorityLevels,
		getGiftsByWishlistShortId,
	} from '$lib/modules/gifts/gifts.remote.js';
	import type {
		GiftFilters,
		GiftSortOption,
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

	// Drag-and-drop state
	let draggedIndex = $state<number | null>(null);
	let dragOverIndex = $state<number | null>(null);

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
			await updateGift(input);
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
</script>

<div class="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
	<!-- Wishlist Header -->
	<WishlistHeader
		title={wishlist.title}
		ownerName={wishlist.ownerName}
		description={wishlist.description}
		bannerImageKey={wishlist.bannerImageKey}
		eventDate={wishlist.eventDate}
		status={wishlist.status}
		{role}
		giftCount={totalCount}
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
				<Button variant="outline" onclick={clearFilters}>Zrusit filtry</Button>
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
					<GiftCard gift={giftItem} {role} {isArchived} />
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
					<GiftListItem gift={giftItem} {role} {isArchived} />
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
					{#each displayedGifts as giftItem, index (giftItem.id)}
						<GiftCompactRow
							gift={giftItem}
							{role}
							{isArchived}
							onclick={() => {
								if (isOwnerOrModerator) openEditModal(giftItem);
							}}
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
		canEdit={modalMode === 'create' || canEditSelectedGift}
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
