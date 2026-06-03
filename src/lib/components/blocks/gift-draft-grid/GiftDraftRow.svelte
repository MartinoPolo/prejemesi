<script lang="ts">
	import { cn } from '$lib/utils.js';
	import Checkbox from '$lib/components/base/checkbox/Checkbox.svelte';
	import { Input } from '$lib/components/base/input/index.js';
	import { Textarea } from '$lib/components/base/textarea/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { Badge } from '$lib/components/base/badge/index.js';
	import { HelpText } from '$lib/components/base/help-text/index.js';
	import GiftDraftPriceCell from './GiftDraftPriceCell.svelte';
	import GiftDraftLinksCell from './GiftDraftLinksCell.svelte';
	import { giftDraftRowVariants, type GiftDraftRowStatus } from './gift_draft_grid_variants.js';
	import { useGiftDraftGrid, deriveRowStatus } from './gift_draft_grid.context.svelte.js';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		index: number;
	}

	let { index }: Props = $props();

	const context = useGiftDraftGrid();

	const row = $derived(context.rows[index]);
	const status: GiftDraftRowStatus = $derived(
		row != null ? deriveRowStatus(row, context.mode) : 'neutral',
	);
	const excluded = $derived(row != null ? !row.selected : false);
	const showNameError = $derived(status === 'error' && row?.selected === true);

	function handleNameInput(event: Event) {
		const target = event.target as HTMLInputElement;
		context.updateDraft(index, { name: target.value });
	}

	function handleDescriptionInput(event: Event) {
		const target = event.target as HTMLTextAreaElement;
		context.updateDraft(index, { description: target.value || null });
	}

	function handleCheckboxChange() {
		context.toggleSelection(index);
	}

	function handleRemoveRow() {
		context.removeRows([index]);
	}
</script>

{#if row}
	<div
		class={cn(
			giftDraftRowVariants({ status, excluded }),
			'grid gap-3',
			'grid-cols-1 sm:grid-cols-[44px_2.1fr_1.6fr_2fr_168px_44px_44px]',
		)}
		data-testid="draft-row"
		data-status={status}
		data-excluded={excluded}
	>
		<!-- Checkbox -->
		<div class="flex items-start justify-center pt-1">
			<Checkbox
				checked={row.selected}
				onCheckedChange={handleCheckboxChange}
				aria-label={m.draft_grid_select_row({ name: row.draft.name || `#${index + 1}` })}
			/>
		</div>

		<!-- Name -->
		<div class="flex flex-col gap-1">
			<Input
				value={row.draft.name}
				oninput={handleNameInput}
				state={showNameError ? 'error' : 'default'}
				placeholder={m.draft_grid_name_placeholder()}
				disabled={excluded}
			/>
			{#if showNameError}
				<HelpText state="error">{m.draft_grid_name_required()}</HelpText>
			{/if}
			{#if status === 'duplicate'}
				<Badge tone="warning">
					<CopyIcon class="size-3" />
					{m.draft_grid_possible_duplicate()}
				</Badge>
			{/if}
		</div>

		<!-- Description -->
		<div>
			<Textarea
				value={row.draft.description ?? ''}
				oninput={handleDescriptionInput}
				placeholder={m.draft_grid_notes_placeholder()}
				class="field-sizing-content resize-y min-h-10"
				disabled={excluded}
			/>
		</div>

		<!-- Links -->
		<div>
			<GiftDraftLinksCell
				links={row.draft.links}
				onAddLink={(url) => context.addLink(index, url)}
				onRemoveLink={(linkIndex) => context.removeLink(index, linkIndex)}
				disabled={excluded}
			/>
		</div>

		<!-- Price -->
		<div>
			<GiftDraftPriceCell
				price={row.draft.price}
				currency={row.draft.currency}
				onPriceChange={(price) => context.updateDraft(index, { price })}
				onCurrencyChange={(currency) => context.updateDraft(index, { currency })}
				disabled={excluded}
			/>
		</div>

		<!-- Enrich (Phase 2) -->
		<div class="flex items-start justify-center pt-1">
			<Button intent="ghost" size="icon-sm" disabled title={m.draft_grid_phase2_disabled()}>
				<SparklesIcon />
			</Button>
		</div>

		<!-- Remove -->
		<div class="flex items-start justify-center pt-1">
			<Button
				intent="danger"
				size="icon-sm"
				onclick={handleRemoveRow}
				aria-label={m.draft_grid_remove_row()}
			>
				<Trash2Icon />
			</Button>
		</div>
	</div>
{/if}
