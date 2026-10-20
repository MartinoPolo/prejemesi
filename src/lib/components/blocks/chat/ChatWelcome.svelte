<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import ImageIcon from '@lucide/svelte/icons/image';
	import LinkIcon from '@lucide/svelte/icons/link';
	import ListIcon from '@lucide/svelte/icons/list';

	const STARTERS = [
		{ icon: ImageIcon, label: m.chat_starter_enrich, prompt: m.chat_starter_enrich_prompt },
		{ icon: LinkIcon, label: m.chat_starter_add, prompt: m.chat_starter_add_prompt },
		{ icon: ListIcon, label: m.chat_starter_bulk, prompt: m.chat_starter_bulk_prompt },
	];

	/**
	 * An empty chat's greeting; the starters put a prompt in the composer to finish. The demo
	 * points to its prepared actions instead.
	 */
	let {
		available,
		demo,
		onstarter,
	}: {
		available: boolean;
		demo: boolean;
		onstarter: (prompt: string) => void;
	} = $props();
</script>

<div class="welcome">
	<p class="welcome-title">{demo ? m.chat_demo_welcome() : m.chat_welcome()}</p>
	{#if available}
		<div class="starters">
			{#each STARTERS as starter (starter.label)}
				<button type="button" class="starter" onclick={() => onstarter(starter.prompt())}>
					<span class="starter-icon" aria-hidden="true"><starter.icon /></span>
					<span>{starter.label()}</span>
					<ChevronRightIcon aria-hidden="true" />
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.welcome {
		display: grid;
		gap: var(--space-3);
	}

	.welcome-title {
		font-family: var(--font-head);
		font-size: var(--text-lg);
	}

	.starters {
		display: grid;
		gap: var(--space-2);
	}

	.starter {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		border: 2px solid var(--ink);
		border-radius: var(--chat-surface-radius);
		background: var(--card);
		color: inherit;
		font-size: var(--text-md);
		font-weight: 600;
		text-align: start;
		cursor: pointer;
	}

	.starter:hover {
		background: var(--panel-hover);
	}

	.starter:focus-visible {
		outline: 2px solid var(--ring);
		outline-offset: 2px;
	}

	.starter :global(svg) {
		width: 16px;
		height: 16px;
	}

	.starter-icon {
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		border-radius: 8px;
		background: var(--tint);
	}
</style>
