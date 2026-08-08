<script lang="ts">
	import { cn } from '$lib/utils.js';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import * as m from '$lib/paraglide/messages.js';
	import { czechPluralCategory } from '$lib/modules/gifts/gift_display.js';

	interface ViewAllCardProps {
		/** Destination category page („Sledované" / „Spravované" / „Moje seznamy"). */
		href: string;
		/** How many more lists exist beyond the visible slides (total − visible). */
		remaining: number;
		class?: string;
	}

	let { href, remaining, class: className }: ViewAllCardProps = $props();

	const remainingLabel = $derived.by(() => {
		const category = czechPluralCategory(remaining);
		if (category === 'one') {
			return m.home_more_lists_one({ count: remaining });
		}
		if (category === 'few') {
			return m.home_more_lists_few({ count: remaining });
		}
		return m.home_more_lists_other({ count: remaining });
	});
</script>

<a {href} class={cn('view-all-card', className)} data-testid="view-all-card">
	<span class="circle" aria-hidden="true">
		<ArrowRightIcon class="size-4" />
	</span>
	<span class="label">{m.nav_view_all()}</span>
	{#if remaining > 0}
		<span class="count">{remainingLabel}</span>
	{/if}
</a>

<style>
	.view-all-card {
		display: flex;
		height: 100%;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 10px;
		border: var(--border-w) dashed var(--ink-faint);
		border-radius: var(--radius-panel);
		background: color-mix(in oklab, var(--card) 55%, transparent);
		color: var(--brand-deep);
		font-weight: 700;
		font-size: var(--text-base);
		text-align: center;
		padding: var(--space-4);
		transition:
			transform 200ms var(--ease-spring),
			border-color 200ms;
	}

	.view-all-card:hover {
		transform: translateY(-4px);
		border-color: var(--ink);
	}

	.circle {
		width: 44px;
		height: 44px;
		border-radius: 999px;
		border: 2px solid var(--ink);
		background: var(--card);
		box-shadow: var(--shadow-sticker-sm);
		display: grid;
		place-items: center;
		color: var(--foreground);
	}

	.count {
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--muted-foreground);
	}
</style>
