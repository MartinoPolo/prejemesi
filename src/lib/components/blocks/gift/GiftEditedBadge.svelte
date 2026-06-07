<script lang="ts">
	import { Badge } from '$lib/components/base/badge/index.js';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import * as m from '$lib/paraglide/messages.js';

	interface GiftEditedBadgeProps {
		editedAfterShareAt: Date | null;
	}

	let { editedAfterShareAt }: GiftEditedBadgeProps = $props();
</script>

{#if editedAfterShareAt !== null}
	<Badge tone="neutral" badgeStyle="subtle" class="gap-1 text-[11px]">
		<PencilIcon class="size-2.5" />
		{m.gift_edited_after_share_badge()}
	</Badge>
{/if}
