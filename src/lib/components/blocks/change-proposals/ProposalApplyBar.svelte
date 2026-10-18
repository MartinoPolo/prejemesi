<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import LoaderIcon from '@lucide/svelte/icons/loader';
	import { Button } from '$lib/components/base/button/index.js';
	import { countCopy } from '$lib/modules/change_proposals/change_review_copy.js';

	const APPLY_LABELS = {
		one: m.change_review_apply_one,
		few: m.change_review_apply_few,
		other: m.change_review_apply_other,
	};
	const CONFIRM_HELP = {
		one: m.change_review_apply_help_confirm_one,
		few: m.change_review_apply_help_confirm_few,
		other: m.change_review_apply_help_confirm_other,
	};

	/** Sticky footer: how many changes are ticked and the one Apply action, disabled at zero. */
	let {
		selectedCount,
		selectableCount,
		confirmSelectedCount,
		pending,
		onapply,
	}: {
		selectedCount: number;
		selectableCount: number;
		confirmSelectedCount: number;
		pending: boolean;
		onapply: () => void;
	} = $props();

	const help = $derived.by(() => {
		if (selectedCount === 0) {
			return m.change_review_apply_help_none();
		}
		return confirmSelectedCount > 0
			? countCopy(CONFIRM_HELP, confirmSelectedCount)
			: m.change_review_apply_help_ordinary();
	});
</script>

<div class="apply-bar" role="region" aria-label={m.change_review_apply_bar_label()}>
	<div class="apply-inner">
		<p class="apply-text">
			<span class="apply-count" data-testid="change-review-selected-count">
				{m.change_review_apply_count({ selected: selectedCount, total: selectableCount })}
			</span>
			<span class="apply-help" id="change-review-apply-help">{help}</span>
		</p>
		<Button
			class="max-sm:w-full"
			disabled={selectedCount === 0 || pending}
			aria-busy={pending}
			aria-describedby="change-review-apply-help"
			data-testid="change-review-apply"
			onclick={onapply}
		>
			{#if pending}
				<LoaderIcon
					class="animate-spin"
					data-icon="inline-start"
				/>{m.change_review_applying()}
			{:else}
				{countCopy(APPLY_LABELS, selectedCount)}
			{/if}
		</Button>
	</div>
</div>

<style>
	.apply-bar {
		position: sticky;
		bottom: 0;
		z-index: 15;
		margin-top: var(--space-6);
		margin-inline: calc(-1 * var(--page-gutter));
		border-top: 2.5px solid var(--ink);
		background: var(--card);
		box-shadow: 0 -4px 0 color-mix(in oklab, var(--hard-shadow) 60%, transparent);
	}

	.apply-inner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
		min-height: 64px;
		padding: var(--space-2) var(--page-gutter);
	}

	.apply-text {
		display: grid;
		min-width: 0;
	}

	.apply-count {
		font-size: var(--text-base);
		font-weight: 700;
	}

	.apply-help {
		color: var(--muted-foreground);
		font-size: var(--text-sm);
	}

	@media (width < 640px) {
		.apply-inner {
			flex-direction: column;
			align-items: stretch;
			gap: 6px;
			padding: var(--space-2) var(--page-gutter) calc(10px + env(safe-area-inset-bottom));
		}

		.apply-text {
			display: flex;
			align-items: baseline;
			justify-content: space-between;
			gap: var(--space-2);
		}
	}
</style>
