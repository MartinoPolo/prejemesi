<script lang="ts">
	import GripVerticalIcon from '@lucide/svelte/icons/grip-vertical';
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
		ondragstart: (event: DragEvent) => void;
		ondragover: (event: DragEvent) => void;
		ondragleave: () => void;
		ondrop: (event: DragEvent) => void;
		ondragend: () => void;
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
		ondragstart,
		ondragover,
		ondragleave,
		ondrop,
		ondragend,
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
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
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
	draggable={canManage}
	{ondragstart}
	{ondragover}
	{ondragleave}
	{ondrop}
	{ondragend}
>
	{#if canManage}
		<div
			class="absolute left-2 top-2 z-10 cursor-grab rounded bg-background/80 p-0.5 opacity-60 transition-opacity hover:opacity-100"
		>
			<GripVerticalIcon class="size-4 text-muted-foreground" />
		</div>
	{/if}
	{@render children()}
</div>
