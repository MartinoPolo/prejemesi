<script lang="ts">
	import { onMount, tick, type Snippet } from 'svelte';
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis';
	import { Button } from '$lib/components/base/button/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils.js';
	import { observeDepthChange } from '$lib/theme/depth_change.js';
	import type { GiftContextAction } from '$lib/modules/gifts/gift_context_actions.js';
	import type {
		GiftActionPlacementSnapshot,
		GiftMoreProps,
	} from '$lib/components/blocks/wishlist/gift_context_invocation.js';
	import { placeGiftActions, type GiftActionPlacement } from './gift_action_placement.js';
	import { giftActionRowVariants } from './gift_action_row_variants.js';

	interface Props extends GiftMoreProps {
		children?: Snippet;
		/** A control before every action that never overflows, such as the viewer's Like. */
		leading?: Snippet;
		/** Renders the control for one secondary action. */
		secondary?: Snippet<[GiftContextAction]>;
		contentWidth?: number;
		/** Ordered left to right; the leftmost overflows into More first. */
		secondaryActions?: readonly GiftContextAction[];
		/** Secondary actions shown after the primary; they still overflow in `secondaryActions` order. */
		secondaryActionsAfterPrimary?: readonly GiftContextAction[];
		primaryAction?: GiftContextAction;
		persistentMore?: boolean;
		onplacementchange?: (overflowActions: readonly GiftContextAction[]) => void;
		class?: string;
	}

	let {
		children,
		leading,
		secondary,
		onmore,
		moreOpen = false,
		moreSurface = 'menu',
		contentWidth,
		secondaryActions = [],
		secondaryActionsAfterPrimary = [],
		primaryAction,
		persistentMore = onmore !== undefined,
		onplacementchange,
		class: className,
	}: Props = $props();

	const styles = giftActionRowVariants();

	let rowElement = $state<HTMLDivElement | null>(null);
	let leadingElement = $state<HTMLDivElement | null>(null);
	const secondaryElements = $state<Partial<Record<GiftContextAction, HTMLDivElement | null>>>({});
	let primaryElement = $state<HTMLDivElement | null>(null);
	let moreElement = $state<HTMLElement | null>(null);
	let moreMeasureElement = $state<HTMLSpanElement | null>(null);
	let observedContentWidth = $state(0);
	let leadingWidth = $state(0);
	let secondaryWidths = $state<Partial<Record<GiftContextAction, number>>>({});
	let primaryWidth = $state(0);
	let moreWidth = $state(0);
	let actionGap = $state(0);
	let lastReportedOverflow = '';
	let focusTransferVersion = 0;
	let mounted = false;

	const renderedSecondaryActions = $derived(secondary === undefined ? [] : secondaryActions);
	const responsivePlacement = $derived(
		onmore !== undefined &&
			(renderedSecondaryActions.length > 0 || primaryAction !== undefined),
	);
	const renderedSecondaryActionsBeforePrimary = $derived(
		renderedSecondaryActions.filter((action) => !secondaryActionsAfterPrimary.includes(action)),
	);
	const renderedSecondaryActionsAfterPrimary = $derived(
		renderedSecondaryActions.filter((action) => secondaryActionsAfterPrimary.includes(action)),
	);
	const availableContentWidth = $derived(
		(contentWidth ?? observedContentWidth) -
			(leading === undefined ? 0 : leadingWidth + actionGap),
	);
	const placement: GiftActionPlacement = $derived(
		responsivePlacement &&
			availableContentWidth > 0 &&
			(leading === undefined || leadingWidth > 0) &&
			renderedSecondaryActions.every((action) => (secondaryWidths[action] ?? 0) > 0) &&
			(primaryAction === undefined || primaryWidth > 0) &&
			moreWidth > 0
			? placeGiftActions({
					contentWidth: availableContentWidth,
					secondary: renderedSecondaryActions.map((action) => ({
						id: action,
						width: secondaryWidths[action] ?? 0,
					})),
					primary:
						primaryAction === undefined
							? undefined
							: { id: primaryAction, width: primaryWidth },
					moreWidth,
					gap: actionGap,
					persistentMore: persistentMore || moreOpen,
				})
			: {
					visibleSecondaryActions: renderedSecondaryActions,
					showPrimary: true,
					showMore: onmore !== undefined && persistentMore,
					overflowActions: [],
				},
	);

	function secondaryIsVisible(action: GiftContextAction): boolean {
		return placement.visibleSecondaryActions.includes(action);
	}

	function measureIntrinsicActions() {
		if (rowElement !== null) {
			observedContentWidth = rowElement.clientWidth;
			actionGap = Number.parseFloat(getComputedStyle(rowElement).columnGap) || 0;
		}
		if (!responsivePlacement) {
			return;
		}
		if (leadingElement !== null && leadingElement.isConnected) {
			leadingWidth = leadingElement.getBoundingClientRect().width;
		}
		const measuredSecondaryWidths: Partial<Record<GiftContextAction, number>> = {};
		for (const action of renderedSecondaryActions) {
			const element = secondaryElements[action];
			if (element?.isConnected === true) {
				measuredSecondaryWidths[action] = element.getBoundingClientRect().width;
			}
		}
		secondaryWidths = measuredSecondaryWidths;
		if (primaryElement !== null && primaryElement.isConnected) {
			primaryWidth = primaryElement.getBoundingClientRect().width;
		}
		if (moreMeasureElement !== null && moreMeasureElement.isConnected) {
			moreWidth = moreMeasureElement.getBoundingClientRect().width;
		}
	}

	function firstAction(element: HTMLElement | null | undefined): HTMLElement | null {
		return element?.querySelector<HTMLElement>('button, a, input, select, textarea') ?? null;
	}

	function actionIsDisabled(element: HTMLElement | null | undefined): boolean {
		const action = firstAction(element);
		return (
			(action instanceof HTMLButtonElement && action.disabled) ||
			action?.getAttribute('aria-disabled') === 'true'
		);
	}

	function actionIsPending(element: HTMLElement | null | undefined): boolean {
		const action = firstAction(element);
		return (
			action?.getAttribute('data-pending') === 'true' ||
			action?.getAttribute('aria-busy') === 'true'
		);
	}

	function createPlacementSnapshot(): GiftActionPlacementSnapshot {
		const visibleDirectActions: GiftContextAction[] = [];
		const disabledActions: GiftContextAction[] = [];
		const pendingActions: GiftContextAction[] = [];
		const directActions = [
			...renderedSecondaryActions.map((action) => ({
				action,
				element: secondaryElements[action],
				visible: secondaryIsVisible(action),
			})),
			...(primaryAction === undefined
				? []
				: [
						{
							action: primaryAction,
							element: primaryElement,
							visible: placement.showPrimary,
						},
					]),
		];
		for (const { action, element, visible } of directActions) {
			if (visible && firstAction(element) !== null) {
				visibleDirectActions.push(action);
			}
			if (actionIsDisabled(element)) {
				disabledActions.push(action);
			}
			if (actionIsPending(element)) {
				pendingActions.push(action);
			}
		}
		return { visibleDirectActions, pendingActions, disabledActions };
	}

	$effect.pre(() => {
		const { showPrimary, showMore } = placement;
		const activeElement = document.activeElement;
		const hiddenFocusedAction =
			renderedSecondaryActions.some(
				(action) =>
					!secondaryIsVisible(action) &&
					secondaryElements[action]?.contains(activeElement) === true,
			) ||
			(!showPrimary && primaryElement?.contains(activeElement) === true);
		const hiddenFocusedMore = !showMore && moreElement?.contains(activeElement) === true;
		if (!hiddenFocusedAction && !hiddenFocusedMore) {
			return;
		}

		const focusedElement = activeElement;
		const transferVersion = ++focusTransferVersion;
		void tick().then(() => {
			if (!mounted || transferVersion !== focusTransferVersion) {
				return;
			}
			if (
				document.activeElement !== focusedElement &&
				document.activeElement !== document.body
			) {
				return;
			}
			const lastVisibleSecondary = placement.visibleSecondaryActions.at(-1);
			const focusTarget = hiddenFocusedAction
				? moreElement
				: showPrimary
					? firstAction(primaryElement)
					: firstAction(
							lastVisibleSecondary === undefined
								? null
								: secondaryElements[lastVisibleSecondary],
						);
			if (focusTarget !== null) {
				focusTarget.focus({ preventScroll: true });
			}
		});
	});

	$effect(() => {
		const overflowActions = placement.overflowActions;
		const reportKey = overflowActions.join('\u0000');
		if (reportKey !== lastReportedOverflow) {
			lastReportedOverflow = reportKey;
			onplacementchange?.(overflowActions);
		}
	});

	// Re-subscribes whenever a measured control mounts or unmounts, such as Bought appearing after
	// the viewer reserves.
	$effect(() => {
		const observedElements = [
			rowElement,
			leadingElement,
			primaryElement,
			moreMeasureElement,
			...renderedSecondaryActions.map((action) => secondaryElements[action]),
		].filter((element): element is HTMLElement => element != null);
		const observer = new ResizeObserver(measureIntrinsicActions);
		for (const element of observedElements) {
			observer.observe(element);
		}
		return () => observer.disconnect();
	});

	onMount(() => {
		mounted = true;
		void tick().then(measureIntrinsicActions);
		document.fonts?.addEventListener('loadingdone', measureIntrinsicActions);
		const stopObservingDepth = observeDepthChange(measureIntrinsicActions);
		return () => {
			stopObservingDepth();
			mounted = false;
			focusTransferVersion += 1;
			document.fonts?.removeEventListener('loadingdone', measureIntrinsicActions);
		};
	});
