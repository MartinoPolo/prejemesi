<script lang="ts">
	import { Badge } from '$lib/components/base/badge/index.js';
	import { cn } from '$lib/utils.js';

	interface Props {
		/** Active filters; nothing renders at zero. */
		count: number;
		/** Placement only, such as pinning the count to a trigger's corner. */
		class?: string;
	}

	let { count, class: className }: Props = $props();
</script>

<!-- The trigger's accessible name carries the count, so the visual pill is hidden from it. -->
{#if count > 0}
	{#key count}
		<Badge
			tone="primary"
			badgeStyle="count"
			class={cn('active-filter-count shrink-0', className)}
			data-filter-count
			aria-hidden="true"
		>
			{count}
		</Badge>
	{/key}
{/if}

<style>
	@keyframes active-filter-count-acknowledge {
		from {
			opacity: 0;
		}

		to {
			opacity: 1;
		}
	}

	@media (prefers-reduced-motion: no-preference) {
		:global(.active-filter-count) {
			animation: active-filter-count-acknowledge 220ms cubic-bezier(0.2, 0.7, 0.3, 1);
		}
	}
</style>
