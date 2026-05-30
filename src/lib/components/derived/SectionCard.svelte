<script lang="ts">
	import * as Card from '$lib/components/base/card/index.js';
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		description?: string;
		children: Snippet;
		footer?: Snippet;
		contentClass?: string;
		class?: string;
	}

	let { title, description, children, footer, contentClass, class: className }: Props = $props();
</script>

<Card.Root class={className}>
	<Card.Header>
		<Card.Title>{title}</Card.Title>
		{#if description}
			<Card.Description>{description}</Card.Description>
		{/if}
	</Card.Header>
	<Card.Content class={contentClass}>
		{@render children()}
	</Card.Content>
	{#if footer}
		<Card.Footer>
			{@render footer()}
		</Card.Footer>
	{/if}
</Card.Root>
