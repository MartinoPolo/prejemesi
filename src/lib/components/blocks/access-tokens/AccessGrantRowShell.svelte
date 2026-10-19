<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLLiAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils.js';

	interface AccessGrantRowShellProps extends HTMLLiAttributes {
		expired?: boolean;
		highlighted?: boolean;
		main: Snippet;
		actions: Snippet;
		details?: Snippet;
	}

	let {
		expired = false,
		highlighted = false,
		main,
		actions,
		details,
		class: className,
		...rest
	}: AccessGrantRowShellProps = $props();
</script>

<!-- One access grant, a token or a connected app, as a row of the Settings access list. -->
<li
	class={cn(
		'access-grant-row',
		expired && 'is-expired',
		highlighted && 'is-highlighted',
		details !== undefined && 'has-details',
		className,
	)}
	{...rest}
>
	<div class="access-grant-main">
		{@render main()}
	</div>
	<div class="access-grant-actions">
		{@render actions()}
	</div>
	{#if details}
		<div class="access-grant-disclosure">
			{@render details()}
		</div>
	{/if}
</li>

<style>
	/* A nested sub-panel inside the settings card: the section supplies --access-grant-inset so the
	   7px radius stays parallel to the card's corner, and content lines up with the card's 24px. */
	.access-grant-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		grid-template-areas: 'main' 'action';
		gap: var(--space-2);
		padding: 14px calc(var(--space-6) - var(--access-grant-inset, 0px) - 2px) 12px;
		border: 2px solid var(--border-strong);
		border-radius: var(--radius-btn);
		background: var(--card);
		transition: background-color var(--duration-normal) var(--ease-standard);
	}

	.access-grant-row.has-details {
		grid-template-areas: 'main' 'details' 'action';
	}

	.access-grant-row:hover {
		background: var(--panel-hover);
	}

	.access-grant-row.is-highlighted {
		border-color: var(--brand);
		background: color-mix(in oklab, var(--primary) 8%, var(--card));
	}

	.access-grant-row.is-expired {
		--access-grant-text: var(--muted-foreground);
		--access-grant-icon: var(--muted-foreground);

		border-style: dashed;
		background: var(--muted);
	}

	.access-grant-main {
		grid-area: main;
		display: flex;
		min-width: 0;
		flex-direction: column;
		gap: var(--space-1);
	}

	.access-grant-main :global(.access-grant-name) {
		display: -webkit-box;
		min-width: 0;
		overflow: hidden;
		font-size: var(--text-lg);
		font-weight: 600;
		line-height: 1.3;
		overflow-wrap: anywhere;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
	}

	.access-grant-main :global(.access-grant-sentence) {
		display: flex;
		align-items: flex-start;
		gap: 6px;
		font-size: var(--text-md);
		font-weight: 500;
	}

	.access-grant-main :global(.access-grant-sentence svg) {
		color: var(--access-grant-icon, var(--brand));
	}

	.access-grant-main :global(:is(.access-grant-name, .access-grant-sentence)) {
		color: var(--access-grant-text, currentcolor);
	}

	.access-grant-main :global(.access-grant-meta) {
		display: flex;
		flex-wrap: wrap;
		gap: 2px var(--space-3);
		margin-top: 2px;
		font-size: var(--text-sm);
		color: var(--muted-foreground);
	}

	.access-grant-main :global(.access-grant-meta li) {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
	}

	.access-grant-main :global(.access-grant-meta code) {
		padding: 0 var(--space-1);
		border: 1px solid var(--border);
		border-radius: 5px;
		background: var(--muted);
		color: var(--foreground);
		font-size: var(--text-sm);
	}

	.access-grant-actions {
		grid-area: action;
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		place-self: end;
		gap: var(--nested-control-gap);
	}

	.access-grant-disclosure {
		grid-area: details;
		min-width: 0;
	}

	@media (width >= 640px) {
		.access-grant-row {
			grid-template-columns: minmax(0, 1fr) auto;
			grid-template-areas: 'main action';
			align-items: center;
			gap: 10px var(--space-4);
		}

		.access-grant-row.has-details {
			grid-template-areas: 'main action' 'details details';
		}

		.access-grant-actions {
			align-self: center;
		}

		.access-grant-main :global(.access-grant-meta) {
			column-gap: 0;
		}

		.access-grant-main :global(.access-grant-meta .separated::before) {
			content: '·';
			margin: 0 7px;
		}
	}
</style>
