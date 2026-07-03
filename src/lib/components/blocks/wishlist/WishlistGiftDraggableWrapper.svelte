<script lang="ts">
	import GripVerticalIcon from '@lucide/svelte/icons/grip-vertical';
	import { cn } from '$lib/utils.js';
	import type { Snippet } from 'svelte';

	interface WishlistGiftDraggableWrapperProps {
		index: number;
		isOwnerOrModerator: boolean;
		draggedIndex: number | null;
		dragOverIndex: number | null;
		dragOverStyle: 'ring' | 'bg';
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
		isOwnerOrModerator,
		draggedIndex,
		dragOverIndex,
		dragOverStyle,
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

		onedit();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (eventStartedInsideInteractiveElement(event)) {
			return;
		}

		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			onedit();
		}
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
	class={cn(
		'relative transition-opacity',
		isOwnerOrModerator && 'cursor-pointer',
		isDragged && 'opacity-40',
		isDragOver && dragOverStyle === 'ring' && 'rounded-xl ring-2 ring-primary ring-offset-2',
		isDragOver && dragOverStyle === 'bg' && 'bg-primary/5',
	)}
	role={isOwnerOrModerator ? 'button' : undefined}
	tabindex={isOwnerOrModerator ? 0 : undefined}
	onclick={handleClick}
	onkeydown={handleKeydown}
	draggable={isOwnerOrModerator}
	{ondragstart}
	{ondragover}
	{ondragleave}
	{ondrop}
	{ondragend}
>
	{#if isOwnerOrModerator}
		<div
			class="absolute left-2 top-2 z-10 cursor-grab rounded bg-background/80 p-0.5 opacity-60 transition-opacity hover:opacity-100"
		>
			<GripVerticalIcon class="size-4 text-muted-foreground" />
		</div>
	{/if}
	{@render children()}
</div>
