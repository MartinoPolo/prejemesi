<script lang="ts">
	import { tick } from 'svelte';
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import ClockIcon from '@lucide/svelte/icons/clock';
	import ImageIcon from '@lucide/svelte/icons/image';
	import LinkIcon from '@lucide/svelte/icons/link';
	import ListIcon from '@lucide/svelte/icons/list';
	import PowerIcon from '@lucide/svelte/icons/power';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import { Button } from '$lib/components/base/button/index.js';
	import { toastError } from '$lib/components/base/toast/index.js';
	import type { ChangeRowContext } from '$lib/components/blocks/change-proposals/change_row_model.js';
	import { localizeInternalHref } from '$lib/i18n/locale.js';
	import { translateServerError } from '$lib/modules/errors/translate_server_error.js';
	import { getPendingChangeProposals } from '$lib/modules/change_proposals/index.js';
	import { getGiftsByWishlistShortId } from '$lib/modules/gifts/gifts.remote.js';
	import { getWishlistByShortId } from '$lib/modules/wishlists/wishlists.remote.js';
	import {
		getChatAvailability,
		getChatSession,
		getChatSessions,
		setChatSessionFastForward,
		startChatSession,
	} from '$lib/modules/chat/chat.remote.js';
	import {
		ASSISTANT_PANEL_WIDTH,
		ASSISTANT_SHEET,
		ASSISTANT_VIEW,
		CHAT_SELECTION,
		type useAssistant,
	} from '$lib/modules/chat/assistant.context.svelte.js';
	import type { useAssistantDock } from '$lib/modules/chat/assistant_dock.context.svelte.js';
	import {
		CHAT_ITEM,
		chatThreadItems,
		isChatTurnUnfinished,
		latestChatProposalId,
		startLiveChatTurn,
		withStreamEvent,
		type LiveChatTurn,
	} from '$lib/modules/chat/chat_thread.js';
	import { streamChatTurn } from '$lib/modules/chat/chat_turn_stream.js';
	import {
		CHAT_AVAILABILITY,
		CHAT_STREAM_EVENT,
		CHAT_TURN_ERROR,
		CHAT_TURN_KIND,
		type ChatAvailability,
		type ChatStreamEvent,
		type ChatTurnRequest,
	} from '$lib/modules/chat/types.js';
	import { StateRaw } from '$lib/reactivity/state.svelte.js';
	import AssistantHeader from './AssistantHeader.svelte';
	import ChatComposer from './ChatComposer.svelte';
	import ChatHistory from './ChatHistory.svelte';
	import ChatParts from './ChatParts.svelte';
	import ChatProposal from './ChatProposal.svelte';
	import type { DecisionBarControls } from './chat_presentation.js';

	const RESIZE_STEP = 20;

	/**
	 * The AI assistant for one wishlist: a docked, resizable panel on desktop and a half or full
	 * height sheet on mobile. It stays mounted while closed so an answer keeps streaming.
	 */
	let {
		assistant,
		dock,
		wishlistShortId,
		wishlistTitle,
		availability,
		mobile,
		rowContext,
	}: {
		assistant: ReturnType<typeof useAssistant>;
		dock: ReturnType<typeof useAssistantDock>;
		wishlistShortId: string;
		wishlistTitle: string;
		availability: ChatAvailability;
		mobile: boolean;
		rowContext: Omit<ChangeRowContext, 'submitterName' | 'kindTitle'>;
	} = $props();

	const decisionBar = new StateRaw<DecisionBarControls | null>(null);
	let panel = $state<HTMLElement>();
	let thread = $state<HTMLElement>();
	let composer = $state<HTMLTextAreaElement>();
	let liveTurn = $state.raw<LiveChatTurn | null>(null);
	let streaming = $state(false);
	let abortTurn: AbortController | null = null;
	let creatingSession = $state(false);
	let footerHeight = $state(0);

	const open = $derived(assistant.open.current);
	const view = $derived(assistant.view.current);
	const sheet = $derived(assistant.sheet.current);
	const modal = $derived(open && mobile && sheet === ASSISTANT_SHEET.full);
	const available = $derived(availability === CHAT_AVAILABILITY.available);
	const sessionsQuery = $derived(getChatSessions({ wishlistShortId }));
	const sessionId = $derived.by(() => {
		const selection = assistant.selection.current;
		switch (selection.type) {
			case CHAT_SELECTION.session:
				return selection.sessionId;
			case CHAT_SELECTION.new:
				return null;
			case CHAT_SELECTION.latest:
				return sessionsQuery.current?.[0]?.id ?? null;
		}
	});
	const resolvingLatest = $derived(
		assistant.selection.current.type === CHAT_SELECTION.latest &&
			sessionsQuery.current === undefined &&
			sessionsQuery.error === undefined,
	);
	const sessionQuery = $derived(sessionId === null ? null : getChatSession({ sessionId }));
	const messages = $derived(sessionQuery?.current?.messages ?? []);
	const items = $derived(chatThreadItems(messages));
	const fastForward = $derived(sessionQuery?.current?.fastForward ?? false);
	const latestProposalId = $derived(latestChatProposalId(messages));
	const unfinished = $derived(!streaming && liveTurn === null && isChatTurnUnfinished(messages));
	const width = $derived(assistant.panelWidth.current);
	const maxWidth = $derived(assistant.maxWidth.current);
	const starters = [
		{ icon: ImageIcon, label: m.chat_starter_enrich, prompt: m.chat_starter_enrich_prompt },
		{ icon: LinkIcon, label: m.chat_starter_add, prompt: m.chat_starter_add_prompt },
		{ icon: ListIcon, label: m.chat_starter_bulk, prompt: m.chat_starter_bulk_prompt },
	];

	/** The handle sits on the left edge, so dragging left widens the panel. */
	function startResize(event: PointerEvent) {
		if (event.button !== 0) {
			return;
		}
		const handle = event.currentTarget;
		if (!(handle instanceof HTMLElement)) {
			return;
		}
		event.preventDefault();
		const startX = event.clientX;
		const startWidth = width;
		handle.setPointerCapture(event.pointerId);
		const move = (moveEvent: PointerEvent) =>
			assistant.resize(startWidth + startX - moveEvent.clientX);
		const end = () => {
			handle.removeEventListener('pointermove', move);
			handle.removeEventListener('pointerup', end);
			handle.removeEventListener('pointercancel', end);
		};
		handle.addEventListener('pointermove', move);
		handle.addEventListener('pointerup', end);
		handle.addEventListener('pointercancel', end);
	}

	function resizeByKey(event: KeyboardEvent) {
		const steps: Record<string, number> = {
			ArrowLeft: RESIZE_STEP,
			ArrowRight: -RESIZE_STEP,
			Home: ASSISTANT_PANEL_WIDTH.min - width,
			End: maxWidth - width,
		};
		const step = steps[event.key];
		if (step !== undefined) {
			event.preventDefault();
			assistant.resize(width + step);
		}
	}

	function onpanelkeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && !event.defaultPrevented) {
			event.preventDefault();
			void assistant.close();
		}
	}

	async function scrollThreadToEnd() {
		await tick();
		thread?.scrollTo({ top: thread.scrollHeight });
	}

	/** A new chat is stored only once it is used, so empty chats never reach the history. */
	async function ensureSession(): Promise<string | null> {
		if (sessionId !== null) {
			return sessionId;
		}
		creatingSession = true;
		try {
			const created = await startChatSession({ wishlistShortId });
			assistant.selection.current = { type: CHAT_SELECTION.session, sessionId: created.id };
			return created.id;
		} catch (error) {
			toastError(translateServerError(error, m.chat_start_error()));
			return null;
		} finally {
			creatingSession = false;
		}
	}

	/** The list and the pending banner follow what the assistant did. */
	function followStreamEvent(event: ChatStreamEvent) {
		if (event.type !== CHAT_STREAM_EVENT.proposal) {
			return;
		}
		void getPendingChangeProposals({ wishlistShortId }).refresh();
		if (event.applied) {
			void getGiftsByWishlistShortId(wishlistShortId).refresh();
			void getWishlistByShortId(wishlistShortId).refresh();
		}
	}

	async function runTurn(request: ChatTurnRequest) {
		const turnSessionId = await ensureSession();
		if (turnSessionId === null) {
			return;
		}
		const userText = request.kind === CHAT_TURN_KIND.message ? request.text : null;
		let turn = startLiveChatTurn(userText);
		liveTurn = turn;
		streaming = true;
		const controller = new AbortController();
		abortTurn = controller;
		void scrollThreadToEnd();
		try {
			const refusal = await streamChatTurn({
				url: localizeInternalHref(
					resolve('/chat/[sessionId]/turns', { sessionId: turnSessionId }),
				),
				request,
				signal: controller.signal,
				onEvent: (event) => {
					turn = withStreamEvent(turn, event);
					liveTurn = turn;
					followStreamEvent(event);
				},
			});
			if (refusal !== null) {
				// Nothing was stored, so the message goes back to the composer.
				assistant.draft.current = userText ?? assistant.draft.current;
				toastError(m.chat_error_title());
			}
		} catch {
			if (!controller.signal.aborted) {
				liveTurn = { ...turn, error: CHAT_TURN_ERROR.providerFailed };
			}
		} finally {
			streaming = false;
			abortTurn = null;
		}
		await Promise.allSettled([
			getChatSession({ sessionId: turnSessionId }).refresh(),
			getChatSessions({ wishlistShortId }).refresh(),
			getChatAvailability().refresh(),
		]);
		liveTurn = null;
		void scrollThreadToEnd();
	}

	function send(text: string) {
		assistant.draft.current = '';
		void runTurn({ kind: CHAT_TURN_KIND.message, text });
	}

	function stop() {
		abortTurn?.abort();
	}

	async function setFastForward(next: boolean) {
		const id = await ensureSession();
		if (id === null) {
			return;
		}
		try {
			await setChatSessionFastForward({ sessionId: id, fastForward: next });
		} catch (error) {
			toastError(translateServerError(error, m.chat_fast_forward_error()));
		}
	}

	async function useStarter(prompt: () => string) {
		assistant.draft.current = prompt();
		await tick();
		composer?.focus();
		composer?.setSelectionRange(composer.value.length, composer.value.length);
	}

	/** Toasts are portalled to the body, so the open panel publishes the space they must clear. */
	$effect(() => {
		const rootStyle = document.documentElement.style;
		rootStyle.setProperty('--assistant-toast-right', open && !mobile ? `${width}px` : '0px');
		rootStyle.setProperty(
			'--assistant-toast-bottom',
			open && mobile ? `${footerHeight}px` : '0px',
		);
		return () => {
			rootStyle.removeProperty('--assistant-toast-right');
			rootStyle.removeProperty('--assistant-toast-bottom');
		};
	});

	$effect(() => {
		dock.modal.current = modal;
		return () => {
			dock.modal.current = false;
		};
	});

	$effect(() => {
		if (open) {
			void tick().then(() => (composer ?? panel)?.focus());
		}
	});

	/** A prompt queued from the gift menu goes out once its new chat is showing. */
	$effect(() => {
		const prompt = assistant.queuedPrompt.current;
		if (prompt === null || !open || streaming || creatingSession || !available) {
			return;
		}
		assistant.queuedPrompt.current = null;
		void runTurn({ kind: CHAT_TURN_KIND.message, text: prompt });
	});
