<script lang="ts">
	import * as Dialog from '$lib/components/base/dialog/index.js';
	import * as Sheet from '$lib/components/base/sheet/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import WishlistBottomSheet from './WishlistBottomSheet.svelte';
	import * as m from '$lib/paraglide/messages.js';

	export interface BulkCopyDestination {
		id: string;
		title: string;
		status: 'draft' | 'active' | 'archived';
		recipientDisplayName: string;
	}

	interface Props {
		open: boolean;
		destinations: readonly BulkCopyDestination[];
		selectedDestinationId: string;
		selectedCount: number;
		loading?: boolean;
		submitting?: boolean;
		onopenchange: (open: boolean) => void;
		onback?: () => void;
		ondestinationchange: (id: string) => void;
		onconfirm: () => void;
	}

	let {
		open,
		destinations,
		selectedDestinationId,
		selectedCount,
		loading = false,
		submitting = false,
		onopenchange,
		onback,
		ondestinationchange,
		onconfirm,
	}: Props = $props();
	let viewportWidth = $state(1024);
	const mobile = $derived(viewportWidth < 640);
	const unavailable = $derived(
		loading || submitting || selectedDestinationId === '' || destinations.length === 0,
	);
</script>

<svelte:window bind:innerWidth={viewportWidth} />

{#snippet destinationPicker()}
	<div class="space-y-4 px-4 py-3 sm:px-0 sm:py-4">
		{#if loading}
			<p class="text-sm text-muted-foreground">{m.moderator_loading()}</p>
		{:else if destinations.length === 0}
			<p class="text-sm text-muted-foreground">{m.gift_bulk_copy_empty()}</p>
		{:else}
			<label class="grid gap-2 text-sm font-bold" for="bulk-copy-destination">
				{m.gift_bulk_copy_destination()}
				<select
					id="bulk-copy-destination"
					class="border-input bg-background min-h-11 rounded-md border px-3 py-2 font-normal"
					value={selectedDestinationId}
					disabled={submitting}
					onchange={(event) =>
						ondestinationchange((event.currentTarget as HTMLSelectElement).value)}
				>
					<option value="">{m.gift_bulk_copy_choose()}</option>
					{#each destinations as destination (destination.id)}
						<option value={destination.id}>
							{destination.title} · {destination.recipientDisplayName}
						</option>
					{/each}
				</select>
			</label>
		{/if}
	</div>
{/snippet}

{#snippet actions()}
	<div
		class="flex shrink-0 flex-col-reverse gap-2 px-4 pb-3 sm:flex-row sm:justify-end sm:px-0 sm:pb-0"
	>
		<Button
			intent="outline"
			disabled={submitting}
			onclick={() => (mobile && onback !== undefined ? onback() : onopenchange(false))}
		>
			{mobile && onback !== undefined ? m.gift_context_back() : m.cancel()}
		</Button>
		<Button intent="primary" disabled={unavailable} onclick={onconfirm}>
			{submitting
				? m.gift_bulk_pending({ count: selectedCount })
				: m.gift_bulk_copy_confirm()}
		</Button>
	</div>
{/snippet}

{#if mobile}
	<Sheet.Root {open} onOpenChange={onopenchange}>
		{#if open}
			<WishlistBottomSheet class="max-h-[calc(100dvh-0.25rem)]">
				<Sheet.Header class="border-border shrink-0 border-b px-4 py-2 pr-14">
					<Sheet.Title>{m.gift_bulk_copy_title()}</Sheet.Title>
					<Sheet.Description>{m.gift_bulk_copy_description()}</Sheet.Description>
				</Sheet.Header>
				<div class="min-h-0 flex-1 overflow-y-auto">{@render destinationPicker()}</div>
				{@render actions()}
			</WishlistBottomSheet>
		{/if}
	</Sheet.Root>
{:else}
	<Dialog.Root {open} onOpenChange={onopenchange}>
		<Dialog.Content size="sm">
			<Dialog.Header>
				<Dialog.Title>{m.gift_bulk_copy_title()}</Dialog.Title>
				<Dialog.Description>{m.gift_bulk_copy_description()}</Dialog.Description>
			</Dialog.Header>
			{@render destinationPicker()}
			{@render actions()}
		</Dialog.Content>
	</Dialog.Root>
{/if}
