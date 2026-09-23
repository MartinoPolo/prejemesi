<script lang="ts">
	import { Badge } from '$lib/components/base/badge/index.js';
	import { cn } from '$lib/utils.js';
	import { getPriorityDisplay, getPriorityKey } from '$lib/modules/gifts/gift_display.js';

	interface GiftPriorityBadgeProps {
		priorityLabel: string | null;
		showPriority?: boolean;
		isDimmed?: boolean;
		class?: string;
	}

	let {
		priorityLabel,
		showPriority = true,
		isDimmed = false,
		class: className,
	}: GiftPriorityBadgeProps = $props();

	const priorityKey = $derived(getPriorityKey(priorityLabel));
	const priorityInfo = $derived(getPriorityDisplay(priorityLabel));
</script>

{#if showPriority && priorityInfo}
	<Badge
		tone="neutral"
		badgeStyle="subtle"
		class={cn(
			'max-w-full shrink-0',
			priorityInfo.colorClass,
			isDimmed && 'saturate-50 opacity-90',
			className,
		)}
		data-testid="gift-priority-badge"
		data-priority={priorityKey}
	>
		{priorityInfo.label()}
	</Badge>
{/if}
