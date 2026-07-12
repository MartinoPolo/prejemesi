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
		/**
		 * Visitor-only: the gift's primary link (sanitized). When a visitor (canManage=false)
		 * clicks/activates the card body or image, this link opens in a new tab. `null` when the
		 * gift has no link — the card is then inert (no pointer, not focusable). Ignored for managers,
		 * whose card click opens the edit modal via `onedit`.
		 */
		visitorLinkHref?: string | null;
		children: Snippet;
		onedit: () => void;
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
		visitorLinkHref = null,
		children,
		onedit,
		onreorderpointerdown,
		onreordermove,
	}: WishlistGiftDraggableWrapperProps = $props();

	const isDragged = $derived(draggedIndex === index);
	const isDragOver = $derived(dragOverIndex === index);

	// A visitor can open the card only when it carries a primary link. Managers ignore this and
	// keep their edit-modal / drag affordances.
	const visitorLinkActivatable = $derived(!canManage && visitorLinkHref !== null);
	// The card is interactive (clickable/focusable) either as a manager (opens edit modal) or as a
	// visitor with a link (opens the link).
	const isInteractive = $derived(canManage || visitorLinkActivatable);

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

	function activateCard() {
		if (canManage) {
			onedit();
			return;
		}
		// Visitor: open the gift's primary link in a new tab. No-op when the gift has no link.
		if (visitorLinkHref !== null) {
			window.open(visitorLinkHref, '_blank', 'noopener,noreferrer');
		}
	}

	function handleClick(event: MouseEvent) {
		if (eventStartedInsideInteractiveElement(event)) {
			return;
		}

		activateCard();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (eventStartedInsideInteractiveElement(event)) {
			return;
		}

		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			activateCard();
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

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
	data-gift-item
	class={cn(
		'relative transition-opacity',
		isInteractive && 'cursor-pointer',
		isDragged && 'opacity-40',
		isDragOver && dragOverStyle === 'ring' && 'rounded-xl ring-2 ring-primary ring-offset-2',
		isDragOver && dragOverStyle === 'bg' && 'bg-primary/5',
	)}
	role={canManage ? 'button' : visitorLinkActivatable ? 'link' : undefined}
	tabindex={isInteractive ? 0 : undefined}
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
