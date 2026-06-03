<script lang="ts">
	import { Button } from '$lib/components/base/button/index.js';
	import SimpleTooltip from '$lib/components/base/tooltip/SimpleTooltip.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';

	interface GiftDraftBulkBarProps {
		selectedCount: number;
		ondeleteselected: () => void;
	}

	let { selectedCount, ondeleteselected }: GiftDraftBulkBarProps = $props();
</script>

{#if selectedCount > 0}
	<div
		class="bg-surface border-border sticky bottom-4 z-10 flex items-center gap-3 rounded-lg border px-4 py-2 shadow-lg"
	>
		<span class="text-sm font-medium">
			{m.batch_add_selected_count({ count: selectedCount })}
		</span>

		<div class="ml-auto flex items-center gap-2">
			<SimpleTooltip text={m.batch_add_enrich_phase2()}>
				<Button size="sm" intent="outline" disabled>
					<SparklesIcon data-icon="inline-start" />
					{m.batch_add_enrich_selected()}
				</Button>
			</SimpleTooltip>

			<Button size="sm" intent="danger" onclick={ondeleteselected}>
				<Trash2Icon data-icon="inline-start" />
				{m.batch_add_delete_selected()}
			</Button>
		</div>
	</div>
{/if}
