<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import EyeIcon from '@lucide/svelte/icons/eye';
	import HistoryIcon from '@lucide/svelte/icons/history';
	import InfoIcon from '@lucide/svelte/icons/info';
	import PowerIcon from '@lucide/svelte/icons/power';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import SquarePenIcon from '@lucide/svelte/icons/square-pen';
	import XIcon from '@lucide/svelte/icons/x';
	import { Badge } from '$lib/components/base/badge/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { Switch } from '$lib/components/base/switch/index.js';
	import {
		ASSISTANT_SHEET,
		ASSISTANT_VIEW,
		type AssistantSheet,
		type AssistantView,
	} from '$lib/modules/chat/assistant.context.svelte.js';
	import { CHAT_AVAILABILITY, type ChatAvailability } from '$lib/modules/chat/types.js';

	/**
	 * Two lines on every viewport: the title with the wishlist and ✕, then the tools and the
	 * Bez kontroly switch, so the switch has one home. Its hint shows once until dismissed.
	 */
	let {
		wishlistTitle,
		view,
		mobile,
		sheet,
		availability,
		fastForward,
		hintDismissed,
		onclose,
		onview,
		onnew,
		onfastforward,
		ondismisshint,
		onsheet,
	}: {
		wishlistTitle: string;
		view: AssistantView;
		mobile: boolean;
		sheet: AssistantSheet;
		availability: ChatAvailability;
		fastForward: boolean;
		hintDismissed: boolean;
		onclose: () => void;
		onview: (view: AssistantView) => void;
		onnew: () => void;
		onfastforward: (fastForward: boolean) => void;
		ondismisshint: () => void;
		onsheet: (sheet: AssistantSheet) => void;
	} = $props();

	const available = $derived(availability === CHAT_AVAILABILITY.available);
	const showHint = $derived(
		available && !hintDismissed && !(mobile && sheet === ASSISTANT_SHEET.half),
	);
</script>

{#snippet closeButton()}
	<Button
		intent="ghost"
		size="md"
		format="icon"
		aria-label={m.chat_close()}
		data-testid="assistant-close"
		onclick={onclose}
	>
		<XIcon />
	</Button>
{/snippet}

<header class="head">
	{#if view === ASSISTANT_VIEW.history}
		<div class="line">
			<Button
				intent="ghost"
				size="md"
				format="icon"
				aria-label={m.chat_history_back()}
				onclick={() => onview(ASSISTANT_VIEW.chat)}
			>
				<ArrowLeftIcon />
			</Button>
			<div class="titles">
				<h2 class="title" id="assistant-title">{m.chat_history_title()}</h2>
				<p class="scope">{wishlistTitle}</p>
			</div>
			{@render closeButton()}
		</div>
	{:else}
		<div class="line">
			<span class="mark" aria-hidden="true"><SparklesIcon /></span>
			<div class="titles">
				<h2 class="title" id="assistant-title">{m.chat_assistant_title()}</h2>
				<p class="scope">{wishlistTitle}</p>
			</div>
			{@render closeButton()}
		</div>
		<div class="tools" role="toolbar" aria-label={m.chat_tools_label()}>
			{#if mobile}
				<Button
					intent="ghost"
					size="md"
					aria-pressed={sheet === ASSISTANT_SHEET.half}
					onclick={() =>
						onsheet(
							sheet === ASSISTANT_SHEET.half
								? ASSISTANT_SHEET.full
								: ASSISTANT_SHEET.half,
						)}
				>
					<EyeIcon data-icon="inline-start" />{m.chat_preview_toggle()}
				</Button>
			{/if}
			<Button
				intent="ghost"
				size="md"
				format="icon"
				aria-label={m.chat_history_open()}
				data-testid="assistant-history-open"
				onclick={() => onview(ASSISTANT_VIEW.history)}
			>
				<HistoryIcon />
			</Button>
			<Button
				intent="ghost"
				size="md"
				format="icon"
				aria-label={m.chat_new()}
				disabled={!available}
				data-testid="assistant-new-chat"
				onclick={onnew}
			>
				<SquarePenIcon />
			</Button>
			{#if availability === CHAT_AVAILABILITY.disabled}
				<Badge tone="neutral" badgeStyle="subtle" class="state">
					{#snippet icon()}<PowerIcon />{/snippet}
					{m.chat_state_disabled()}
				</Badge>
			{:else if available}
				<label class="trust">
					<Switch
						checked={fastForward}
						onCheckedChange={onfastforward}
						data-testid="assistant-fast-forward"
					/>
					{m.chat_fast_forward()}
				</label>
			{/if}
		</div>
		{#if showHint}
			<div class="hint" role="note">
				<InfoIcon aria-hidden="true" />
				<span><strong>{m.chat_fast_forward()}:</strong> {m.chat_fast_forward_hint()}</span>
				<Button
					intent="ghost"
					size="sm"
					format="icon"
					aria-label={m.chat_hint_dismiss()}
					onclick={ondismisshint}
				>
					<XIcon />
				</Button>
			</div>
		{/if}
	{/if}
</header>

<style>
	.head {
		display: grid;
		gap: var(--space-1);
		padding: var(--space-2) var(--space-3) var(--space-2) var(--space-4);
		border-bottom: 2px solid var(--ink);
	}

	.line {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.mark {
		display: grid;
		flex: none;
		place-items: center;
		width: 32px;
		height: 32px;
		border: 2px solid var(--ink);
		border-radius: 10px;
		background: var(--tint);
	}

	.mark :global(svg) {
		width: 16px;
		height: 16px;
	}

	.titles {
		flex: 1;
		min-width: 0;
	}

	.title {
		font-family: var(--font-head);
		font-size: var(--text-xl);
		font-weight: 600;
		line-height: 1.2;
		overflow-wrap: anywhere;
	}

	.scope {
		color: var(--muted-foreground);
		font-size: var(--text-sm);
		overflow-wrap: anywhere;
	}

	.tools {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1);
	}

	.trust {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		margin-inline-start: auto;
		font-size: var(--text-md);
		font-weight: 600;
		cursor: pointer;
	}

	.tools :global(.state) {
		margin-inline-start: auto;
	}

	.hint {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: start;
		gap: var(--space-2);
		padding: 6px 4px 6px var(--space-2);
		border-radius: 10px;
		background: var(--tint);
		font-size: var(--text-sm);
		line-height: 1.4;
	}

	.hint > :global(svg) {
		width: 14px;
		height: 14px;
		margin-top: 2px;
	}
</style>
