<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import CheckIcon from '@lucide/svelte/icons/check';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import CircleDashedIcon from '@lucide/svelte/icons/circle-dashed';
	import XIcon from '@lucide/svelte/icons/x';
	import * as Collapsible from '$lib/components/base/collapsible/index.js';
	import { Spinner } from '$lib/components/base/spinner/index.js';
	import {
		chatToolLineStatus,
		type ChatToolCallState,
		type ChatToolLine,
	} from '$lib/modules/chat/chat_thread.js';
	import { CHAT_TOOL_STATUS, type ChatToolStatus } from '$lib/modules/chat/types.js';
	import {
		chatToolDuration,
		chatToolErrorMessage,
		chatToolErrorReason,
		chatToolLabel,
		chatToolSummaryText,
	} from './chat_presentation.js';

	/**
	 * One tool line of an answer: its status and, on failure, the reason, always visible; its
	 * calls' details collapsed behind it. The debug view adds each call's raw input and result as
	 * plain text, since a result may hold text a third-party page wrote.
	 */
	let {
		line,
		live,
		debug,
	}: {
		line: ChatToolLine;
		/** The answer is still streaming, so a running call spins rather than reads unfinished. */
		live: boolean;
		debug: boolean;
	} = $props();

	const status = $derived(chatToolLineStatus(line));
	const failedCall = $derived(line.calls.find((call) => call.status === CHAT_TOOL_STATUS.error));

	function statusLabel(callStatus: ChatToolStatus): string {
		switch (callStatus) {
			case CHAT_TOOL_STATUS.running:
				return live ? m.chat_tool_status_running() : m.chat_tool_status_unfinished();
			case CHAT_TOOL_STATUS.ok:
				return m.chat_tool_status_ok();
			case CHAT_TOOL_STATUS.error:
				return m.chat_tool_status_error();
		}
	}
</script>

{#snippet statusIcon()}
	{#if status === CHAT_TOOL_STATUS.running && live}
		<Spinner />
	{:else if status === CHAT_TOOL_STATUS.running}
		<CircleDashedIcon aria-hidden="true" />
	{:else if status === CHAT_TOOL_STATUS.error}
		<XIcon aria-hidden="true" class="error-icon" />
	{:else}
		<CheckIcon aria-hidden="true" />
	{/if}
{/snippet}

{#snippet errorDetail(error: ChatToolCallState['error'])}
	{@const message = chatToolErrorMessage(error)}
	<dt>{m.chat_tool_detail_error()}</dt>
	<dd>
		{chatToolErrorReason(error)}
		{#if error?.code}
			· <span class="code">{error.code}</span>
		{/if}
		{#if message !== null}
			· {message}
		{/if}
	</dd>
{/snippet}

{#snippet debugDetails(callDebug: NonNullable<ChatToolCallState['debug']>)}
	<dt>{m.chat_tool_debug_input()}</dt>
	<dd>
		<pre data-testid="assistant-tool-debug">{callDebug.input}</pre>
	</dd>
	{#if callDebug.result !== null}
		<dt>{m.chat_tool_debug_result()}</dt>
		<dd><pre>{callDebug.result}</pre></dd>
	{/if}
{/snippet}

{#snippet callDetails(call: ChatToolCallState)}
	<dl class="call">
		<dt>{m.chat_tool_detail_tool()}</dt>
		<dd class="code">{call.name}</dd>
		{#if call.query !== null}
			<dt>{m.chat_tool_detail_query()}</dt>
			<dd class="code">{call.query}</dd>
		{/if}
		<dt>{m.chat_tool_detail_status()}</dt>
		<dd>{statusLabel(call.status)}</dd>
		{#if call.status === CHAT_TOOL_STATUS.error}
			{@render errorDetail(call.error)}
		{/if}
		{#if call.durationMs !== null}
			<dt>{m.chat_tool_detail_duration()}</dt>
			<dd>{chatToolDuration(call.durationMs)}</dd>
		{/if}
		{#if call.summary !== null}
			<dt>{m.chat_tool_detail_result()}</dt>
			<dd>{chatToolSummaryText(call.summary)}</dd>
		{/if}
		{#if debug && call.debug !== undefined}
			{@render debugDetails(call.debug)}
		{/if}
	</dl>
{/snippet}

<li class="step" data-testid="assistant-tool-step" data-status={status}>
	<Collapsible.Root>
		<Collapsible.Trigger class="step-line">
			{@render statusIcon()}
			<span class="label">
				<span class="sr-only">{statusLabel(status)}:</span>
				{chatToolLabel(line)}
				{#if failedCall !== undefined}
					<span class="reason">– {chatToolErrorReason(failedCall.error)}</span>
				{/if}
			</span>
			<ChevronRightIcon aria-hidden="true" class="chevron" />
		</Collapsible.Trigger>
		<Collapsible.Content>
			<div class="details" aria-label={m.chat_tool_details_label()} role="group">
				{#each line.calls as call, callIndex (call.id ?? callIndex)}
					{@render callDetails(call)}
				{/each}
			</div>
		</Collapsible.Content>
	</Collapsible.Root>
</li>

<style>
	.step {
		min-height: var(--answer-line-height, auto);
		color: var(--muted-foreground);
		font-size: var(--text-sm);
	}

	.step :global(.step-line) {
		display: flex;
		align-items: center;
		gap: 6px;
		width: 100%;
		min-height: var(--answer-line-height, 24px);
		border-radius: var(--radius-sm, 4px);
		color: inherit;
		text-align: start;
	}

	.step :global(.step-line:focus-visible) {
		outline: 2px solid var(--ring);
		outline-offset: 2px;
	}

	.step :global(.step-line svg) {
		flex: none;
		width: 14px;
		height: 14px;
	}

	.step :global(.error-icon) {
		color: var(--status-danger);
	}

	.label {
		min-width: 0;
		overflow-wrap: anywhere;
	}

	.reason {
		color: var(--status-danger-text);
	}

	.step :global(.chevron) {
		margin-inline-start: auto;
		opacity: 0.6;
		transition: transform var(--duration-fast, 150ms) ease;
	}

	.step :global(.step-line[aria-expanded='true'] .chevron) {
		transform: rotate(90deg);
	}

	@media (prefers-reduced-motion: reduce) {
		.step :global(.chevron) {
			transition: none;
		}
	}

	.details {
		display: grid;
		gap: var(--space-2);
		padding: var(--space-1) 0 var(--space-1) 20px;
	}

	.call {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: 2px var(--space-3);
		margin: 0;
	}

	.call + .call {
		padding-top: var(--space-2);
		border-top: 1px solid var(--border);
	}

	dt {
		font-weight: 600;
	}

	dd {
		min-width: 0;
		margin: 0;
		overflow-wrap: anywhere;
	}

	.code {
		font-family: var(--font-mono, ui-monospace, monospace);
		font-size: var(--text-xs, 12px);
	}

	pre {
		max-height: 240px;
		margin: 0;
		overflow: auto;
		font-family: var(--font-mono, ui-monospace, monospace);
		font-size: var(--text-xs, 12px);
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
</style>
