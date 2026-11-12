<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import CheckIcon from '@lucide/svelte/icons/check';
	import { Spinner } from '$lib/components/base/spinner/index.js';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import { CHAT_PART, type ChatPart, type ChatToolLine } from '$lib/modules/chat/chat_thread.js';
	import { chatToolLabel } from './chat_presentation.js';
	import ChatNote from './ChatNote.svelte';

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

	/** Only the newest part of a streaming answer is still in progress. */
	function isStreaming(partIndex: number): boolean {
		return live && partIndex === parts.length - 1;
	}
</script>

{#snippet caret()}
	<span class="caret" aria-hidden="true"></span>
{/snippet}

{#snippet toolLines(tools: readonly ChatToolLine[], streaming: boolean)}
	<ul class="tools" aria-label={m.chat_steps_label()}>
		{#each tools as tool, toolIndex (toolIndex)}
			<ChatNote as="li">
				{#if streaming && toolIndex === tools.length - 1}
					<Spinner />
				{:else}
					<CheckIcon aria-hidden="true" />
				{/if}
				<span>{chatToolLabel(tool)}</span>
			</ChatNote>
		{/each}
	</ul>
{/snippet}

<div class="answer">
	<span class="avatar" aria-hidden="true"><SparklesIcon /></span>
	<div class="answer-body">
		<span class="sr-only">{m.chat_assistant_says()}</span>
		{#each parts as part, partIndex (partIndex)}
			{#if part.type === CHAT_PART.tools}
				{@render toolLines(part.tools, isStreaming(partIndex))}
			{:else if part.type === CHAT_PART.text}
				<p class="text">
					{part.text}{#if isStreaming(partIndex)}{@render caret()}{/if}
				</p>
			{:else}
				{@render proposal(part.proposalId)}
			{/if}
		{/each}
		{#if live && parts.length === 0}
			<p class="text">{@render caret()}</p>
		{/if}
	</div>
</div>

<style>
	.answer {
		--answer-avatar-size: 28px;
		--answer-line-height: calc(var(--text-md) * 1.5);

		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: var(--space-2);
		align-items: start;
	}

	.avatar {
		display: grid;
		place-items: center;
		width: var(--answer-avatar-size);
		height: var(--answer-avatar-size);
		border: 2px solid var(--ink);
		border-radius: 50%;
		background: var(--tint);
	}

	.avatar :global(svg) {
		width: 14px;
		height: 14px;
	}

	/* The first line, text or tool line, is centred on the avatar while later lines flow down,
	   so a growing answer never moves the line already shown. */
	.answer-body {
		display: grid;
		gap: var(--space-2);
		min-width: 0;
		padding-top: max(0px, calc((var(--answer-avatar-size) - var(--answer-line-height)) / 2));
	}

	.text {
		font-size: var(--text-md);
		line-height: var(--answer-line-height);
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

	.tools > :global(li) {
		min-height: var(--answer-line-height);
	}

	.caret {
		display: inline-block;
		width: 7px;
		height: 1em;

		/* Its margin box fills the line exactly, so the caret centres on the line and the avatar. */
		margin-block: calc((var(--answer-line-height) - 1em) / 2);
		margin-inline-start: 2px;
		vertical-align: top;
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