</script>

{#snippet proposal(proposalId: string)}
	<ChatProposal
		{proposalId}
		{wishlistShortId}
		{rowContext}
		inBar={proposalId === latestProposalId && !fastForward}
		{decisionBar}
	/>
{/snippet}

{#snippet statusLine()}
	{#if availability === CHAT_AVAILABILITY.dailyCapReached}
		<p class="status-line" role="status">
			<ClockIcon aria-hidden="true" />{m.chat_cap_reached()}
		</p>
	{:else if availability === CHAT_AVAILABILITY.disabled}
		<p class="status-line" role="status">
			<PowerIcon aria-hidden="true" />{m.chat_disabled()}
		</p>
	{/if}
{/snippet}

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<aside
	id="assistant-panel"
	class="panel"
	data-sheet={mobile ? sheet : undefined}
	data-testid="assistant-panel"
	hidden={!open}
	inert={!open}
	role={modal ? 'dialog' : 'complementary'}
	aria-modal={modal ? 'true' : undefined}
	aria-labelledby="assistant-title"
	tabindex="-1"
	style:--assistant-width="{width}px"
	bind:this={panel}
	onkeydown={onpanelkeydown}
>
	{#if mobile}
		<button
			type="button"
			class="grabber"
			aria-label={sheet === ASSISTANT_SHEET.half
				? m.chat_sheet_expand()
				: m.chat_sheet_collapse()}
			onclick={() =>
				(assistant.sheet.current =
					sheet === ASSISTANT_SHEET.half ? ASSISTANT_SHEET.full : ASSISTANT_SHEET.half)}
		></button>
	{:else}
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<div
			class="resize-handle"
			role="separator"
			tabindex="0"
			aria-orientation="vertical"
			aria-label={m.chat_resize_label()}
			aria-valuemin={ASSISTANT_PANEL_WIDTH.min}
			aria-valuemax={maxWidth}
			aria-valuenow={width}
			title={m.chat_resize_title()}
			data-testid="assistant-resize"
			onpointerdown={startResize}
			onkeydown={resizeByKey}
			ondblclick={() => assistant.resize(ASSISTANT_PANEL_WIDTH.default)}
		></div>
	{/if}
	<AssistantHeader
		{wishlistTitle}
		{view}
		{mobile}
		{sheet}
		{availability}
		{fastForward}
		hintDismissed={assistant.hintDismissed.current}
		onclose={() => void assistant.close()}
		onview={(next) => (assistant.view.current = next)}
		onnew={() => assistant.startNewChat()}
		onfastforward={(next) => void setFastForward(next)}
		ondismisshint={() => (assistant.hintDismissed.current = true)}
		onsheet={(next) => (assistant.sheet.current = next)}
	/>
	<div
		class="thread"
		tabindex="-1"
		aria-label={view === ASSISTANT_VIEW.history
			? m.chat_history_title()
			: m.chat_thread_label()}
		data-testid="assistant-thread"
		bind:this={thread}
	>
		{#if view === ASSISTANT_VIEW.history}
			<ChatHistory
				sessions={sessionsQuery.current}
				activeSessionId={sessionId}
				canStartNew={available}
				onopen={(id) => {
					assistant.selection.current = { type: CHAT_SELECTION.session, sessionId: id };
					assistant.view.current = ASSISTANT_VIEW.chat;
				}}
				onnew={() => assistant.startNewChat()}
			/>
		{:else if sessionQuery?.error}
			<p class="note" role="alert">{m.chat_load_error()}</p>
		{:else if resolvingLatest || (sessionQuery !== null && sessionQuery.current === undefined)}
			<p class="note" aria-busy="true">{m.chat_history_loading()}</p>
		{:else}
			{#if items.length === 0 && liveTurn === null}
				<div class="welcome">
					<p class="welcome-title">{m.chat_welcome()}</p>
					{#if available}
						<div class="starters">
							{#each starters as starter (starter.label)}
								<button
									type="button"
									class="starter"
									onclick={() => void useStarter(starter.prompt)}
								>
									<span class="starter-icon" aria-hidden="true"
										><starter.icon /></span
									>
									<span>{starter.label()}</span>
									<ChevronRightIcon aria-hidden="true" />
								</button>
							{/each}
						</div>
					{/if}
				</div>
			{/if}
			{#each items as item (item.id)}
				{#if item.type === CHAT_ITEM.user}
					<p class="bubble">{item.text}</p>
				{:else}
					<ChatParts parts={item.parts} {proposal} />
				{/if}
			{/each}
			{#if liveTurn !== null}
				{#if liveTurn.userText !== null}
					<p class="bubble">{liveTurn.userText}</p>
				{/if}
				<ChatParts parts={liveTurn.parts} live={streaming} {proposal} />
			{/if}
			{#if unfinished || liveTurn?.error}
				<div class="turn-error" role="group" aria-labelledby="assistant-turn-error">
					<TriangleAlertIcon aria-hidden="true" />
					<p class="turn-error-title" id="assistant-turn-error">{m.chat_error_title()}</p>
					{#if liveTurn?.proposed !== true}
						<p class="turn-error-body">{m.chat_error_nothing_changed()}</p>
					{/if}
					{#if unfinished && available}
						<div>
							<Button
								intent="secondary"
								size="sm"
								data-testid="assistant-retry"
								onclick={() => void runTurn({ kind: CHAT_TURN_KIND.retry })}
							>
								<RefreshCwIcon data-icon="inline-start" />{m.chat_retry()}
							</Button>
						</div>
					{/if}
				</div>
			{/if}
		{/if}
	</div>
	{#if view === ASSISTANT_VIEW.chat}
		<footer class="foot" bind:offsetHeight={footerHeight}>
			{#if decisionBar.current !== null && !fastForward}
				<section class="decision-bar" aria-label={m.chat_decision_bar_label()}>
					{@render decisionBar.current.render()}
				</section>
			{/if}
			{@render statusLine()}
			<ChatComposer
				bind:value={assistant.draft.current}
				bind:textarea={composer}
				streaming={streaming || creatingSession}
				disabled={!available}
				onsend={send}
				onstop={stop}
			/>
		</footer>
	{/if}
</aside>

<style>
	.panel {
		position: relative;
		display: flex;
		flex: none;
		flex-direction: column;
		width: var(--assistant-width);
		min-height: 0;
		border-left: 2.5px solid var(--ink);
		background: var(--background);
	}

	.panel[hidden] {
		display: none;
	}

	.resize-handle {
		position: absolute;
		inset-block: 0;
		left: -6px;
		z-index: 1;
		width: 10px;
		cursor: ew-resize;
		touch-action: none;
	}

	.resize-handle:hover,
	.resize-handle:focus-visible {
		background: color-mix(in oklab, var(--ring) 35%, transparent);
		outline: none;
	}

	.thread {
		display: grid;
		flex: 1;
		align-content: start;
		gap: var(--space-3);
		min-height: 0;
		padding: var(--space-4);
		overflow: hidden auto;
		overscroll-behavior: contain;
	}

	.thread:focus-visible {
		outline: 2px solid var(--ring);
		outline-offset: -2px;
	}

	.note {
		color: var(--muted-foreground);
		font-size: var(--text-md);
	}

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
		border-radius: 12px;
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

	.bubble {
		justify-self: end;
		max-width: 85%;
		padding: var(--space-2) var(--space-3);
		border: 2px solid var(--ink);
		border-radius: 12px 12px 4px;
		background: var(--tint);
		font-size: var(--text-md);
		line-height: 1.5;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}

	.turn-error {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: 4px var(--space-2);
		padding: var(--space-3);
		border: 2px solid color-mix(in oklab, var(--status-danger) 60%, var(--ink));
		border-radius: 12px;
		background: color-mix(in oklab, var(--status-danger) 12%, var(--card));
		font-size: var(--text-md);
	}

	.turn-error > :global(svg) {
		width: 16px;
		height: 16px;
		margin-top: 2px;
		color: var(--status-danger-text);
	}

	.turn-error-title {
		font-weight: 700;
	}

	.turn-error > :not(:first-child, .turn-error-title) {
		grid-column: 2;
	}

	.foot {
		display: grid;
		gap: var(--space-2);
		padding: var(--space-3);
		border-top: 2px solid var(--ink);
		background: var(--card);
	}

	.decision-bar {
		padding-bottom: var(--space-2);
		border-bottom: 1px solid var(--border);
	}

	.status-line {
		display: flex;
		align-items: center;
		gap: 6px;
		color: var(--muted-foreground);
		font-size: var(--text-sm);
		font-weight: 600;
	}

	.status-line :global(svg) {
		flex: none;
		width: 14px;
		height: 14px;
	}

	.grabber {
		align-self: center;
		width: 48px;
		height: 20px;
		margin-top: 4px;
		border: 0;
		background: none;
		cursor: pointer;
	}

	.grabber::before {
		display: block;
		width: 40px;
		height: 5px;
		margin: auto;
		border-radius: 3px;
		background: var(--muted-foreground);
		content: '';
	}

	/* Mobile: a sheet over the page, half height while deciding and full height for reading. */
	@media (width < 640px) {
		.panel {
			position: fixed;
			inset-inline: 0;
			bottom: 0;
			z-index: var(--z-overlay);
			width: auto;
			height: calc(100dvh - var(--space-12));
			border-top: 2.5px solid var(--ink);
			border-left: 0;
			border-radius: var(--radius-panel) var(--radius-panel) 0 0;
			box-shadow: var(--elevation-ordinary);
		}

		.panel[data-sheet='half'] {
			height: 50dvh;
		}

		.thread {
			padding: var(--space-3);
		}
	}
</style>
