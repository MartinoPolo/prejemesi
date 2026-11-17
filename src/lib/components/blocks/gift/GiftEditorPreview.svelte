<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils.js';
	import * as SegmentedToggle from '$lib/components/derived/segmented-toggle/index.js';
	import LayoutGridIcon from '@lucide/svelte/icons/layout-grid';
	import ListIcon from '@lucide/svelte/icons/list';
	import { GIFT_VIEW_MODES, type GiftForVisitor } from '$lib/modules/gifts/types.js';
	import GiftCard from './GiftCard.svelte';
	import GiftListItem from './GiftListItem.svelte';
	import GiftImageEditEntry from './GiftImageEditEntry.svelte';
	import { GIFT_EDITOR_IMAGE_PLACEMENTS } from './gift_presentation_props.js';

	type PreviewView = typeof GIFT_VIEW_MODES.card | typeof GIFT_VIEW_MODES.list;

	interface Props {
		/** The gift as visitors see it, built from the editor's live values. */
		gift: GiftForVisitor;
		/** The shown image has a source, so pressing it opens the framing step. */
		editable: boolean;
		disabled: boolean;
		onedit: () => void;
		class?: string;
	}

	let { gift, editable, disabled, onedit, class: className }: Props = $props();

	const VIEWS = [
		{ value: GIFT_VIEW_MODES.card, icon: LayoutGridIcon, label: () => m.gift_view_card() },
		{ value: GIFT_VIEW_MODES.list, icon: ListIcon, label: () => m.gift_view_list() },
	] as const;

	const headingId = $props.id();
	let view = $state<PreviewView>(GIFT_VIEW_MODES.card);
	// A re-click on the active segment writes an empty value; the derived copy restores the view.
	let selectedView = $derived<string>(view);
	const editorImage = $derived(
		editable ? { content: editEntry, placement: GIFT_EDITOR_IMAGE_PLACEMENTS.over } : undefined,
	);

	function chooseView(value: string) {
		if (value === GIFT_VIEW_MODES.card || value === GIFT_VIEW_MODES.list) {
			view = value;
		} else {
			selectedView = view;
		}
	}
</script>

{#snippet editEntry()}
	<GiftImageEditEntry expandable={view === GIFT_VIEW_MODES.card} {disabled} onclick={onedit} />
{/snippet}

<section
	class={cn('flex min-w-0 flex-col gap-2', className)}
	aria-labelledby={headingId}
	data-testid="gift-editor-preview"
>
	<div class="flex min-w-0 flex-wrap items-center justify-between gap-2">
		<h3 id={headingId} class="text-xs font-semibold text-muted-foreground">
			{m.gift_preview_heading()}
		</h3>
		<SegmentedToggle.Root
			bind:value={selectedView}
			onValueChange={chooseView}
			class="max-w-full"
			aria-label={m.gift_view_switcher_aria()}
			data-testid="gift-editor-preview-view"
		>
			<!-- Labels truncate rather than push the tray past a narrow rail at enlarged text. -->
			{#each VIEWS as option (option.value)}
				<SegmentedToggle.Item
					value={option.value}
					class="min-w-0"
					surfaceClass="min-w-0"
					data-testid="gift-editor-preview-{option.value}"
				>
					<option.icon data-icon="inline-start" /><span class="truncate"
						>{option.label()}</span
					>
				</SegmentedToggle.Item>
			{/each}
		</SegmentedToggle.Root>
	</div>
	<!-- Visitors' view only: the card's own actions stay inert, the image is the one entry. -->
	{#if view === GIFT_VIEW_MODES.card}
		<GiftCard {gift} role="visitor" {editorImage} />
	{:else}
		<GiftListItem {gift} role="visitor" {editorImage} />
	{/if}
</section>
