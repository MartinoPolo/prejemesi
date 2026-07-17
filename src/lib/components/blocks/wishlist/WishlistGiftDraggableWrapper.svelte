<script lang="ts">
	import GripVerticalIcon from '@lucide/svelte/icons/grip-vertical';
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils.js';
	import type { Snippet } from 'svelte';

	interface WishlistGiftDraggableWrapperProps {
		index: number;
		canManage: boolean;
		draggedIndex: number | null;
		dragOverIndex: number | null;
		dragOverStyle: 'ring' | 'bg';
		/** Accessible name for the card's button role (issue #125 REQ-4). */
		giftName: string;
		children: Snippet;
		/**
		 * Opens the gift detail modal (issue #125): edit mode for managers, read-only for
		 * everyone else. The visible link chip is a separate click target (stops propagation)
		 * and always navigates externally instead.
		 */
		onopendetail: () => void;
		/** Grip pointerdown — starts a pointer-driven reorder drag (mouse + touch + pen). */
		onreorderpointerdown: (event: PointerEvent, index: number) => void;
		/** Keyboard reorder from the grip: move this gift one slot toward the list start/end. */
		onreordermove: (index: number, direction: -1 | 1) => void;
	}

	let {
		index,
		canManage,
		draggedIndex,
		dragOverIndex,
		dragOverStyle,
		giftName,
		children,
		onopendetail,
		onreorderpointerdown,
		onreordermove,
	}: WishlistGiftDraggableWrapperProps = $props();

	const isDragged = $derived(draggedIndex === index);
	const isDragOver = $derived(dragOverIndex === index);

	function eventStartedInsideInteractiveElement(event: Event): boolean {
		const target = event.target;
		const currentTarget = event.currentTarget;

		if (!(target instanceof Element) || !(currentTarget instanceof Element)) {
			return false;
		}

		const interactiveElement = target.closest(
			'a, button, input, textarea, select, [data-prevent-gift-card-open]',
		);

		return interactiveElement !== null && interactiveElement !== currentTarget;
	}

	function handleClick(event: MouseEvent) {
		if (eventStartedInsideInteractiveElement(event)) {
			return;
		}

		onopendetail();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (eventStartedInsideInteractiveElement(event)) {
			return;
		}

		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			onopendetail();
		}
	}

	function handleGripKeydown(event: KeyboardEvent) {
		// Keyboard reorder affordance: Arrow Up/Left moves the gift earlier, Down/Right later.
		if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
			event.preventDefault();
			onreordermove(index, -1);
		} else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
			event.preventDefault();
			onreordermove(index, 1);
		}
	}
</script>

<!-- Card click/tap opens the gift detail modal for every role (issue #125): edit mode for
     managers, read-only for visitors. The link chip inside `children` stops propagation and
     stays the only external-navigation target. -->
<div
	data-gift-item
	class={cn(
		'relative h-full cursor-pointer transition-opacity',
		isDragged && 'opacity-40',
		isDragOver && dragOverStyle === 'ring' && 'rounded-xl ring-2 ring-primary ring-offset-2',
		isDragOver && dragOverStyle === 'bg' && 'bg-primary/5',
	)}
	role="button"
	tabindex={0}
	aria-label={m.gift_open_detail_aria({ name: giftName })}
	onclick={handleClick}
	onkeydown={handleKeydown}
>
	{#if canManage}
		<!-- Grip is the drag handle. `touch-action: none` stops the browser hijacking the touch
		     gesture for scrolling so pointer reordering works on phones/tablets. -->
		<button
			type="button"
			aria-label={m.gift_reorder_grip_label()}
			title={m.gift_reorder_keyboard_hint()}
			class="absolute left-2 top-2 z-10 cursor-grab touch-none rounded bg-background/80 p-0.5 opacity-60 transition-opacity hover:opacity-100 focus-visible:opacity-100 active:cursor-grabbing"
			data-prevent-gift-card-open
			onpointerdown={(event) => onreorderpointerdown(event, index)}
			onkeydown={handleGripKeydown}
		>
			<GripVerticalIcon class="size-4 text-muted-foreground" />
		</button>
	{/if}
	{@render children()}
</div>
