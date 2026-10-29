<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Skeleton } from '$lib/components/base/skeleton/index.js';

	const ROW_SHAPES = [true, false, true, true];
</script>

{#snippet skeletonRow(withCards: boolean)}
	<div class="skeleton-row">
		<div class="skeleton-band">
			<Skeleton class="size-8 shrink-0" />
			<Skeleton class="h-5 w-36" />
			<Skeleton class="ml-auto h-6 w-28" />
		</div>
		<div class="skeleton-stack">
			<Skeleton class="h-4 w-3/5" />
			<Skeleton class="h-3.5 w-4/5" />
			<Skeleton class="h-3.5 w-1/2" />
		</div>
		{#if withCards}
			<div class="skeleton-cards">
				<Skeleton class="h-56 rounded-2xl" />
				<Skeleton class="h-56 rounded-2xl" />
			</div>
		{/if}
	</div>
{/snippet}

<div aria-busy="true" aria-label={m.change_review_loading()} data-testid="change-review-skeleton">
	<div class="skeleton-summary" aria-hidden="true">
		<Skeleton class="row-span-3 size-10" />
		<Skeleton class="h-4 w-1/2" />
		<Skeleton class="h-3.5 w-1/3" />
		<Skeleton class="mt-1.5 h-5 w-2/3" />
	</div>
	<div class="skeleton-list" aria-hidden="true">
		<Skeleton class="h-6 w-60" />
		{#each ROW_SHAPES as withCards, index (index)}
			{@render skeletonRow(withCards)}
		{/each}
	</div>
</div>

<style>
	.skeleton-summary {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: var(--space-1) 14px;
		margin-top: var(--space-4);
		padding: 14px var(--space-4);
		border: 2px solid var(--border-strong);
		border-radius: var(--radius-panel);
		background: var(--card);
	}

	.skeleton-list {
		display: grid;
		gap: var(--space-3);
		margin-top: 28px;
	}

	.skeleton-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: var(--space-3) 14px;
		padding: 0 var(--space-4) 14px;
		border: 2px solid var(--border-strong);
		border-radius: var(--radius-panel);
		background: var(--card);
	}

	/* Top corners follow the nested-corner rule: outer radius minus the border, no inset. */
	.skeleton-band {
		display: flex;
		grid-column: 1 / -1;
		align-items: center;
		gap: 14px;
		margin-inline: calc(-1 * var(--space-4));
		padding: 10px var(--space-4) var(--space-3);
		border-bottom: 2px solid var(--border-strong);
		border-radius: calc(var(--radius-panel) - 2px) calc(var(--radius-panel) - 2px) 0 0;
		background: var(--muted);
	}

	.skeleton-stack {
		display: grid;
		align-content: start;
		gap: var(--space-2);
	}

	.skeleton-cards {
		display: grid;
		grid-template-columns: repeat(2, 208px);
		gap: 14px;
	}

	@container change-review (width < 900px) {
		.skeleton-row {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	@media (width < 640px) {
		.skeleton-cards {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
</style>
