<script lang="ts">
	import GripVerticalIcon from '@lucide/svelte/icons/grip-vertical';
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils.js';
	import type { Snippet } from 'svelte';

	interface WishlistGiftDraggableWrapperProps {
		index: number;
		giftId: string;
		reorderEnabled: boolean;
		draggedGiftId: string | null;
		dragOverGiftId: string | null;
		dragOverStyle: 'ring' | 'bg';
		/** Accessible name for the card's button role (issue #125 REQ-4). */
		giftName: string;
		/** Extra layout classes from the host view (the card grid passes its subgrid span). */
		class?: string;
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
		giftId,
		reorderEnabled,
		draggedGiftId,
		dragOverGiftId,
		dragOverStyle,
		giftName,
		class: className = undefined,
		children,
		onopendetail,
		onreorderpointerdown,
		onreordermove,
	}: WishlistGiftDraggableWrapperProps = $props();

	const isDragged = $derived(draggedGiftId === giftId);
	const isDragOver = $derived(dragOverGiftId === giftId);

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
	data-gift-id={giftId}
	class={cn(
		// Named hover group so the grip (an absolutely-positioned sibling of the card) and the card
		// lift as one unit: the card's own lift also keys off this group (see gift_card_variants),
		// so hovering/focusing the grip lifts the card too — not just the card body (issue #224 f/up).
		'group/gift-card relative h-full cursor-pointer transition-opacity',
		className,
		isDragged && 'invisible',
		isDragOver && dragOverStyle === 'ring' && 'rounded-xl ring-2 ring-primary ring-offset-2',
		isDragOver && dragOverStyle === 'bg' && 'bg-primary/5',
	)}
	role="button"
	tabindex={0}
	aria-label={m.gift_open_detail_aria({ name: giftName })}
	onclick={handleClick}
	onkeydown={handleKeydown}
>
	{#if reorderEnabled}
		<!-- Grip is the drag handle. `touch-action: none` stops the browser hijacking the touch
		     gesture for scrolling so pointer reordering works on phones/tablets. -->
		<button
			type="button"
			aria-label={m.gift_reorder_grip_label()}
			title={m.gift_reorder_keyboard_hint()}
			class="absolute left-2 top-2 z-10 cursor-grab touch-none rounded bg-background/80 p-0.5 opacity-60 transition-[opacity,transform] duration-200 ease-spring hover:opacity-100 focus-visible:opacity-100 active:cursor-grabbing motion-safe:group-hover/gift-card:-translate-y-1 motion-safe:group-focus-within/gift-card:-translate-y-1"
			data-prevent-gift-card-open
			onpointerdown={(event) => onreorderpointerdown(event, index)}
			onkeydown={handleGripKeydown}
		>
			<GripVerticalIcon class="size-4 text-muted-foreground" />
		</button>
	{/if}
	{@render children()}
</div>
