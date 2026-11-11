<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import ClockIcon from '@lucide/svelte/icons/clock';
	import SquarePenIcon from '@lucide/svelte/icons/square-pen';
	import { Button } from '$lib/components/base/button/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	import * as Select from '$lib/components/base/select/index.js';
	import { Skeleton } from '$lib/components/base/skeleton/index.js';
	import { formatChangeReviewDateTime } from '$lib/modules/change_proposals/change_review_copy.js';
	import {
		CHAT_RUNNER_MODELS,
		type ChatRunnerModel,
		type ChatSessionSummary,
	} from '$lib/modules/chat/types.js';
	import ChatNote from './ChatNote.svelte';

	/** Claude model names, the same in every language. */
	const RUNNER_MODEL_NAMES: Record<ChatRunnerModel, string> = {
		opus: 'Opus',
		sonnet: 'Sonnet',
		haiku: 'Haiku',
	};

	/**
	 * This wishlist's chats from the last 30 days, newest first. Users whose turns go to the chat
	 * runner also choose its model here.
	 */
	let {
		sessions,
		activeSessionId,
		canStartNew,
		runnerModel,
		onopen,
		onnew,
		onrunnermodel,
	}: {
		/** Undefined while loading. */
		sessions: readonly ChatSessionSummary[] | undefined;
		activeSessionId: string | null;
		canStartNew: boolean;
		/** Undefined when the user's turns do not go to the chat runner. */
		runnerModel?: ChatRunnerModel;
		onopen: (sessionId: string) => void;
		onnew: () => void;
		onrunnermodel?: (model: ChatRunnerModel) => void;
	} = $props();

	const idPrefix = $props.id();

	function isRunnerModel(value: string): value is ChatRunnerModel {
		return CHAT_RUNNER_MODELS.some((model) => model === value);
	}
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
	{#if runnerModel !== undefined}
		<section class="advanced" aria-labelledby="{idPrefix}-advanced">
			<h3 id="{idPrefix}-advanced" class="advanced-title">{m.chat_advanced_title()}</h3>
			<div class="model">
				<Label for="{idPrefix}-model">{m.chat_model_label()}</Label>
				<Select.Root
					type="single"
					value={runnerModel}
					onValueChange={(selected) => {
						if (isRunnerModel(selected)) {
							onrunnermodel?.(selected);
						}
					}}
				>
					<Select.Trigger
						id="{idPrefix}-model"
						size="sm"
						data-testid="assistant-runner-model"
					>
						{RUNNER_MODEL_NAMES[runnerModel]}
					</Select.Trigger>
					<Select.Content>
						{#each CHAT_RUNNER_MODELS as model (model)}
							<Select.Item value={model} label={RUNNER_MODEL_NAMES[model]}>
								{RUNNER_MODEL_NAMES[model]}
							</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>
		</section>
	{/if}
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

	.advanced {
		display: grid;
		gap: var(--space-2);
		margin-top: var(--space-3);
		padding-top: var(--space-3);
		border-top: 1px solid var(--border);
	}

	.advanced-title {
		margin: 0;
		color: var(--muted-foreground);
		font-size: var(--text-sm);
		font-weight: 600;
	}

	.model {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
	}
</style>
