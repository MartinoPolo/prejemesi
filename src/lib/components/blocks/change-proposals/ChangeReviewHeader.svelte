<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import { Button } from '$lib/components/base/button/index.js';

	let {
		listHref,
		wishlistTitle,
		recipientName,
		ondiscard,
	}: {
		listHref: string;
		wishlistTitle: string;
		recipientName: string;
		/** Offered only while the proposal waits for review. */
		ondiscard?: () => void;
	} = $props();
</script>

<header class="page-head">
	<div>
		<a class="back-link" href={listHref}>
			<ArrowLeftIcon aria-hidden="true" />{m.change_review_back()}
		</a>
		<p class="eyebrow">{m.change_review_eyebrow()}</p>
		<p class="for-line">{m.change_review_for({ name: recipientName })}</p>
		<h1 class="page-title">{wishlistTitle}</h1>
	</div>
	{#if ondiscard !== undefined}
		<Button intent="danger" onclick={ondiscard} data-testid="change-review-discard">
			<Trash2Icon data-icon="inline-start" />{m.change_review_discard()}
		</Button>
	{/if}
</header>

<style>
	.page-head {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: var(--space-3) var(--space-6);
	}

	.back-link {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-height: var(--size-control-md);
		margin-left: -6px;
		padding: 0 6px;
		border-radius: var(--radius-btn);
		color: var(--brand-link);
		font-size: var(--text-md);
		font-weight: 600;
		text-decoration: none;
	}

	.back-link:hover {
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.back-link :global(svg) {
		width: 16px;
		height: 16px;
	}

	.eyebrow {
		margin-top: 6px;
		color: var(--brand-link);
		font-size: var(--text-xs);
		font-weight: 800;
		letter-spacing: 0.09em;
		text-transform: uppercase;
	}

	.for-line {
		margin-top: 2px;
		color: var(--muted-foreground);
		font-size: var(--text-md);
		font-weight: 600;
	}

	.page-title {
		margin-top: 2px;
		font-family: var(--font-head);
		font-size: var(--text-3xl);
		font-weight: 600;
		line-height: 1.2;
		overflow-wrap: anywhere;
	}
</style>
