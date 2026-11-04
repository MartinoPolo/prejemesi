<script lang="ts" generics="Item">
	import * as Popover from '$lib/components/base/popover/index.js';
	import { overflowChipsVariants, type OverflowChipsProps } from './overflow_chips_variants.js';

	let {
		items,
		visibleCount,
		itemKey,
		itemLabel,
		chip,
		popoverChip,
		moreLabel,
		popoverTitle,
		interactive = true,
		dimmed = false,
		layout = 'inline',
		...restProps
	}: OverflowChipsProps<Item> = $props();

	const CLICK_AFTER_RELEASE_MS = 300;

	const popoverTitleId = $props.id();
	let popoverOpen = $state(false);
	let triggerElement = $state<HTMLElement | null>(null);
	let popoverElement = $state<HTMLElement | null>(null);

	const styles = $derived(overflowChipsVariants({ layout, dimmed }));
	const visibleItems = $derived(items.slice(0, visibleCount));
	const hiddenItems = $derived(items.slice(visibleCount));
	const hiddenItemLabels = $derived(hiddenItems.map(itemLabel).join(', '));

	function isInsidePopover(target: EventTarget | null) {
		return (
			target instanceof Node &&
			(popoverElement?.contains(target) === true || triggerElement?.contains(target) === true)
		);
	}

	/**
	 * Lets the dismissing press only dismiss, instead of also pressing what lies beneath. Bits UI's
	 * own outside detection cannot do this: it misses presses a gift card stops from bubbling, and on
	 * touch it closes on the click, which still reaches the element beneath.
	 */
	function swallowClickOfCurrentPress() {
		let releaseTimer: ReturnType<typeof setTimeout> | undefined;
		function swallowClick(event: MouseEvent) {
			if (!isInsidePopover(event.target)) {
				event.preventDefault();
				event.stopPropagation();
			}
			release();
		}
		// The press's click follows its release at once; a press that never clicks must not leave
		// the guard armed for a later keyboard or programmatic click.
		function releaseSoon() {
			clearTimeout(releaseTimer);
			releaseTimer = setTimeout(release, CLICK_AFTER_RELEASE_MS);
		}
		function release() {
			clearTimeout(releaseTimer);
			document.removeEventListener('click', swallowClick, true);
			document.removeEventListener('pointerup', releaseSoon, true);
			document.removeEventListener('pointercancel', release, true);
			document.removeEventListener('pointerdown', release, true);
		}
		document.addEventListener('click', swallowClick, true);
		document.addEventListener('pointerup', releaseSoon, true);
		// A press that turned into a scroll never clicks.
		document.addEventListener('pointercancel', release, true);
		document.addEventListener('pointerdown', release, true);
	}

	/** Whether a scroll moves the trigger, which the portaled popover cannot follow smoothly. */
	function scrollMovesTrigger(target: EventTarget | null) {
		return (
			target === document ||
			(target instanceof Node && triggerElement !== null && target.contains(triggerElement))
		);
	}

	$effect(() => {
		if (!popoverOpen) {
			return;
		}
		// Capture phase: a host that stops pointerdown propagation for its own gestures (gift cards)
		// would otherwise hide the press from the popover's bubble-phase outside detection.
		function closeOnOutsidePress(event: PointerEvent) {
			if (isInsidePopover(event.target)) {
				return;
			}
			popoverOpen = false;
			swallowClickOfCurrentPress();
		}
		function closeOnScroll(event: Event) {
			if (scrollMovesTrigger(event.target)) {
				popoverOpen = false;
			}
		}
		document.addEventListener('pointerdown', closeOnOutsidePress, true);
		document.addEventListener('scroll', closeOnScroll, true);
		return () => {
			document.removeEventListener('pointerdown', closeOnOutsidePress, true);
			document.removeEventListener('scroll', closeOnScroll, true);
		};
	});
</script>

<div class={styles.root()} data-slot="overflow-chips" {...restProps}>
	{#each visibleItems as item, index (itemKey(item))}
		{@render chip(item, index)}
	{/each}
	{#if hiddenItems.length > 0}
		<span class="sr-only">{hiddenItemLabels}</span>
		{#if interactive}
			<Popover.Root bind:open={popoverOpen}>
				<Popover.Trigger
					bind:ref={triggerElement}
					class={styles.moreTrigger()}
					aria-label={moreLabel(hiddenItems.length)}
					data-slot="overflow-chips-trigger"
					data-prevent-gift-card-open
				>
					+{hiddenItems.length}
				</Popover.Trigger>
				<Popover.Content
					bind:ref={popoverElement}
					class={styles.popover()}
					shadowedTrigger={false}
					role="dialog"
					aria-labelledby={popoverTitleId}
					data-slot="overflow-chips-popover"
				>
					<Popover.Label id={popoverTitleId}>{popoverTitle}</Popover.Label>
					<ul class={styles.popoverList()}>
						{#each items as item, index (itemKey(item))}
							<li class="max-w-full min-w-0">
								{#if popoverChip}
									{@render popoverChip(item)}
								{:else}
									{@render chip(item, index)}
								{/if}
							</li>
						{/each}
					</ul>
				</Popover.Content>
			</Popover.Root>
		{:else}
			<span class={styles.moreChip()} aria-hidden="true">+{hiddenItems.length}</span>
		{/if}
	{/if}
</div>
