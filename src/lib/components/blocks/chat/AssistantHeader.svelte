<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis';
	import EyeIcon from '@lucide/svelte/icons/eye';
	import HistoryIcon from '@lucide/svelte/icons/history';
	import InfoIcon from '@lucide/svelte/icons/info';
	import PowerIcon from '@lucide/svelte/icons/power';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import SquarePenIcon from '@lucide/svelte/icons/square-pen';
	import XIcon from '@lucide/svelte/icons/x';
	import * as Alert from '$lib/components/base/alert/index.js';
	import { Badge } from '$lib/components/base/badge/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import * as DropdownMenu from '$lib/components/base/dropdown-menu/index.js';
	import { Switch } from '$lib/components/base/switch/index.js';
	import {
		ASSISTANT_SHEET,
		ASSISTANT_VIEW,
		type AssistantSheet,
		type AssistantView,
	} from '$lib/modules/chat/assistant.context.svelte.js';
	import { CHAT_AVAILABILITY, type ChatAvailability } from '$lib/modules/chat/types.js';
	import { keepFocusOnPress } from '$lib/reactivity/keyboard_inset.svelte.js';

	/**
	 * Two lines on every viewport: the title with the wishlist and ✕, then the tools and the
	 * Bez kontroly switch, so the switch has one home. Its hint shows once until dismissed. While
	 * the on-screen keyboard is open it folds to one line with the tools behind ⋯.
	 */
	let {
		wishlistTitle,
		view,
		mobile,
		compact,
		sheet,
		availability,
		fastForward,
		toolsMenuOpen = $bindable(false),
		hintDismissed,
		onclose,
		onview,
		onnew,
		onfastforward,
		ondismisshint,
		onsheet,
		onpreview,
		runnerSettings,
	}: {
		wishlistTitle: string;
		view: AssistantView;
		mobile: boolean;
		compact: boolean;
		sheet: AssistantSheet;
		availability: ChatAvailability;
		fastForward: boolean;
		/** The ⋯ tools menu is open. */
		toolsMenuOpen?: boolean;
		hintDismissed: boolean;
		onclose: () => void;
		onview: (view: AssistantView) => void;
		onnew: () => void;
		onfastforward: (fastForward: boolean) => void;
		ondismisshint: () => void;
		onsheet: (sheet: AssistantSheet) => void;
		/** Shows the wishlist: closes the keyboard and shrinks the sheet. */
		onpreview: () => void;
		/** Pokročilé, only for users whose turns go to the chat runner. */
		runnerSettings?: Snippet;
	} = $props();

	let menuOpenedByPointer = false;

	const available = $derived(availability === CHAT_AVAILABILITY.available);
	const demo = $derived(availability === CHAT_AVAILABILITY.demo);
	const showHint = $derived(
		(available || demo) && !hintDismissed && !(mobile && sheet === ASSISTANT_SHEET.half),
	);
	const compactChat = $derived(compact && view === ASSISTANT_VIEW.chat);

	function keepComposerFocus(event: Event) {
		if (menuOpenedByPointer) {
			event.preventDefault();
		}
	}

	// The menu lives only in the compact header; unmounting it never reports a close.
	$effect(() => {
		if (!compactChat) {
			toolsMenuOpen = false;
		}
	});
</script>

