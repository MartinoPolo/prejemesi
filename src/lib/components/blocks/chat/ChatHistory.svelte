<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import ClockIcon from '@lucide/svelte/icons/clock';
	import SquarePenIcon from '@lucide/svelte/icons/square-pen';
	import { Button } from '$lib/components/base/button/index.js';
	import { Skeleton } from '$lib/components/base/skeleton/index.js';
	import { formatChangeReviewDateTime } from '$lib/modules/change_proposals/change_review_copy.js';
	import type { ChatSessionSummary } from '$lib/modules/chat/types.js';
	import ChatNote from './ChatNote.svelte';

	/** This wishlist's chats from the last 30 days, newest first. */
	let {
		sessions,
		activeSessionId,
		canStartNew,
		onopen,
		onnew,
	}: {
		/** Undefined while loading. */
		sessions: readonly ChatSessionSummary[] | undefined;
		activeSessionId: string | null;
		canStartNew: boolean;
		onopen: (sessionId: string) => void;
		onnew: () => void;
	} = $props();
</script>

<div class="history" data-testid="assistant-history">
	{#if canStartNew}
		<Button size="md" class="w-full" onclick={onnew}>
			<SquarePenIcon data-icon="inline-start" />{m.chat_new()}
		</Button>
	{/if}
	{#if sessions === undefined}
		<div class="loading" aria-busy="true">
			<span class="sr-only">{m.chat_history_loading()}</span>
			<Skeleton class="h-13 w-full" />
			<Skeleton class="h-13 w-full" />
		</div>
	{:else if sessions.length === 0}
		<ChatNote>{m.chat_history_empty()}</ChatNote>
	{:else}
		<ul class="list">
			{#each sessions as session (session.id)}
				<li>
					<button
						type="button"
						class="item"
						aria-current={session.id === activeSessionId ? 'true' : undefined}
						onclick={() => onopen(session.id)}
					>
						<strong>{session.title}</strong>
						<span class="sub">{formatChangeReviewDateTime(session.lastTurnAt)}</span>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
	<ChatNote><ClockIcon aria-hidden="true" />{m.chat_history_note()}</ChatNote>
</div>

<style>
	.history,
	.loading,
	.list {
		display: grid;
		gap: var(--space-2);
	}

	.list {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.item {
		display: grid;
		gap: 2px;
		width: 100%;
		padding: var(--space-2) var(--space-3);
		border: 2px solid var(--ink);
		border-radius: var(--chat-surface-radius);
		background: var(--card);
		color: inherit;
		text-align: start;
		cursor: pointer;
	}

	.item:hover,
	.item[aria-current='true'] {
		background: var(--panel-hover);
	}

	.item:focus-visible {
		outline: 2px solid var(--ring);
		outline-offset: 2px;
	}

	.item strong {
		font-size: var(--text-md);
		overflow-wrap: anywhere;
	}

	.sub {
		color: var(--muted-foreground);
		font-size: var(--text-sm);
	}
</style>
