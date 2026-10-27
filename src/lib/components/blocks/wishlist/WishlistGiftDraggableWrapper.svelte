<script lang="ts">
	import GripVerticalIcon from '@lucide/svelte/icons/grip-vertical';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
	import * as m from '$lib/paraglide/messages.js';
	import { normalizeGiftUrl } from '$lib/modules/gifts/gift_url.js';
	import { cn } from '$lib/utils.js';
	import type { Snippet } from 'svelte';
	import type { Attachment } from 'svelte/attachments';
	import {
		createGiftLongPressRecognizer,
		GIFT_REORDER_LONG_PRESS_MS,
	} from '$lib/modules/gifts/gift_long_press.js';
	import { GIFT_CARD_CONTROL_SELECTOR } from '$lib/components/blocks/gift/gift_card_controls.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { CheckboxSurface, checkboxVariants } from '$lib/components/base/checkbox/index.js';
	import { ElevationSurface } from '$lib/components/base/elevation-surface/index.js';
	import type { GiftReorderGroupPosition } from './gift_reorder_view.svelte.js';

	interface WishlistGiftDraggableWrapperProps {
		index: number;
		totalCount: number;
		giftId: string;
		reorderEnabled: boolean;
		draggedGiftId: string | null;
		dragOverGiftId: string | null;
		dragOverStyle: 'ring' | 'bg';
		giftName: string;
		primaryLink: string | null;
		class?: string;
		children: Snippet;
		onopendetail: () => void;
		onreorderpointerdown: (event: PointerEvent, index: number) => void;
		onreordermove: (index: number, direction: -1 | 1) => void;
		selectionMode?: boolean;
		selectionLayout?: 'overlay' | 'list';
		selected?: boolean;
		onselectiontoggle?: (giftId: string) => void;
		oncontextmenu?: (event: MouseEvent) => boolean;
		onlongpress?: () => boolean | void;
		/** Grouped reorder: the priority or category group this gift belongs to while reordering. */
		reorderGroupKey?: string;
		canMoveBackward?: boolean;
		canMoveForward?: boolean;
		/** Grouped reorder: zero-based position within the gift's group and that group's size. */
		groupPosition?: GiftReorderGroupPosition;
	}

	let {
		index,
		totalCount,
		giftId,
		reorderEnabled,
		draggedGiftId,
		dragOverGiftId,
		dragOverStyle,
		giftName,
		primaryLink,
		class: className = undefined,
		children,
		onopendetail,
		onreorderpointerdown,
		onreordermove,
		selectionMode = false,
		selectionLayout = 'overlay',
		selected = false,
		onselectiontoggle,
		oncontextmenu,
		onlongpress,
		reorderGroupKey,
		canMoveBackward,
		canMoveForward,
		groupPosition,
	}: WishlistGiftDraggableWrapperProps = $props();

	const backwardMoveAvailable = $derived(canMoveBackward ?? index > 0);
	const forwardMoveAvailable = $derived(canMoveForward ?? index < totalCount - 1);
	const displayedPosition = $derived(
		`${(groupPosition?.index ?? index) + 1}/${groupPosition?.total ?? totalCount}`,
	);

	let longPressPending = $state(false);
	let touchPressActive = false;
	let suppressNextClickAfterLongPress = $state(false);
	const longPress = createGiftLongPressRecognizer(
		() => {
			if (selectionMode) {
				onselectiontoggle?.(giftId);
				// The release may still click, which would toggle the gift back.
				suppressNextClickAfterLongPress = true;
				return;
			}
			suppressNextClickAfterLongPress = onlongpress?.() === true;
		},
		(pending) => {
			longPressPending = pending;
		},
	);
	/** The touch press a reorder long-press turns into a drag once it completes. */
	let pendingReorderPress: PointerEvent | null = null;
	const reorderLongPress = createGiftLongPressRecognizer(
		() => {
			if (pendingReorderPress !== null) {
				onreorderpointerdown(pendingReorderPress, index);
				pendingReorderPress = null;
			}
		},
		(pending) => {
			longPressPending = pending;
		},
		GIFT_REORDER_LONG_PRESS_MS,
	);
	const reorderGripVisible = $derived(reorderEnabled && !selectionMode);
	const isDragged = $derived(draggedGiftId === giftId);
	const isDragOver = $derived(dragOverGiftId === giftId);
	const safePrimaryLink = $derived(normalizeGiftUrl(primaryLink));
	const selectionCheckboxStyles = checkboxVariants({ size: 'responsive' });

	$effect(() => () => {
		longPress.cancel();
		reorderLongPress.cancel();
	});

	/**
	 * Outside the grip the card keeps native touch scrolling, so a long-press drag cancels its
	 * touch's scrolling itself. Browsers honour that only from a non-passive listener that existed
	 * before the touch started.
	 */
	const blockTouchScrollWhileDragged: Attachment<HTMLElement> = (element) => {
		function preventScroll(event: TouchEvent) {
			if (draggedGiftId === giftId && event.cancelable) {
				event.preventDefault();
			}
		}
		element.addEventListener('touchmove', preventScroll, { passive: false });
		return () => element.removeEventListener('touchmove', preventScroll);
	};

	function eventStartedInsideInteractiveElement(event: Event): boolean {
		const target = event.target;
		const currentTarget = event.currentTarget;

		if (!(target instanceof Element) || !(currentTarget instanceof Element)) {
			return false;
		}

		const interactiveElement = target.closest(GIFT_CARD_CONTROL_SELECTOR);

		return interactiveElement !== null && interactiveElement !== currentTarget;
	}

	function suppressSelectionContext(event: Event) {
		event.preventDefault();
		event.stopPropagation();
	}

	function handleClick(event: MouseEvent) {
		if (suppressNextClickAfterLongPress) {
			suppressNextClickAfterLongPress = false;
			event.preventDefault();
			event.stopPropagation();
			return;
		}
		if (selectionMode) {
			suppressSelectionContext(event);
			onselectiontoggle?.(giftId);
			return;
		}
		if (reorderEnabled) {
			suppressSelectionContext(event);
			return;
		}
		if (eventStartedInsideInteractiveElement(event)) {
			return;
		}
		onopendetail();
	}

	function handleContextMenu(event: MouseEvent) {
		const touchContextMenu = touchPressActive || isTouchOrPenEvent(event);
		if (selectionMode || reorderEnabled) {
			suppressSelectionContext(event);
			if (selectionMode && touchContextMenu) {
				longPress.complete();
			}
			return;
		}
		if (eventStartedInsideInteractiveElement(event)) {
			event.stopPropagation();
			return;
		}
		if (touchContextMenu) {
			// Mobile browsers fire contextmenu at their own long-press delay, which may come before
			// the recognizer's; the press completes then instead of showing the browser menu.
			suppressSelectionContext(event);
			longPress.complete();
			return;
		}
		if (!(oncontextmenu?.(event) ?? false)) {
			event.preventDefault();
		}
	}

	/** Mouse and pen drag the card at once; touch needs a long-press so swipes still scroll. */
	function handleReorderPointerDown(event: PointerEvent) {
		if (event.pointerType !== 'touch') {
			onreorderpointerdown(event, index);
			return;
		}
		pendingReorderPress = event;
		reorderLongPress.start(event.clientX, event.clientY);
	}

	function isTouchOrPenEvent(event: MouseEvent) {
		return (
			event instanceof PointerEvent &&
			(event.pointerType === 'touch' || event.pointerType === 'pen')
		);
	}

	function handlePointerDown(event: PointerEvent) {
		suppressNextClickAfterLongPress = false;
		touchPressActive = event.pointerType !== 'mouse';
		if (selectionMode) {
			suppressSelectionContext(event);
			if (event.pointerType !== 'mouse') {
				longPress.start(event.clientX, event.clientY);
			}
			return;
		}
		if (event.pointerType !== 'mouse') {
			event.stopPropagation();
		}
		if (eventStartedInsideInteractiveElement(event)) {
			return;
		}
		if (reorderEnabled) {
			handleReorderPointerDown(event);
		} else if (event.pointerType !== 'mouse') {
			longPress.start(event.clientX, event.clientY);
		}
	}

	function handlePointerMove(event: PointerEvent) {
		if (event.pointerType !== 'mouse') {
			longPress.move(event.clientX, event.clientY);
			reorderLongPress.move(event.clientX, event.clientY);
		}
	}

	function endLongPresses() {
		touchPressActive = false;
		longPress.end();
		reorderLongPress.end();
	}

	function handleAuxclick(event: MouseEvent) {
		if (
			event.button !== 1 ||
			safePrimaryLink === null ||
			selectionMode ||
			reorderEnabled ||
			eventStartedInsideInteractiveElement(event)
		) {
			return;
		}

		event.preventDefault();
		window.open(safePrimaryLink, '_blank', 'noopener,noreferrer');
	}

	function handleKeydown(event: KeyboardEvent) {
		if (
			(selectionMode || reorderEnabled) &&
			(event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey))
		) {
			suppressSelectionContext(event);
			return;
		}
		if (eventStartedInsideInteractiveElement(event)) {
			return;
		}
		if (reorderEnabled) {
			return;
		}
		if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) {
			event.preventDefault();
			const element = event.currentTarget as HTMLElement;
			const rect = element.getBoundingClientRect();
			element.dispatchEvent(
				new MouseEvent('contextmenu', {
					bubbles: true,
					cancelable: true,
					clientX: rect.left + rect.width / 2,
					clientY: rect.top + rect.height / 2,
				}),
			);
			return;
		}
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			if (selectionMode) {
				onselectiontoggle?.(giftId);
			} else {
				onopendetail();
			}
		}
	}

	function handleGripKeydown(event: KeyboardEvent) {
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
	data-gift-id={giftId}
	data-gift-reorder-group={reorderGroupKey}
	data-long-press-pending={longPressPending || undefined}
	class:gift-reorder-grip-owner={reorderGripVisible}
	class:gift-reorder-list-owner={reorderGripVisible && selectionLayout === 'list'}
	class:gift-selection-owner={selectionMode}
	class:gift-selection-list-owner={selectionMode && selectionLayout === 'list'}
	class={cn(
		selectionMode
			? 'relative h-full cursor-default rounded-panel transition-opacity focus-visible:outline-none'
			: 'group/gift-card relative h-full cursor-pointer rounded-panel transition-opacity focus-visible:outline-none',
		reorderGripVisible && 'cursor-grab active:cursor-grabbing',
		className,
		isDragged && 'invisible',
		isDragOver && dragOverStyle === 'ring' && 'ring-2 ring-inset ring-primary',
		isDragOver && dragOverStyle === 'bg' && 'bg-primary/5',
		selectionMode &&
			selectionLayout === 'list' &&
			'sm:grid sm:grid-cols-[var(--size-control-md)_minmax(0,1fr)] sm:gap-(--nested-control-gap)',
	)}
	data-selected={selectionMode && selected ? true : undefined}
	role={selectionMode ? 'checkbox' : reorderEnabled ? undefined : 'button'}
	tabindex={reorderEnabled ? undefined : 0}
	aria-label={selectionMode
		? m.gift_selection_item_aria({ name: giftName })
		: reorderEnabled
			? undefined
			: m.gift_open_detail_aria({ name: giftName })}
	aria-checked={selectionMode ? selected : undefined}
	aria-selected={selectionMode ? selected : undefined}
	onclick={handleClick}
	onauxclick={handleAuxclick}
	oncontextmenu={handleContextMenu}
	onpointerdown={handlePointerDown}
	onpointermove={handlePointerMove}
	onpointerup={endLongPresses}
	onpointercancel={endLongPresses}
	onkeydown={handleKeydown}
	{@attach reorderGripVisible && blockTouchScrollWhileDragged}
>
	{#if selectionMode}
		<span
			class={cn(
				selectionCheckboxStyles.owner(),
				'gift-selection-control pointer-events-none absolute z-50',
				selectionLayout === 'list' && 'sm:static sm:self-start sm:translate-y-2',
			)}
			data-testid="gift-selection-control"
			aria-hidden="true"
		>
			<CheckboxSurface checked={selected} />
		</span>
	{/if}
	{#if reorderGripVisible}
		<button
			type="button"
			aria-label={m.gift_reorder_grip_label()}
			title={m.gift_reorder_keyboard_hint()}
			class="group/grip elevation-owner elevation-owner-raised absolute left-(--gift-reorder-grip-offset) top-(--gift-reorder-grip-offset) z-50 grid size-(--gift-reorder-grip-target-size) cursor-grab touch-none place-items-start rounded-(--gift-reorder-grip-radius) p-0 outline-offset-[-3px] focus-visible:outline-[3px] focus-visible:outline-ring active:cursor-grabbing"
			data-gift-reorder-grip
			data-prevent-gift-card-open
			onpointerdown={(event) => onreorderpointerdown(event, index)}
			onkeydown={handleGripKeydown}
		>
			<ElevationSurface
				class="ml-(--gift-reorder-grip-face-inset) mt-(--gift-reorder-grip-face-inset) grid size-(--gift-reorder-grip-face-size) place-items-center rounded-(--gift-reorder-grip-face-radius) border-2 border-ink bg-card transition-[translate,scale,box-shadow,background-color,opacity] duration-200 ease-spring group-hover/grip:bg-accent"
			>
				<GripVerticalIcon class="size-5 text-muted-foreground sm:size-4" />
			</ElevationSurface>
		</button>
	{/if}
	<div
		class="contents"
		inert={selectionMode || reorderEnabled || undefined}
		data-selection-inert={selectionMode || reorderEnabled || undefined}
	>
		{@render children()}
	</div>
	{#if reorderGripVisible}
		<div
			class={cn(
				'gift-reorder-directional-actions absolute z-50 items-center',
				selectionLayout === 'list' ? 'flex sm:hidden' : 'gift-card-directional-actions',
			)}
			data-testid="gift-reorder-directional-actions"
		>
			<span class="pointer-events-none px-1 text-sm font-medium" aria-hidden="true">
				{displayedPosition}
			</span>
			<Button
				type="button"
				intent="secondary"
				size="lg"
				format="icon"
				aria-label={m.gift_reorder_move_up({ name: giftName })}
				disabled={!backwardMoveAvailable}
				data-prevent-gift-card-open
				onclick={(event) => {
					event.stopPropagation();
					onreordermove(index, -1);
				}}
			>
				<ArrowUpIcon />
			</Button>
			<Button
				type="button"
				intent="secondary"
				size="lg"
				format="icon"
				aria-label={m.gift_reorder_move_down({ name: giftName })}
				disabled={!forwardMoveAvailable}
				data-prevent-gift-card-open
				onclick={(event) => {
					event.stopPropagation();
					onreordermove(index, 1);
				}}
			>
				<ArrowDownIcon />
			</Button>
		</div>
	{/if}
</div>

<style>
	[data-gift-item] {
		--gift-context-face-inset: max(0px, calc(var(--radius-panel) - var(--radius-btn)));
		--gift-context-shadow-inset: calc(var(--gift-context-face-inset) + var(--depth-clearance));
		--gift-reorder-grip-offset: 0px;
		--gift-reorder-grip-face-inset: 0.25rem;
		--gift-reorder-grip-face-size: 2.5rem;

		/* Touch keeps a larger hit target than the visible face. */
		--gift-reorder-grip-target-size: 60px;

		/* Nested corners: the card radius minus each surface's inset from the card edge. */
		--gift-reorder-grip-radius: max(
			0px,
			calc(var(--radius-panel) - var(--gift-reorder-grip-offset))
		);
		--gift-reorder-grip-face-radius: max(
			0px,
			calc(var(--gift-reorder-grip-radius) - var(--gift-reorder-grip-face-inset))
		);
	}

	@media (width >= 640px) {
		[data-gift-item] {
			--gift-reorder-grip-offset: 0.25rem;
			--gift-reorder-grip-face-size: var(--size-control-md);
			--gift-reorder-grip-target-size: calc(
				var(--gift-reorder-grip-face-size) + 2 * var(--gift-reorder-grip-face-inset)
			);
		}
	}

	/* Gift content overlaying the top-left corner (the category badge) starts after the grip face
	   and its depth shadow. */
	.gift-reorder-grip-owner {
		--gift-context-leading-clearance: calc(
			var(--gift-reorder-grip-offset) + var(--gift-reorder-grip-face-inset) +
				var(--gift-reorder-grip-face-size) + var(--nested-control-gap)
		);

		/* A press anywhere on the card drags it, where text selection and touch callouts get in the
		   way. */
		user-select: none;
		-webkit-touch-callout: none;
	}

	/* The category badge starts after the selection checkbox, like it does after the reorder grip. */
	.gift-selection-owner {
		--gift-context-leading-clearance: calc(
			var(--gift-context-face-inset) + var(--size-control-lg) + var(--nested-control-gap)
		);
	}

	/* The narrow List image cannot fit both side by side, so the badge sits below the checkbox. */
	.gift-selection-list-owner {
		--gift-context-leading-clearance: initial;
		--gift-context-top-clearance: calc(
			var(--gift-context-face-inset) + var(--size-control-lg) + var(--nested-control-gap)
		);
	}

	@media (width >= 640px) {
		.gift-selection-owner {
			--gift-context-leading-clearance: calc(
				var(--gift-context-face-inset) + var(--size-control-md) + var(--nested-control-gap)
			);
		}

		/* The List checkbox moves into its own gutter, so the badge keeps its ordinary place. */
		.gift-selection-list-owner {
			--gift-context-leading-clearance: initial;
			--gift-context-top-clearance: initial;
		}
	}

	.gift-selection-control {
		inset-block-start: var(--gift-context-face-inset);
		inset-inline-start: var(--gift-context-face-inset);
	}

	.gift-reorder-directional-actions {
		inset-inline-end: var(--gift-context-shadow-inset);
		inset-block-end: var(--gift-context-shadow-inset);
		gap: var(--nested-control-gap);
	}

	/* Mobile List arrows get their own row below the content, like the browse actions. */
	@media (width < 640px) {
		.gift-reorder-list-owner {
			--gift-list-reserved-bottom-lane: calc(
				var(--size-control-lg) + var(--nested-control-gap)
			);
		}
	}

	/* Selection follows the moving Card paint and the flat List surface. */
	[data-gift-item][data-selected] :global(.gift-card-painted-surface)::before,
	[data-gift-item][data-selected] :global([data-testid='gift-list-item'])::before {
		position: absolute;
		z-index: 30;
		inset: 0;
		background: var(--selection-image-tint);
		box-shadow: inset 0 0 0 3px var(--selection-ring);
		content: '';
		pointer-events: none;
	}

	[data-gift-item][data-selected] :global(.gift-card-painted-surface)::before {
		border-radius: max(0px, calc(var(--radius-panel) - var(--nested-border-inline, 2.5px))) /
			max(0px, calc(var(--radius-panel) - var(--nested-border-block, 2.5px)));
	}

	/* Absolute children start at the padding edge; subtract the List surface's 2px border. */
	[data-gift-item][data-selected] :global([data-testid='gift-list-item'])::before {
		border-radius: calc(var(--radius-panel) - 2px);
	}

	/* Painted above the card's opaque surface, which would cover a ring on the wrapper itself. */
	[data-gift-item]:focus-visible::after,
	[data-gift-item][data-long-press-pending]::after {
		position: absolute;
		z-index: 40;
		inset: 0;
		border-radius: var(--radius-panel);
		box-shadow: inset 0 0 0 2px var(--ring);
		content: '';
		pointer-events: none;
	}

	[data-gift-item][data-long-press-pending]::after {
		box-shadow: inset 0 0 0 2px color-mix(in oklab, var(--primary) 35%, transparent);
	}

	.gift-card-directional-actions {
		display: none;
	}

	@media (width <= 320px) {
		.gift-card-directional-actions {
			display: flex;
		}
	}
</style>