{#snippet closeButton()}
	<Button
		intent="ghost"
		size={compact ? 'lg' : 'md'}
		format="icon"
		aria-label={m.chat_close()}
		data-testid="assistant-close"
		onclick={onclose}
	>
		<XIcon />
	</Button>
{/snippet}

{#snippet trustSwitch()}
	<label class="trust">
		<Switch
			checked={fastForward}
			onCheckedChange={onfastforward}
			data-testid="assistant-fast-forward"
			onpointerdown={compact ? keepFocusOnPress : undefined}
		/>
		{m.chat_fast_forward()}
	</label>
{/snippet}

{#snippet moreMenu()}
	<!-- A tap keeps the composer focused so the keyboard stays open; keyboard and assistive
	     technology users, whose activation has no pointer press, get focus moved into the menu. -->
	<DropdownMenu.Root bind:open={toolsMenuOpen}>
		<DropdownMenu.Trigger>
			{#snippet child({ props })}
				<!-- Capture phase: the trigger's own handlers prevent default, which stops Bits from
				     calling handlers merged after them. -->
				<Button
					{...props}
					intent="ghost"
					size="lg"
					format="icon"
					aria-label={m.chat_tools_more()}
					data-testid="assistant-more"
					onpointerdowncapture={() => (menuOpenedByPointer = true)}
					onkeydowncapture={() => (menuOpenedByPointer = false)}
					onclickcapture={(event) => {
						if (event.detail === 0) {
							menuOpenedByPointer = false;
						}
					}}
				>
					<EllipsisIcon />
				</Button>
			{/snippet}
		</DropdownMenu.Trigger>
		<DropdownMenu.Content
			align="end"
			aria-label={m.chat_tools_label()}
			shadowedTrigger={false}
			onOpenAutoFocus={keepComposerFocus}
			onCloseAutoFocus={keepComposerFocus}
		>
			<DropdownMenu.Item data-testid="assistant-preview" onclick={onpreview}>
				<EyeIcon />
				<span class="menu-label">
					{m.chat_preview_toggle()}
					<span class="menu-hint">{m.chat_preview_menu_hint()}</span>
				</span>
			</DropdownMenu.Item>
			<DropdownMenu.Separator />
			<DropdownMenu.Item
				data-testid="assistant-history-open"
				onpointerdown={keepFocusOnPress}
				onclick={() => onview(ASSISTANT_VIEW.history)}
			>
				<HistoryIcon />{m.chat_history_open()}
			</DropdownMenu.Item>
			{#if !demo}
				<DropdownMenu.Item
					disabled={!available}
					data-testid="assistant-new-chat"
					onpointerdown={keepFocusOnPress}
					onclick={onnew}
				>
					<SquarePenIcon />{m.chat_new()}
				</DropdownMenu.Item>
			{/if}
		</DropdownMenu.Content>
	</DropdownMenu.Root>
{/snippet}

{#snippet chatState()}
	{#if availability === CHAT_AVAILABILITY.disabled}
		<Badge tone="neutral" badgeStyle="subtle" class="state">
			{#snippet icon()}<PowerIcon />{/snippet}
			{m.chat_state_disabled()}
		</Badge>
	{:else if demo}
		<Badge tone="accent" badgeStyle="solid" class="state">{m.chat_state_demo()}</Badge>
	{/if}
	{#if available || demo}
		{@render trustSwitch()}
	{/if}
{/snippet}

<header class={['head', compactChat && 'is-compact']}>
	{#if compactChat}
		<div class="line">
			<span class="mark" aria-hidden="true"><SparklesIcon /></span>
			<h2 class="title" id="assistant-title">{m.chat_assistant_title()}</h2>
			{#if available || demo}
				{@render trustSwitch()}
			{/if}
			{@render moreMenu()}
			{@render closeButton()}
		</div>
	{:else if view === ASSISTANT_VIEW.history}
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
			<!-- The demo keeps one chat, so its prepared actions are offered once each. -->
			{#if !demo}
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
			{/if}
			{@render runnerSettings?.()}
			{@render chatState()}
		</div>
		{#if showHint}
			<!-- Compact padding keeps the one-time hint from crowding the panel header. -->
			<Alert.Root tone="info" class="py-1.5 pr-1 pl-2.5 whitespace-normal">
				<InfoIcon aria-hidden="true" />
				<Alert.Description>
					<strong>{m.chat_fast_forward()}:</strong>
					{m.chat_fast_forward_hint()}
				</Alert.Description>
				<Alert.Action>
					<Button
						intent="ghost"
						size="sm"
						format="icon"
						aria-label={m.chat_hint_dismiss()}
						onclick={ondismisshint}
					>
						<XIcon />
					</Button>
				</Alert.Action>
			</Alert.Root>
		{/if}
	{/if}
</header>

<style>
	.head {
		display: grid;
		gap: var(--space-1);
		padding: var(--space-2) var(--space-3) var(--space-2) var(--space-4);
		border-bottom: 2px solid var(--edge);
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
		border: 2px solid var(--edge);
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

	.tools :global(.state + .trust) {
		margin-inline-start: var(--space-2);
	}

	.head.is-compact {
		padding: var(--space-1) var(--space-1) var(--space-1) var(--space-3);
	}

	.is-compact .line {
		gap: var(--space-1);
	}

	.is-compact .mark {
		width: 24px;
		height: 24px;
		margin-inline-end: var(--space-1);
		border-radius: 7px;
	}

	.is-compact .mark :global(svg) {
		width: 14px;
		height: 14px;
	}

	.is-compact .title {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		font-size: var(--text-lg);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.is-compact .trust {
		gap: 6px;
		min-height: var(--size-control-lg);
		padding: 0 var(--space-1) 0 6px;
		border-radius: var(--radius-btn);
		background: var(--muted);
		font-size: var(--text-sm);
		white-space: nowrap;
	}

	.menu-label {
		display: grid;
	}

	.menu-hint {
		color: var(--muted-foreground);
		font-size: var(--text-xs);
		font-weight: 500;
	}
</style>
