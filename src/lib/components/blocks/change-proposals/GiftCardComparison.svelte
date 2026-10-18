<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import GiftCard from '$lib/components/blocks/gift/GiftCard.svelte';
	import type { GiftByRole } from '$lib/modules/gifts/types.js';
	import type { CardPair } from './change_row_model.js';

	/**
	 * The real GiftCard before and after a change, in the recipient shape so no reservation state
	 * shows. A missing side is a dashed placeholder: a new gift has no before, a deletion no after.
	 */
	let {
		pair,
		beforeCaption = m.change_review_caption_before(),
		afterCaption = m.change_review_caption_after(),
	}: { pair: CardPair; beforeCaption?: string; afterCaption?: string } = $props();
</script>

{#snippet slot(gift: GiftByRole | null, caption: string, side: 'before' | 'after')}
	<figure class="card-slot">
		<figcaption class={['pair-caption', side]}>
			<span class="dot" aria-hidden="true"></span>{caption}
		</figcaption>
		{#if gift !== null}
			<div class="card-frame" class:is-removal={side === 'before' && pair.removal}>
				<GiftCard {gift} role="recipient" showCategory />
				{#if side === 'before' && pair.removal}
					<span class="removal-badge"
						><Trash2Icon aria-hidden="true" />{m.change_review_removal_overlay()}</span
					>
				{/if}
			</div>
		{:else}
			<div class="card-ghost">
				{#if side === 'before'}
					<PlusIcon aria-hidden="true" />
					<span>{m.change_review_ghost_new()}</span>
				{:else}
					<Trash2Icon aria-hidden="true" />
					<span>{m.change_review_ghost_deleted()}</span>
				{/if}
			</div>
		{/if}
	</figure>
{/snippet}

<div class="card-pair" role="group" aria-label={m.change_review_cards_label()}>
	{@render slot(pair.before, beforeCaption, 'before')}
	{@render slot(pair.after, afterCaption, 'after')}
</div>

<style>
	.card-pair {
		--card-width: 208px;

		display: grid;
		grid-template-columns: repeat(2, var(--card-width));
		gap: 14px;
	}

	.card-slot {
		display: flex;
		flex-direction: column;
		min-width: 0;
		margin: 0;
	}

	.pair-caption {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-bottom: 6px;
		color: var(--muted-foreground);
		font-size: var(--text-xs);
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.dot {
		width: 8px;
		height: 8px;
		border: 1.5px solid var(--ink);
		border-radius: 2px;
	}

	.before .dot {
		background: color-mix(in oklab, var(--status-danger) 14%, var(--card));
	}

	.after .dot {
		background: var(--status-success);
	}

	.card-frame {
		position: relative;
	}

	.card-frame.is-removal :global([data-testid='gift-card-surface']) {
		opacity: 0.6;
	}

	.removal-badge {
		position: absolute;
		top: 38%;
		left: 50%;
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		padding: 3px var(--space-2);
		border: 2px solid var(--ink);
		border-radius: var(--radius-panel);
		background: var(--status-danger-fill);
		box-shadow: var(--elevation-compact);
		color: var(--color-destructive-foreground);
		font-size: var(--text-xs);
		font-weight: 700;
		white-space: nowrap;
		transform: translate(-50%, -50%) rotate(-1deg);
	}

	.removal-badge :global(svg) {
		width: 12px;
		height: 12px;
	}

	.card-ghost {
		display: grid;
		flex: 1;
		place-content: center;
		justify-items: center;
		gap: 6px;
		min-height: 210px;
		padding: 14px;
		border: 2.5px dashed var(--border-strong);
		border-radius: var(--radius-panel);
		color: var(--muted-foreground);
		font-size: var(--text-sm);
		font-weight: 600;
		text-align: center;
	}

	.card-ghost :global(svg) {
		width: 22px;
		height: 22px;
	}

	@media (width < 640px) {
		.card-pair {
			--card-width: minmax(0, 1fr);

			gap: 10px;
		}

		.card-ghost {
			min-height: 180px;
			padding: 10px;
		}
	}
</style>
