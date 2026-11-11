<script lang="ts">
	import type { Component } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import {
		decisionToggleVariants,
		type DecisionToggleFormat,
		type DecisionToggleTone,
	} from './decision_toggle_variants.js';

	type Props = Omit<HTMLButtonAttributes, 'aria-pressed' | 'aria-label' | 'children'> & {
		ref?: HTMLButtonElement | null;
		format?: DecisionToggleFormat;
		tone: DecisionToggleTone;
		icon: Component;
		/** Visible beside the icon in the text format; the accessible name in the icon format. */
		label: string;
		/** Whether this choice is active; `mixed` when only part of a group has it. Omitted by the editor toggle. */
		pressed?: HTMLButtonAttributes['aria-pressed'];
		compactOnPhone?: boolean;
	};

	let {
		ref = $bindable(),
		format = 'text',
		tone,
		icon: Icon,
		label,
		pressed,
		compactOnPhone = false,
		...restProps
	}: Props = $props();

	const styles = $derived(decisionToggleVariants({ format, tone, compactOnPhone }));
</script>

<button
	bind:this={ref}
	type="button"
	class={styles.root()}
	aria-pressed={pressed}
	aria-label={format === 'icon' ? label : undefined}
	{...restProps}
>
	<Icon aria-hidden="true" />
	{#if format === 'text'}
		<span class={styles.label()}>{label}</span>
	{/if}
</button>
