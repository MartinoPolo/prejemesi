<script lang="ts">
	import * as Dialog from '$lib/components/base/dialog/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import GiftDraftGrid from './GiftDraftGrid.svelte';
	import type { GiftDraftInput } from '$lib/modules/gifts/types.js';
	import { DEFAULT_GIFT_CURRENCY } from '$lib/modules/gifts/types.js';
	import type { ExistingGift } from './gift_draft_grid.context.svelte.js';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		open: boolean;
		existingGifts?: ExistingGift[];
		onSubmit: (gifts: GiftDraftInput[]) => void;
	}

	let { open = $bindable(), existingGifts = [], onSubmit }: Props = $props();

	let committableRows = $state<GiftDraftInput[]>([]);

	function handleCommitReady(rows: GiftDraftInput[]) {
		committableRows = rows;
	}

	function handleSubmit() {
		if (committableRows.length > 0) {
			onSubmit(committableRows);
			open = false;
		}
	}

	const initialDrafts = [
		{ name: '', description: null, links: [], price: null, currency: DEFAULT_GIFT_CURRENCY },
		{ name: '', description: null, links: [], price: null, currency: DEFAULT_GIFT_CURRENCY },
		{ name: '', description: null, links: [], price: null, currency: DEFAULT_GIFT_CURRENCY },
	];
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="max-w-[1100px]">
		<Dialog.Header>
			<Dialog.Title>{m.draft_grid_dialog_title()}</Dialog.Title>
			<Dialog.Description>{m.draft_grid_dialog_subtitle()}</Dialog.Description>
		</Dialog.Header>

		<div class="max-h-[60vh] overflow-y-auto px-1 py-4">
			<GiftDraftGrid
				{initialDrafts}
				{existingGifts}
				mode="batch"
				onCommitReady={handleCommitReady}
			/>
		</div>

		<Dialog.Footer>
			<Dialog.Close>
				<Button intent="ghost">{m.draft_grid_dialog_cancel()}</Button>
			</Dialog.Close>
			<Button intent="primary" onclick={handleSubmit} disabled={committableRows.length === 0}>
				{m.draft_grid_dialog_submit()}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
