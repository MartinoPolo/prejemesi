<script lang="ts">
	import { Label } from '$lib/components/base/label/index.js';
	import { Checkbox } from '$lib/components/base/checkbox/index.js';
	import { HelpText } from '$lib/components/base/help-text/index.js';
	import * as Select from '$lib/components/base/select/index.js';
	import GiftBulkDialogFrame from './GiftBulkDialogFrame.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import {
		NEW_WISHLIST_DESTINATION,
		type BulkCopyDestination,
	} from './gift_bulk_copy_destination.js';

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
		/** Offered only for a permanent source wishlist, whose gifts may move out. */
		offerSourceRemoval?: boolean;
		removeSources?: boolean;
		onremovesourceschange?: (removeSources: boolean) => void;
		/** Links each copy with its source; a destination of another recipient cannot link. */
		linkCopies?: boolean;
		onlinkcopieschange?: (linkCopies: boolean) => void;
		onconfirm: () => void;
	}

	interface CheckboxOption {
		id: string;
		checked: boolean;
		disabled: boolean;
		onchange: (checked: boolean) => void;
		label: string;
		help: string;
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
		offerSourceRemoval = false,
		removeSources = false,
		onremovesourceschange,
		linkCopies = true,
		onlinkcopieschange,
		onconfirm,
	}: Props = $props();
	let confirmButton = $state<HTMLButtonElement | null>(null);
	let submittingCycleObserved = $state(false);
	const unavailable = $derived(loading || submitting || selectedDestinationId === '');
	const moving = $derived(offerSourceRemoval && removeSources);
	const creatingDestination = $derived(selectedDestinationId === NEW_WISHLIST_DESTINATION);
	const title = $derived(moving ? m.gift_bulk_copy_move_title() : m.gift_bulk_copy_title());
	const description = $derived(
		moving ? m.gift_bulk_copy_move_description() : m.gift_bulk_copy_description(),
	);
	const selectedDestination = $derived(
		destinations.find((destination) => destination.id === selectedDestinationId),
	);
	const linkUnavailable = $derived(
		!creatingDestination && selectedDestination?.linkable === false,
	);
	const linking = $derived(linkCopies && !linkUnavailable);
	const linkHelp = $derived(
		linkUnavailable ? m.gift_bulk_copy_link_unavailable() : m.gift_bulk_copy_link_help(),
	);
	const removeSourcesHelp = $derived(
		moving && linking
			? m.gift_bulk_copy_remove_sources_linked_help()
			: m.gift_bulk_copy_remove_sources_help(),
	);
	const selectedDestinationLabel = $derived(
		creatingDestination
			? m.gift_bulk_copy_new_destination()
			: selectedDestination === undefined
				? m.gift_bulk_copy_choose()
				: destinationLabel(selectedDestination),
	);

	function destinationLabel(destination: BulkCopyDestination): string {
		return `${destination.title} · ${destination.recipientDisplayName}`;
	}

	$effect(() => {
		if (submitting) {
			submittingCycleObserved = true;
		} else if (submittingCycleObserved) {
			submittingCycleObserved = false;
			if (open) {
				requestAnimationFrame(() => {
					if (
						confirmButton !== null &&
						confirmButton.isConnected &&
						!confirmButton.disabled
					) {
						confirmButton.focus({ preventScroll: true });
					}
				});
			}
		}
	});
</script>

{#snippet checkboxOption(option: CheckboxOption)}
	<div class="grid gap-1">
		<div class="flex items-center gap-2">
			<Checkbox
				id={option.id}
				checked={option.checked}
				disabled={option.disabled}
				aria-describedby="{option.id}-help"
				onCheckedChange={(checked) => option.onchange(checked === true)}
			/>
			<Label for={option.id}>{option.label}</Label>
		</div>
		<HelpText id="{option.id}-help">{option.help}</HelpText>
	</div>
{/snippet}

{#snippet destinationPicker()}
	<div class="space-y-4 px-4 py-3 sm:px-0 sm:py-4">
		{#if loading}
			<p class="text-sm text-muted-foreground">{m.moderator_loading()}</p>
		{:else}
			<div class="grid gap-2">
				<Label id="bulk-copy-destination-label" for="bulk-copy-destination">
					{m.gift_bulk_copy_destination()}
				</Label>
				<Select.Root
					type="single"
					value={selectedDestinationId}
					disabled={submitting}
					onValueChange={(value) => ondestinationchange(value ?? '')}
				>
					<Select.Trigger
						id="bulk-copy-destination"
						data-testid="bulk-copy-destination"
						aria-labelledby="bulk-copy-destination-label"
						class="w-full"
						size="lg"
					>
						{selectedDestinationLabel}
					</Select.Trigger>
					<Select.Content>
						{#each destinations as destination (destination.id)}
							<Select.Item
								value={destination.id}
								label={destinationLabel(destination)}
							/>
						{/each}
						<Select.Item
							value={NEW_WISHLIST_DESTINATION}
							label={m.gift_bulk_copy_new_destination()}
						/>
					</Select.Content>
				</Select.Root>
			</div>
			{#if selectedDestinationId !== ''}
				{@render checkboxOption({
					id: 'bulk-copy-link-copies',
					checked: linking,
					disabled: submitting || linkUnavailable,
					onchange: (checked) => onlinkcopieschange?.(checked),
					label: m.gift_bulk_copy_link(),
					help: linkHelp,
				})}
			{/if}
			{#if offerSourceRemoval}
				{@render checkboxOption({
					id: 'bulk-copy-remove-sources',
					checked: removeSources,
					disabled: submitting,
					onchange: (checked) => onremovesourceschange?.(checked),
					label: m.gift_bulk_copy_remove_sources(),
					help: removeSourcesHelp,
				})}
			{/if}
		{/if}
	</div>
{/snippet}

<GiftBulkDialogFrame
	{open}
	{onopenchange}
	{title}
	{description}
	{onback}
	{submitting}
	bind:confirmButton
	confirmDisabled={unavailable}
	confirmLabel={submitting
		? m.gift_bulk_pending({ count: selectedCount })
		: creatingDestination
			? m.gift_bulk_copy_new_destination_confirm()
			: moving
				? m.gift_bulk_copy_move_confirm()
				: m.gift_bulk_copy_confirm()}
	{onconfirm}
>
	{@render destinationPicker()}
</GiftBulkDialogFrame>
