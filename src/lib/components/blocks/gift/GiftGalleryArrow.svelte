<script lang="ts">
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import * as m from '$lib/paraglide/messages.js';
	import { Button, type ButtonSize } from '$lib/components/base/button/index.js';

	interface Props {
		direction: 'previous' | 'next';
		ref?: HTMLElement | null;
		class?: string;
		size?: ButtonSize;
		testId: string;
		onclick: () => void;
	}

	let {
		direction,
		ref = $bindable(null),
		class: className,
		size,
		testId,
		onclick,
	}: Props = $props();
</script>

<Button
	bind:ref
	intent="secondary"
	{size}
	format="icon"
	class={className}
	aria-label={direction === 'previous'
		? m.gift_gallery_previous_image()
		: m.gift_gallery_next_image()}
	data-testid={testId}
	{onclick}
>
	{#if direction === 'previous'}
		<ChevronLeftIcon />
	{:else}
		<ChevronRightIcon />
	{/if}
</Button>
