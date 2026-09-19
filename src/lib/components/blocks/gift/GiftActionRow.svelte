<script lang="ts">
	import { onMount, tick, type Snippet } from 'svelte';
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis';
	import { Button } from '$lib/components/base/button/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils.js';
	import type { GiftContextAction } from '$lib/modules/gifts/gift_context_actions.js';
	import type { GiftActionPlacementSnapshot } from '$lib/components/blocks/wishlist/gift_context_invocation.js';
	import { placeGiftActions } from './gift_action_placement.js';
	import { giftActionRowVariants } from './gift_action_row_variants.js';

	interface Props {
		children?: Snippet;
		secondary?: Snippet;
		onmore?: (
			anchor: HTMLButtonElement,
			placementSnapshot: GiftActionPlacementSnapshot,
		) => void;
		moreOpen?: boolean;
		moreSurface?: 'menu' | 'dialog';
		controlSizing?: 'fill' | 'intrinsic';
		contentWidth?: number;
		secondaryAction?: GiftContextAction;
		primaryAction?: GiftContextAction;
		persistentMore?: boolean;
		onplacementchange?: (overflowActions: readonly GiftContextAction[]) => void;
		class?: string;
	}

	let {
		children,
		secondary,
		onmore,
		moreOpen = false,
		moreSurface = 'menu',
		controlSizing = 'fill',
		contentWidth,
		secondaryAction,
		primaryAction,
		persistentMore = onmore !== undefined,
		onplacementchange,
		class: className,
	}: Props = $props();

	let rowElement = $state<HTMLDivElement | null>(null);
	let secondaryElement = $state<HTMLDivElement | null>(null);
	let primaryElement = $state<HTMLDivElement | null>(null);
	let moreElement = $state<HTMLElement | null>(null);
	let moreMeasureElement = $state<HTMLSpanElement | null>(null);
	let observedContentWidth = $state(0);
	let secondaryWidth = $state(0);
	let primaryWidth = $state(0);
	let moreWidth = $state(0);
	let actionGap = $state(0);
	let lastReportedOverflow = '';
	let focusTransferVersion = 0;
	let mounted = false;

	const responsivePlacement = $derived(
		onmore !== undefined &&
			controlSizing === 'intrinsic' &&
			(secondaryAction !== undefined || primaryAction !== undefined),
	);
	const availableContentWidth = $derived(contentWidth ?? observedContentWidth);
	const placement = $derived(
		responsivePlacement &&
			availableContentWidth > 0 &&
			(secondaryAction === undefined || secondaryWidth > 0) &&
			(primaryAction === undefined || primaryWidth > 0) &&
			moreWidth > 0
			? placeGiftActions({
					contentWidth: availableContentWidth,
					secondary:
						secondaryAction === undefined
							? undefined
							: { id: secondaryAction, width: secondaryWidth },
					primary:
						primaryAction === undefined
							? undefined
							: { id: primaryAction, width: primaryWidth },
					moreWidth,
					gap: actionGap,
					persistentMore: persistentMore || moreOpen,
				})
			: {
					showSecondary: secondary !== undefined,
					showPrimary: true,
					showMore: onmore !== undefined && persistentMore,
					overflowActions: [] as GiftContextAction[],
				},
	);
	const styles = $derived(
		giftActionRowVariants({
			withMore: placement.showMore,
			withSecondary: placement.showSecondary,
			controlSizing,
		}),
	);

	function measureIntrinsicActions() {
		if (rowElement !== null) {
			observedContentWidth = rowElement.clientWidth;
			actionGap = Number.parseFloat(getComputedStyle(rowElement).columnGap) || 0;
		}
		if (!responsivePlacement) {
			return;
		}
		if (secondaryElement !== null && secondaryElement.isConnected) {
			secondaryWidth = secondaryElement.getBoundingClientRect().width;
		}
		if (primaryElement !== null && primaryElement.isConnected) {
			primaryWidth = primaryElement.getBoundingClientRect().width;
		}
		if (moreMeasureElement !== null && moreMeasureElement.isConnected) {
			moreWidth = moreMeasureElement.getBoundingClientRect().width;
		}
	}

	function firstAction(element: HTMLElement | null): HTMLElement | null {
		return element?.querySelector<HTMLElement>('button, a, input, select, textarea') ?? null;
	}

	function actionIsDisabled(element: HTMLElement | null): boolean {
		const action = firstAction(element);
		return (
			(action instanceof HTMLButtonElement && action.disabled) ||
			action?.getAttribute('aria-disabled') === 'true'
		);
	}

	function actionIsPending(element: HTMLElement | null): boolean {
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
		for (const [action, element, visible] of [
			[secondaryAction, secondaryElement, placement.showSecondary],
			[primaryAction, primaryElement, placement.showPrimary],
		] as const) {
			if (action === undefined) {
				continue;
			}
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
		const { showSecondary, showPrimary, showMore } = placement;
		const activeElement = document.activeElement;
		const hiddenFocusedAction =
			(!showSecondary && secondaryElement?.contains(activeElement) === true) ||
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
			const focusTarget = hiddenFocusedAction
				? moreElement
				: showPrimary
					? firstAction(primaryElement)
					: firstAction(secondaryElement);
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

	onMount(() => {
		mounted = true;
		const observer = new ResizeObserver(measureIntrinsicActions);
		if (rowElement !== null) {
			observer.observe(rowElement);
		}
		if (secondaryElement !== null) {
			observer.observe(secondaryElement);
		}
		if (primaryElement !== null) {
			observer.observe(primaryElement);
		}
		if (moreMeasureElement !== null) {
			observer.observe(moreMeasureElement);
		}
		void tick().then(measureIntrinsicActions);
		document.fonts?.addEventListener('loadingdone', measureIntrinsicActions);
		return () => {
			mounted = false;
			focusTransferVersion += 1;
			observer.disconnect();
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
	{#if secondary}
		<div
			bind:this={secondaryElement}
			class={cn(
				styles.secondary(),
				!placement.showSecondary && 'gift-action-overflow-measure',
			)}
			data-testid="gift-action-secondary"
			inert={!placement.showSecondary}
			aria-hidden={!placement.showSecondary}
		>
			{@render secondary()}
		</div>
	{/if}
	<span
		bind:this={moreMeasureElement}
		class="gift-action-more-measure size-(--gift-action-control-size)"
		aria-hidden="true"
	></span>
	<div class={styles.primaryGroup()} data-testid="gift-action-primary-group">
		<div
			bind:this={primaryElement}
			class={cn(styles.primary(), !placement.showPrimary && 'gift-action-overflow-measure')}
			inert={!placement.showPrimary}
			aria-hidden={!placement.showPrimary}
		>
			{@render children?.()}
		</div>
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

	.gift-action-overflow-measure,
	.gift-action-more-measure {
		position: fixed;
		inset-block-start: 0;
		inset-inline-start: -100000px;
		visibility: hidden;
		pointer-events: none;
	}

	.gift-action-overflow-measure {
		inline-size: max-content;
		max-inline-size: none;
	}

	.gift-action-row,
	.gift-action-primary-group,
	.gift-action-slot {
		gap: var(--gift-action-gap, calc(0.5rem + var(--elevation-ordinary-offset)));
	}

	.gift-action-slot :global(> [data-slot='button']) {
		height: var(--gift-action-control-size);
		min-width: 0;
	}

	.gift-action-slot :global(> [data-slot='button'] > .elevation-surface) {
		height: 100%;
	}
</style>
