<script lang="ts">
	import { onMount, type ComponentProps, type Snippet } from 'svelte';
	import * as Sheet from '$lib/components/base/sheet/index.js';
	import { cn } from '$lib/utils.js';

	type SheetContentProps = ComponentProps<typeof Sheet.Content>;

	interface Props {
		children: Snippet;
		class?: string;
		portalDisabled?: boolean;
		preventScroll?: boolean;
		onCloseAutoFocus?: SheetContentProps['onCloseAutoFocus'];
	}

	let {
		children,
		class: className,
		portalDisabled = false,
		preventScroll = true,
		onCloseAutoFocus,
	}: Props = $props();

	onMount(() => {
		const scrollPosition = { x: window.scrollX, y: window.scrollY };
		return () => {
			requestAnimationFrame(() => {
				window.scrollTo(scrollPosition.x, scrollPosition.y);
				requestAnimationFrame(() => window.scrollTo(scrollPosition.x, scrollPosition.y));
			});
		};
	});
</script>

<Sheet.Content
	side="bottom"
	portalProps={{ disabled: portalDisabled }}
	class={cn(
		'wishlist-bottom-sheet max-h-[80dvh] gap-0 overflow-hidden pb-[max(0.75rem,env(safe-area-inset-bottom))]',
		className,
	)}
	{preventScroll}
	{onCloseAutoFocus}
>
	{@render children()}
</Sheet.Content>

<style>
	:global(.wishlist-bottom-sheet) {
		left: max(0.5rem, env(safe-area-inset-left));
		right: max(0.5rem, env(safe-area-inset-right));
		width: auto;
		border: 2.5px solid var(--ink);
		border-bottom: 0;
		border-radius: var(--radius-panel) var(--radius-panel) 0 0;
	}

	:global(.wishlist-bottom-sheet [data-slot='sheet-close']) {
		width: 40px;
		min-width: 40px;
		height: 40px;
		min-height: 40px;
	}
</style>
