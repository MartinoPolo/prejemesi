<script lang="ts">
	import { Checkbox } from '$lib/components/base/checkbox/index.js';
	import { Input } from '$lib/components/base/input/index.js';
	import { Textarea } from '$lib/components/base/textarea/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import SimpleTooltip from '$lib/components/base/tooltip/SimpleTooltip.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import XIcon from '@lucide/svelte/icons/x';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import GiftDraftLinksCell from './GiftDraftLinksCell.svelte';
	import GiftDraftPriceCell from './GiftDraftPriceCell.svelte';
	import { getDraftStatus, type GridDraftRow, type DraftRowStatus } from './gift_draft_grid.js';
	import type { GiftCurrency, GiftLink } from '$lib/modules/gifts/types.js';

	interface GiftDraftRowProps {
		row: GridDraftRow;
		onselectedchange: (selected: boolean) => void;
		ontouched: () => void;
		onnamechange: (name: string) => void;
		ondescriptionchange: (description: string | null) => void;
		onlinkschange: (links: GiftLink[]) => void;
		onpricechange: (price: number | null) => void;
		oncurrencychange: (currency: GiftCurrency) => void;
		onremove: () => void;
	}

	let {
		row,
		onselectedchange,
		ontouched,
		onnamechange,
		ondescriptionchange,
		onlinkschange,
		onpricechange,
		oncurrencychange,
		onremove,
	}: GiftDraftRowProps = $props();

	const status: DraftRowStatus = $derived(getDraftStatus(row));
	const isExcluded = $derived(status === 'excluded');
	const showNameError = $derived(status === 'error');

	function handleNameInput(event: Event) {
		const target = event.target as HTMLInputElement;
		onnamechange(target.value);
		if (!row.touched) {
			ontouched();
		}
	}

	function handleDescriptionInput(event: Event) {
		const target = event.target as HTMLTextAreaElement;
		ondescriptionchange(target.value || null);
		if (!row.touched) {
			ontouched();
		}
	}

	function handleLinksChange(links: GiftLink[]) {
		onlinkschange(links);
		if (!row.touched) {
			ontouched();
		}
	}

	function handlePriceChange(price: number | null) {
		onpricechange(price);
		if (!row.touched) {
			ontouched();
		}
	}

	function handleCurrencyChange(currency: GiftCurrency) {
		oncurrencychange(currency);
		if (!row.touched) {
			ontouched();
		}
	}
</script>

<tr
	class="is-{status} border-border/50 border-b transition-colors"
	class:opacity-50={isExcluded}
	class:bg-[color-mix(in_oklab,var(--status-success)_6%,transparent)]={status === 'ready'}
	class:bg-[color-mix(in_oklab,var(--status-danger)_6%,transparent)]={status === 'error'}
>
	<!-- Select -->
	<td class="w-10 px-2 py-1.5 text-center align-top">
		<Checkbox
			checked={row.selected}
			onCheckedChange={(checked) => onselectedchange(checked === true)}
			aria-label={row.draft.name.trim() !== '' ? row.draft.name : m.col_select_all()}
		/>
	</td>

	<!-- Name -->
	<td class="min-w-[160px] px-1.5 py-1.5 align-top">
		<Input
			value={row.draft.name}
			placeholder={m.batch_add_name_placeholder()}
			class="h-7 text-xs"
			state={showNameError ? 'error' : undefined}
			disabled={isExcluded}
			oninput={handleNameInput}
		/>
		{#if showNameError}
			<p class="text-destructive mt-0.5 text-2xs">{m.batch_add_enter_name()}</p>
		{/if}
	</td>

	<!-- Note / Description -->
	<td class="min-w-[120px] px-1.5 py-1.5 align-top">
		<Textarea
			value={row.draft.description ?? ''}
			placeholder={m.batch_add_note_placeholder()}
			class="min-h-7 resize-vertical text-xs"
			disabled={isExcluded}
			oninput={handleDescriptionInput}
		/>
	</td>

	<!-- Links -->
	<td class="min-w-[180px] px-1.5 py-1.5 align-top">
		<GiftDraftLinksCell
			links={row.draft.links}
			disabled={isExcluded}
			onchange={handleLinksChange}
		/>
	</td>

	<!-- Price -->
	<td class="min-w-[160px] px-1.5 py-1.5 align-top">
		<GiftDraftPriceCell
			price={row.draft.price}
			currency={row.draft.currency}
			disabled={isExcluded}
			onpricechange={handlePriceChange}
			oncurrencychange={handleCurrencyChange}
		/>
	</td>

	<!-- Enrich (Phase 2 placeholder) -->
	<td class="w-10 px-1.5 py-1.5 text-center align-top">
		<SimpleTooltip text={m.batch_add_enrich_phase2()}>
			<Button
				size="icon-sm"
				intent="ghost"
				class="size-7"
				disabled
				aria-label={m.col_enrich()}
			>
				<SparklesIcon class="size-3.5" />
			</Button>
		</SimpleTooltip>
	</td>

	<!-- Remove -->
	<td class="w-10 px-1.5 py-1.5 text-center align-top">
		<Button
			size="icon-sm"
			intent="ghost"
			class="size-7"
			aria-label={m.col_remove()}
			onclick={onremove}
		>
			<XIcon class="size-3.5" />
		</Button>
	</td>
</tr>
