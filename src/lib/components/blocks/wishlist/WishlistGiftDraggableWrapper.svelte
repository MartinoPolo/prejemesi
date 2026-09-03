<script lang="ts">
	import GripVerticalIcon from '@lucide/svelte/icons/grip-vertical';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
	import * as m from '$lib/paraglide/messages.js';
	import { normalizeGiftUrl } from '$lib/modules/gifts/gift_url.js';
	import { cn } from '$lib/utils.js';
	import type { Snippet } from 'svelte';
	import { createGiftLongPressRecognizer } from '$lib/modules/gifts/gift_long_press.js';
	import { Checkbox } from '$lib/components/base/checkbox/index.js';
	import { Button } from '$lib/components/base/button/index.js';

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
	}: WishlistGiftDraggableWrapperProps = $props();

	let longPressPending = $state(false);
	let suppressNextClickAfterLongPress = $state(false);
	const longPress = createGiftLongPressRecognizer(
		() => {
			suppressNextClickAfterLongPress = onlongpress?.() === true;
		},
		(pending) => {
			longPressPending = pending;
		},
	);
	const isDragged = $derived(draggedGiftId === giftId);
	const isDragOver = $derived(dragOverGiftId === giftId);
	const safePrimaryLink = $derived(normalizeGiftUrl(primaryLink));

	$effect(() => () => longPress.cancel());

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
		if (selectionMode || reorderEnabled) {
			suppressSelectionContext(event);
			return;
		}
		if (eventStartedInsideInteractiveElement(event)) {
			event.stopPropagation();
			return;
		}
		if (!(oncontextmenu?.(event) ?? false)) {
			event.preventDefault();
		}
	}

	function handlePointerDown(event: PointerEvent) {
		suppressNextClickAfterLongPress = false;
		if (selectionMode) {
			suppressSelectionContext(event);
			return;
		}
		if (event.pointerType === 'mouse') {
			return;
		}
		event.stopPropagation();
		if (eventStartedInsideInteractiveElement(event)) {
			return;
		}
		longPress.start(event.clientX, event.clientY);
	}

	function handlePointerMove(event: PointerEvent) {
		if (event.pointerType !== 'mouse') {
			longPress.move(event.clientX, event.clientY);
		}
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
	data-long-press-pending={longPressPending || undefined}
	class={cn(
		selectionMode
			? 'relative h-full cursor-default transition-[opacity,box-shadow]'
			: 'group/gift-card relative h-full cursor-pointer transition-opacity',
		className,
		isDragged && 'invisible',
		isDragOver && dragOverStyle === 'ring' && 'rounded-xl ring-2 ring-primary ring-offset-2',
		isDragOver && dragOverStyle === 'bg' && 'bg-primary/5',
		selectionMode &&
			selectionLayout === 'list' &&
			'sm:grid sm:grid-cols-[1.75rem_minmax(0,1fr)] sm:gap-2',
		selected &&
			'rounded-xl bg-[var(--selection-tint)] outline-[3px] outline-[var(--selection-ring)] [&>div]:bg-transparent',
		longPressPending && 'ring-2 ring-primary/35 ring-offset-2',
	)}
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
	onpointerup={() => longPress.end()}
	onpointercancel={() => longPress.cancel()}
	onkeydown={handleKeydown}
>
	{#if selectionMode}
		<span
			class={cn(
				'pointer-events-none absolute left-1 top-1 z-50 grid size-10 place-items-center rounded-md border-2 border-ink bg-card shadow-sticker sm:left-2.5 sm:top-2.5 sm:size-7 sm:border-0 sm:shadow-sm',
				selectionLayout === 'list' &&
					'sm:static sm:left-auto sm:top-auto sm:self-start sm:translate-y-2',
			)}
			aria-hidden="true"
		>
			<Checkbox checked={selected} tabindex={-1} />
		</span>
		{#if selected}<span
				class="pointer-events-none absolute inset-0 z-[1] rounded-[inherit] bg-[var(--selection-image-tint)]"
				aria-hidden="true"
			></span>{/if}
	{/if}
	{#if reorderEnabled && !selectionMode}
		<button
			type="button"
			aria-label={m.gift_reorder_grip_label()}
			title={m.gift_reorder_keyboard_hint()}
			class="absolute left-1 top-1 z-50 grid size-10 cursor-grab touch-none place-items-center rounded-md border-2 border-ink bg-card p-0 shadow-sticker transition-[opacity,transform] duration-200 ease-spring hover:bg-accent focus-visible:opacity-100 active:cursor-grabbing motion-safe:group-hover/gift-card:-translate-y-1 motion-safe:group-focus-within/gift-card:-translate-y-1 sm:left-2 sm:top-2 sm:z-10 sm:size-auto sm:rounded sm:border-0 sm:bg-card/80 sm:p-0.5 sm:opacity-60 sm:shadow-none"
			data-prevent-gift-card-open
			onpointerdown={(event) => onreorderpointerdown(event, index)}
			onkeydown={handleGripKeydown}
		>
			<GripVerticalIcon class="size-4 text-muted-foreground" />
		</button>
	{/if}
	<div
		class="contents"
		inert={selectionMode || reorderEnabled || undefined}
		data-selection-inert={selectionMode || reorderEnabled || undefined}
	>
		{@render children()}
	</div>
	{#if reorderEnabled && !selectionMode}
		<div class="absolute bottom-1 right-1 z-50 flex items-center gap-1 sm:hidden">
			<span class="pointer-events-none px-1 text-sm font-medium" aria-hidden="true">
				{index + 1}/{totalCount}
			</span>
			<Button
				type="button"
				intent="secondary"
				size="icon"
				class="size-10"
				aria-label={m.gift_reorder_move_up({ name: giftName })}
				disabled={index === 0}
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
				size="icon"
				class="size-10"
				aria-label={m.gift_reorder_move_down({ name: giftName })}
				disabled={index === totalCount - 1}
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
