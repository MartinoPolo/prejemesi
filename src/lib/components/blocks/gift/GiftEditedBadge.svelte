<script lang="ts">
	import { Badge } from '$lib/components/base/badge/index.js';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import * as m from '$lib/paraglide/messages.js';

	interface GiftEditedBadgeProps {
		editedAfterShareAt: Date | null;
	}

	let { editedAfterShareAt }: GiftEditedBadgeProps = $props();
</script>

<!-- Wrapper keeps the pill content-sized: as a direct flex item the inline-flex Badge would
	otherwise stretch full-width in the card's column body (align-items: stretch). -->
{#if editedAfterShareAt !== null}
	<div class="flex">
		<Badge tone="neutral" badgeStyle="subtle" class="text-[11px]">
			{#snippet icon()}
				<PencilIcon class="size-2.5" />
			{/snippet}
			{m.gift_edited_after_share_badge()}
		</Badge>
	</div>
{/if}
