<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { GiftLink } from '$lib/modules/gifts/types.js';

	/**
	 * CRITICAL: Owner-never-sees-reservations. This panel only accepts
	 * `{ name, links }` – never GiftForVisitor or any reservation data.
	 */
	interface ImportExistingItemsPanelProps {
		existingGifts: Array<{ name: string; links: GiftLink[] }>;
		matchedNames: Set<string>;
	}

	let { existingGifts, matchedNames }: ImportExistingItemsPanelProps = $props();
</script>

<div class="border-border flex h-full w-[280px] flex-col rounded-lg border">
	<!-- Sticky header -->
	<div class="bg-surface-2 sticky top-0 z-10 border-b px-3 py-2">
		<span class="text-sm font-medium">
			{m.import_wizard_existing_items_title({ count: existingGifts.length })}
		</span>
	</div>

	<!-- Scrollable list -->
	<div class="flex-1 overflow-y-auto">
		{#each existingGifts as gift (gift.name)}
			<div class="border-border flex items-center gap-2 border-b px-3 py-2 last:border-b-0">
				{#if matchedNames.has(gift.name)}
					<span
						class="bg-status-warning size-2 shrink-0 rounded-full"
						title={m.import_wizard_possible_duplicate()}
					></span>
				{:else}
					<span class="size-2 shrink-0"></span>
				{/if}
				<span class="text-foreground truncate text-sm">{gift.name}</span>
			</div>
		{/each}
	</div>
</div>
