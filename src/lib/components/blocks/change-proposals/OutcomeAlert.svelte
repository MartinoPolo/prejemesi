<script lang="ts">
	import type { Component, Snippet } from 'svelte';
	import * as Alert from '$lib/components/base/alert/index.js';
	import type { AlertTone } from '$lib/components/base/alert/index.js';

	/** A review outcome: what happened to the proposal and what the reviewer can do next. */
	let {
		tone,
		icon: Icon,
		title,
		body,
		urgent = false,
		focusOnMount = false,
		testId,
		children,
		actions,
	}: {
		tone: AlertTone;
		icon: Component;
		title: string;
		body?: string;
		/** Interrupts assistive technology; other outcomes are announced politely. */
		urgent?: boolean;
		/** Moves focus here after the reviewer's own action produced this outcome. */
		focusOnMount?: boolean;
		testId: string;
		children?: Snippet;
		actions?: Snippet;
	} = $props();

	let alertElement = $state<HTMLElement | null>(null);

	$effect(() => {
		if (focusOnMount) {
			alertElement?.focus();
		}
	});
</script>

<Alert.Root
	bind:ref={alertElement}
	{tone}
	role={urgent ? 'alert' : 'status'}
	tabindex={-1}
	class="mt-4 outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
	data-testid={testId}
>
	<Icon aria-hidden="true" />
	<Alert.Title>{title}</Alert.Title>
	{#if body !== undefined || children !== undefined}
		<Alert.Description>
			{#if body !== undefined}<p>{body}</p>{/if}
			{@render children?.()}
		</Alert.Description>
	{/if}
	{#if actions !== undefined}
		<div class="outcome-actions">{@render actions()}</div>
	{/if}
</Alert.Root>

<style>
	.outcome-actions {
		display: flex;
		flex-wrap: wrap;
		grid-column: 2;
		gap: var(--nested-control-gap);
		margin-top: 10px;
	}
</style>
