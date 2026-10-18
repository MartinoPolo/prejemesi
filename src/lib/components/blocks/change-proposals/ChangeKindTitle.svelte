<script lang="ts">
	import type { ChangeKind } from '$lib/modules/change_proposals/types.js';
	import { countCopy } from '$lib/modules/change_proposals/change_review_copy.js';
	import { CHANGE_KIND_PRESENTATION } from './change_review_presentation.js';

	/** A row title ("Smazání dárku") or, with `count`, a summary count ("3 nové dárky"). */
	let { kind, count }: { kind: ChangeKind; count?: number } = $props();

	const presentation = $derived(CHANGE_KIND_PRESENTATION[kind]);
	const text = $derived(
		count === undefined ? presentation.title() : countCopy(presentation.count, count),
	);
	const Icon = $derived(presentation.icon);
</script>

<span
	class={['kind-label', count === undefined ? 'is-title' : 'is-count']}
	style:--kind-text={presentation.tone.text}
	style:--kind-icon={presentation.tone.icon}
>
	<Icon aria-hidden="true" />
	<span class="kind-text" title={count === undefined ? text : undefined}>{text}</span>
</span>

<style>
	.kind-label {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-width: 0;
		color: var(--kind-text);
		font-family: var(--font-head);
		font-weight: 600;
		white-space: nowrap;
	}

	.kind-label :global(svg) {
		flex: none;
		color: var(--kind-icon);
	}

	.is-title {
		font-size: 1rem;
		line-height: 1.25;
	}

	.is-title :global(svg) {
		width: 18px;
		height: 18px;
	}

	.is-count {
		gap: var(--space-1);
		font-size: var(--text-base);
		line-height: 1.4;
	}

	.is-count :global(svg) {
		width: 16px;
		height: 16px;
	}

	.kind-text {
		display: block;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
