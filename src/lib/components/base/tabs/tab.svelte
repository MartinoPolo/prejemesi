<script lang="ts">
	import { cn } from '$lib/utils.js';
	import { tabVariants, type TabProps } from './tabs_variants.js';

	let {
		class: className,
		active = false,
		ref = $bindable(null),
		children,
		onkeydown,
		...restProps
	}: TabProps = $props();

	type TabKeyboardEvent = KeyboardEvent & { currentTarget: EventTarget & HTMLButtonElement };

	function handleKeydown(event: TabKeyboardEvent) {
		onkeydown?.(event);
		if (event.defaultPrevented) {
			return;
		}

		const tablist = event.currentTarget.closest('[role="tablist"]');
		const tabs = Array.from(
			tablist?.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)') ?? [],
		);
		const currentIndex = tabs.indexOf(event.currentTarget);
		if (currentIndex < 0 || tabs.length === 0) {
			return;
		}

		const orientation = tablist?.getAttribute('aria-orientation') ?? 'horizontal';
		let nextIndex: number;
		switch (event.key) {
			case orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight':
				nextIndex = (currentIndex + 1) % tabs.length;
				break;
			case orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft':
				nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
				break;
			case 'Home':
				nextIndex = 0;
				break;
			case 'End':
				nextIndex = tabs.length - 1;
				break;
			default:
				return;
		}

		event.preventDefault();
		const nextTab = tabs[nextIndex];
		nextTab.focus({ preventScroll: true });
		nextTab.click();

		if (tablist) {
			const tablistRect = tablist.getBoundingClientRect();
			const nextTabRect = nextTab.getBoundingClientRect();
			if (orientation === 'vertical') {
				if (nextTabRect.top < tablistRect.top) {
					tablist.scrollTop -= tablistRect.top - nextTabRect.top;
				} else if (nextTabRect.bottom > tablistRect.bottom) {
					tablist.scrollTop += nextTabRect.bottom - tablistRect.bottom;
				}
			} else if (nextTabRect.left < tablistRect.left) {
				tablist.scrollLeft -= tablistRect.left - nextTabRect.left;
			} else if (nextTabRect.right > tablistRect.right) {
				tablist.scrollLeft += nextTabRect.right - tablistRect.right;
			}
		}
	}
</script>

<button
	bind:this={ref}
	data-slot="tab"
	role="tab"
	type="button"
	aria-selected={active}
	onkeydown={handleKeydown}
	class={cn(tabVariants({ active }), className)}
	{...restProps}
	tabindex={active ? 0 : -1}
>
	{@render children?.()}
</button>
