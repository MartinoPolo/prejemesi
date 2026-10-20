<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import CheckIcon from '@lucide/svelte/icons/check';
	import LoaderIcon from '@lucide/svelte/icons/loader';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import { CHAT_PART, type ChatPart } from '$lib/modules/chat/chat_thread.js';
	import { chatToolLabel } from './chat_presentation.js';

	/** One assistant answer: tool lines, text and proposals, in the order they came. */
	let {
		parts,
		live = false,
		proposal,
	}: {
		parts: readonly ChatPart[];
		/** Still streaming: the last tool line spins and a caret follows the text. */
		live?: boolean;
		proposal: Snippet<[string]>;
	} = $props();
</script>

<div class="answer">
	<span class="avatar" aria-hidden="true"><SparklesIcon /></span>
	<div class="answer-body">
		<span class="sr-only">{m.chat_assistant_says()}</span>
		{#each parts as part, partIndex (partIndex)}
			{#if part.type === CHAT_PART.tools}
				<ul class="tools" aria-label={m.chat_steps_label()}>
					{#each part.tools as tool, toolIndex (toolIndex)}
						{@const running =
							live &&
							partIndex === parts.length - 1 &&
							toolIndex === part.tools.length - 1}
						<li class="tool">
							{#if running}
								<LoaderIcon class="animate-spin" aria-hidden="true" />
							{:else}
								<CheckIcon aria-hidden="true" />
							{/if}
							<span>{chatToolLabel(tool)}</span>
						</li>
					{/each}
				</ul>
			{:else if part.type === CHAT_PART.text}
				<p class="text">
					{part.text}{#if live && partIndex === parts.length - 1}<span
							class="caret"
							aria-hidden="true"
						></span>{/if}
				</p>
			{:else}
				{@render proposal(part.proposalId)}
			{/if}
		{/each}
		{#if live && parts.length === 0}
			<p class="text"><span class="caret" aria-hidden="true"></span></p>
		{/if}
	</div>
</div>

<style>
	.answer {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: var(--space-2);
		align-items: start;
	}

	.avatar {
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		border: 2px solid var(--ink);
		border-radius: 50%;
		background: var(--tint);
	}

	.avatar :global(svg) {
		width: 14px;
		height: 14px;
	}

	.answer-body {
		display: grid;
		gap: var(--space-2);
		min-width: 0;
	}

	.text {
		font-size: var(--text-md);
		line-height: 1.5;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}

	.tools {
		display: grid;
		gap: 2px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.tool {
		display: flex;
		align-items: center;
		gap: 6px;
		color: var(--muted-foreground);
		font-size: var(--text-sm);
	}

	.tool :global(svg) {
		flex: none;
		width: 14px;
		height: 14px;
	}

	.caret {
		display: inline-block;
		width: 7px;
		height: 1em;
		margin-inline-start: 2px;
		vertical-align: text-bottom;
		background: var(--ink);
		animation: caret-blink 1s steps(2, start) infinite;
	}

	@keyframes caret-blink {
		to {
			visibility: hidden;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.caret {
			animation: none;
		}
	}
</style>
