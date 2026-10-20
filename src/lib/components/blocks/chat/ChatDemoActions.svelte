<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import CheckIcon from '@lucide/svelte/icons/check';
	import FlaskConicalIcon from '@lucide/svelte/icons/flask-conical';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import { Button } from '$lib/components/base/button/index.js';
	import ChatNote from './ChatNote.svelte';

	const DEMO_ACTIONS = [m.chat_demo_enrich, m.chat_demo_add, m.chat_demo_sort];

	/**
	 * The demo's composer: prepared requests the scripted assistant answers. Each one is sent as
	 * its label and offered once per chat.
	 */
	let {
		sentTexts,
		busy,
		onsend,
	}: {
		sentTexts: ReadonlySet<string>;
		busy: boolean;
		onsend: (text: string) => void;
	} = $props();
</script>

<ChatNote><FlaskConicalIcon aria-hidden="true" />{m.chat_demo_note()}</ChatNote>
<div class="actions" role="group" aria-label={m.chat_demo_actions_label()}>
	{#each DEMO_ACTIONS as action (action)}
		{@const label = action()}
		{@const sent = sentTexts.has(label)}
		<Button
			intent="secondary"
			size="sm"
			disabled={sent || busy}
			data-testid="assistant-demo-action"
			onclick={() => onsend(label)}
		>
			{#if sent}
				<CheckIcon data-icon="inline-start" />
			{:else}
				<SparklesIcon data-icon="inline-start" />
			{/if}
			{label}
		</Button>
	{/each}
</div>

<style>
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
</style>
