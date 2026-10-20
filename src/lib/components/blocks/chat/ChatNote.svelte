<script lang="ts">
	import type { Snippet } from 'svelte';

	/** A muted one-line note in the assistant, led by a small icon. */
	let {
		as = 'p',
		role,
		emphasis = false,
		children,
	}: {
		as?: 'p' | 'li';
		role?: 'status';
		/** The cap and kill-switch lines carry weight; tool steps and history notes do not. */
		emphasis?: boolean;
		children: Snippet;
	} = $props();
</script>

<svelte:element this={as} class={['note', emphasis && 'is-emphasis']} {role}>
	{@render children()}
</svelte:element>

<style>
	.note {
		display: flex;
		align-items: center;
		gap: 6px;
		color: var(--muted-foreground);
		font-size: var(--text-sm);
	}

	.note.is-emphasis {
		font-weight: 600;
	}

	.note :global(svg) {
		flex: none;
		width: 14px;
		height: 14px;
	}
</style>