</script>

<div
	bind:this={rowElement}
	class={cn(styles.row(), className)}
	data-testid="gift-action-row"
	data-overflow-actions={placement.overflowActions.join(' ')}
	onfocusout={(event) => {
		if (
			event.relatedTarget !== null &&
			rowElement?.contains(event.relatedTarget as Node) !== true
		) {
			focusTransferVersion += 1;
		}
	}}
>
	{#snippet secondarySlot(
		action: GiftContextAction,
		renderSecondary: Snippet<[GiftContextAction]>,
	)}
		<div
			bind:this={secondaryElements[action]}
			class={cn(
				styles.secondary(),
				!secondaryIsVisible(action) && 'gift-action-overflow-measure',
			)}
			data-testid="gift-action-secondary"
			data-gift-secondary-action={action}
			inert={!secondaryIsVisible(action)}
			aria-hidden={!secondaryIsVisible(action)}
		>
			{@render renderSecondary(action)}
		</div>
	{/snippet}
	{#if leading}
		<div bind:this={leadingElement} class={styles.leading()}>
			{@render leading()}
		</div>
	{/if}
	{#if secondary}
		{#each renderedSecondaryActionsBeforePrimary as action (action)}
			{@render secondarySlot(action, secondary)}
		{/each}
	{/if}
	<span
		bind:this={moreMeasureElement}
		class="gift-action-more-measure size-(--gift-action-control-size)"
		aria-hidden="true"
	></span>
	<div class={styles.primaryGroup()} data-testid="gift-action-primary-group">
		{#if primaryAction !== undefined}
			<div
				bind:this={primaryElement}
				class={cn(
					styles.primary(),
					!placement.showPrimary && 'gift-action-overflow-measure',
				)}
				inert={!placement.showPrimary}
				aria-hidden={!placement.showPrimary}
			>
				{@render children?.()}
			</div>
		{/if}
		{#if secondary}
			{#each renderedSecondaryActionsAfterPrimary as action (action)}
				{@render secondarySlot(action, secondary)}
			{/each}
		{/if}
		{#if onmore}
			<Button
				bind:ref={moreElement}
				intent="outline"
				format="icon"
				class={cn(styles.more(), !placement.showMore && 'gift-action-overflow-measure')}
				inert={!placement.showMore}
				aria-hidden={!placement.showMore}
				aria-label={m.gift_more_actions()}
				data-gift-action="more"
				data-testid="gift-more-actions"
				onclick={(event) => {
					event.stopPropagation();
					onmore(event.currentTarget as HTMLButtonElement, createPlacementSnapshot());
				}}
				onkeydown={(event) => {
					if (event.key === 'ArrowDown') {
						event.preventDefault();
						event.stopPropagation();
						onmore(event.currentTarget as HTMLButtonElement, createPlacementSnapshot());
					}
				}}
				aria-haspopup={moreSurface}
				aria-expanded={moreOpen}><EllipsisIcon data-icon /></Button
			>
		{/if}
	</div>
</div>

<style>
	.gift-action-row {
		--gift-action-control-size: var(--size-control-lg);
	}

	@media (width >= 640px) {
		.gift-action-row {
			--gift-action-control-size: var(--size-control-md);
		}
	}

	/* Global so the class reaches the More <Button> root, which lacks this component's scope hash. */
	.gift-action-row :global(.gift-action-overflow-measure),
	.gift-action-more-measure {
		position: fixed;
		inset-block-start: 0;
		inset-inline-start: -100000px;
		visibility: hidden;
		pointer-events: none;
	}

	.gift-action-row :global(.gift-action-overflow-measure) {
		inline-size: max-content;
		max-inline-size: none;
	}

	.gift-action-row,
	.gift-action-primary-group,
	.gift-action-slot {
		gap: var(--nested-control-gap);
	}

	/* A group holding only off-screen measures must not add a gap after the leading control. */
	.gift-action-primary-group:not(:has(> :not(:global(.gift-action-overflow-measure)))) {
		display: contents;
	}

	.gift-action-slot :global(> [data-slot='button']) {
		height: var(--gift-action-control-size);
		min-width: 0;
	}

	.gift-action-slot :global(> [data-slot='button'] > .elevation-surface) {
		height: 100%;
	}
</style>
