<script lang="ts">
	import type { Snippet } from 'svelte';
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis';
	import { Button } from '$lib/components/base/button/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils.js';
	import { giftActionRowVariants } from './gift_action_row_variants.js';

	interface Props {
		children?: Snippet;
		secondary?: Snippet;
		onmore?: (anchor: HTMLButtonElement) => void;
		moreOpen?: boolean;
		moreSurface?: 'menu' | 'dialog';
		controlSizing?: 'fill' | 'intrinsic';
		class?: string;
	}

	let {
		children,
		secondary,
		onmore,
		moreOpen = false,
		moreSurface = 'menu',
		controlSizing = 'fill',
		class: className,
	}: Props = $props();

	const styles = $derived(
		giftActionRowVariants({
			withMore: onmore !== undefined,
			withSecondary: secondary !== undefined,
			controlSizing,
		}),
	);
</script>

<div class={cn(styles.row(), className)} data-testid="gift-action-row">
	{#if secondary}
		<div class={styles.secondary()} data-testid="gift-action-secondary">
			{@render secondary()}
		</div>
	{/if}
	<div class={styles.primaryGroup()} data-testid="gift-action-primary-group">
		<div class={styles.primary()}>
			{@render children?.()}
		</div>
		{#if onmore}
			<Button
				intent="outline"
				format="icon"
				class={styles.more()}
				aria-label={m.gift_more_actions()}
				data-gift-action="more"
				data-testid="gift-more-actions"
				onclick={(event) => {
					event.stopPropagation();
					onmore(event.currentTarget as HTMLButtonElement);
				}}
				onkeydown={(event) => {
					if (event.key === 'ArrowDown') {
						event.preventDefault();
						event.stopPropagation();
						onmore(event.currentTarget as HTMLButtonElement);
					}
				}}
				aria-haspopup={moreSurface}
				aria-expanded={moreOpen}><EllipsisIcon data-icon /></Button
			>
		{/if}
	</div>
</div>

<style>
	.gift-action-slot :global(> [data-slot='button']) {
		min-width: 0;
	}
</style>
