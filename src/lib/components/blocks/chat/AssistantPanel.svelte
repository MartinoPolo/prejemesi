<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import ClockIcon from '@lucide/svelte/icons/clock';
	import PowerIcon from '@lucide/svelte/icons/power';
	import CircleAlertIcon from '@lucide/svelte/icons/circle-alert';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import * as Alert from '$lib/components/base/alert/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { toastError } from '$lib/components/base/toast/index.js';
	import type { ChangeRowContext } from '$lib/components/blocks/change-proposals/change_row_model.js';
	import { localizeInternalHref } from '$lib/i18n/locale.js';
	import { translateServerError } from '$lib/modules/errors/translate_server_error.js';
	import {
		CHANGE_PROPOSAL_STATE,
		getChangeProposal,
		getPendingChangeProposals,
	} from '$lib/modules/change_proposals/index.js';
	import { getGiftsByWishlistShortId } from '$lib/modules/gifts/gifts.remote.js';
	import { getWishlistByShortId } from '$lib/modules/wishlists/wishlists.remote.js';
	import {
		getChatAvailability,
		getChatRunnerEnabled,
		getChatSession,
		getChatSessions,
		setChatSessionFastForward,
		startChatSession,
		stopChatTurn,
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
		CHAT_PART,
		CHAT_PROPOSAL_STATUS,
		chatThreadItems,
		continuedAnswerParts,
		decisionBarProposalId,
		isChatTurnUnfinished,
		startLiveChatTurn,
		withStreamEvent,
		type ChatProposalStatus,
		type LiveChatTurn,
	} from '$lib/modules/chat/chat_thread.js';
	import {
		followChatTurn,
		streamChatTurn,
		type ChatTurnRefusal,
	} from '$lib/modules/chat/chat_turn_stream.js';
	import {
		CHAT_AVAILABILITY,
		CHAT_STREAM_EVENT,
		CHAT_TURN_ERROR,
		CHAT_TURN_KIND,
		type ChatAvailability,
		type ChatStreamEvent,
		type ChatTurnError as ChatTurnErrorKind,
		type ChatTurnRequest,
	} from '$lib/modules/chat/types.js';
	import { keepFocusOnPress, keyboardInset } from '$lib/reactivity/keyboard_inset.svelte.js';
	import { StateRaw } from '$lib/reactivity/state.svelte.js';
	import AssistantHeader from './AssistantHeader.svelte';
	import ChatComposer from './ChatComposer.svelte';
	import ChatDemoActions from './ChatDemoActions.svelte';
	import ChatHistory from './ChatHistory.svelte';
	import ChatNote from './ChatNote.svelte';
	import ChatParts from './ChatParts.svelte';
	import ChatProposal from './ChatProposal.svelte';
	import ChatRunnerSettings from './ChatRunnerSettings.svelte';
	import type { DecidingProposalRegistry } from '$lib/components/blocks/change-proposals/gift_live_preview.js';
	import ChatTurnError from './ChatTurnError.svelte';
	import ChatWelcome from './ChatWelcome.svelte';
	import {
		CHAT_STARTERS,
		composerMaxLines,
		type DecisionBarControls,
	} from './chat_presentation.js';

	const RESIZE_STEP = 20;
	/** Below this height above the keyboard, decorative spacing goes first. */
	const TIGHT_VISIBLE_HEIGHT = 330;
	/** How close to the end the thread counts as following the latest message. */
	const THREAD_END_TOLERANCE = 24;
	/** How often and how long a stopped answer is awaited in the stored chat. */
	const STOPPED_ANSWER_CHECKS = 5;
	const STOPPED_ANSWER_CHECK_MS = 300;

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
		decidingProposals,
	}: {
		assistant: ReturnType<typeof useAssistant>;
		dock: ReturnType<typeof useAssistantDock>;
		wishlistShortId: string;
		wishlistTitle: string;
		availability: ChatAvailability;
		mobile: boolean;
		rowContext: Omit<ChangeRowContext, 'submitterName' | 'kindTitle'>;
		decidingProposals: DecidingProposalRegistry;
	} = $props();

	const decisionBar = new StateRaw<DecisionBarControls | null>(null);
	let panel = $state<HTMLElement>();
	let thread = $state<HTMLElement>();
	let composer = $state<HTMLTextAreaElement>();
	let liveTurn = $state.raw<LiveChatTurn | null>(null);
	/** Why the chat's last turn failed, kept once the stored chat replaces the live turn. */
	let lastTurnFailure = $state.raw<{ sessionId: string; error: ChatTurnErrorKind } | null>(null);
	let streaming = $state(false);
	/** Stops the turn being streamed. */
	let stopShownTurn: (() => Promise<void>) | null = null;
	/** The unfinished turn the panel last rejoined, so a failed rejoin is not retried in a loop. */
	let rejoinedTurnUrl: string | null = null;
	let creatingSession = $state(false);
	let footerHeight = $state(0);
	let threadAtEnd = true;
	let toolsMenuOpen = $state(false);

	const open = $derived(assistant.open.current);
	/** The on-screen keyboard is open: the sheet sits on it and its chrome compacts. */
	const compact = $derived(mobile && keyboardInset.open);
	const view = $derived(assistant.view.current);
	const sheet = $derived(assistant.sheet.current);
	const modal = $derived(open && mobile && sheet === ASSISTANT_SHEET.full);
	const available = $derived(availability === CHAT_AVAILABILITY.available);
	const demo = $derived(availability === CHAT_AVAILABILITY.demo);
	const takesMessages = $derived(available || demo);
	const runnerEnabled = $derived(getChatRunnerEnabled().current === true);
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
	/**
	 * Only stored proposals take the bar: decisions made on a live turn's copy would be lost when
	 * the stored chat replaces it.
	 */
	const barProposalId = $derived(
		decisionBarProposalId({ messages, fastForward, proposalStatus: chatProposalStatus }),
	);

	function chatProposalStatus(proposalId: string): ChatProposalStatus {
		const proposalQuery = getChangeProposal({ wishlistShortId, proposalId });
		if (proposalQuery.current !== undefined) {
			return proposalQuery.current.state === CHANGE_PROPOSAL_STATE.pending
				? CHAT_PROPOSAL_STATUS.pending
				: CHAT_PROPOSAL_STATUS.unavailable;
		}
		return proposalQuery.error === undefined
			? CHAT_PROPOSAL_STATUS.loading
			: CHAT_PROPOSAL_STATUS.unavailable;
	}

	const sentTexts = $derived(
		new Set([
			...items.flatMap((item) => (item.type === CHAT_ITEM.user ? [item.text] : [])),
			...(liveTurn?.userText == null ? [] : [liveTurn.userText]),
		]),
	);
	/** A retried or rejoined turn has no message of its own, so it goes on with the answer shown last. */
	const continuedAnswer = $derived.by(() => {
		const last = items.at(-1);
		return liveTurn !== null && liveTurn.userText === null && last?.type === CHAT_ITEM.assistant
			? { id: last.id, parts: continuedAnswerParts(last.parts, liveTurn.parts) }
			: null;
	});
	/** A turn that went on while no panel showed it, such as across a reload. */
	const activeTurnUrl = $derived(sessionQuery?.current?.activeTurnUrl ?? null);
	const unfinished = $derived(
		!streaming && liveTurn === null && activeTurnUrl === null && isChatTurnUnfinished(messages),
	);
	/** A cut-off answer keeps its text, so its failure stays shown even with nothing to retry. */
	const shownTurnFailure = $derived(
		liveTurn === null && lastTurnFailure?.sessionId === sessionId
			? lastTurnFailure.error
			: null,
	);
	const width = $derived(assistant.panelWidth.current);
	const maxWidth = $derived(assistant.maxWidth.current);
	const loading = $derived(
		resolvingLatest || (sessionQuery !== null && sessionQuery.current === undefined),
	);
	const starterChips = $derived(
		compact &&
			available &&
			!loading &&
			items.length === 0 &&
			liveTurn === null &&
			assistant.draft.current.trim() === '',
	);

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
		// The menu keeps focus in the composer, so its Escape bubbles here before the menu's own
		// document-level handler closes it.
		if (event.key === 'Escape' && !event.defaultPrevented && !toolsMenuOpen) {
			event.preventDefault();
			void assistant.close();
		}
	}

	async function scrollThreadToEnd() {
		await tick();
		thread?.scrollTo({ top: thread.scrollHeight });
	}

	function onthreadscroll() {
		if (thread !== undefined) {
			threadAtEnd =
				thread.scrollHeight - thread.scrollTop - thread.clientHeight <=
				THREAD_END_TOLERANCE;
		}
	}

	/** Náhled shows the wishlist: the keyboard closes and the sheet shrinks to half height. */
	function showPreview() {
		composer?.blur();
		assistant.sheet.current = ASSISTANT_SHEET.half;
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

	/**
	 * A stopped model turn stores the text it streamed once the server notices the aborted stream,
	 * shortly after Stop; the live text stays until the stored chat shows it.
	 */
	async function waitForStoppedAnswer(turnSessionId: string) {
		for (
			let check = 0;
			check < STOPPED_ANSWER_CHECKS &&
			sessionId === turnSessionId &&
			isChatTurnUnfinished(messages);
			check += 1
		) {
			await new Promise((resolve) => setTimeout(resolve, STOPPED_ANSWER_CHECK_MS));
			await getChatSession({ sessionId: turnSessionId })
				.refresh()
				.catch(() => undefined);
		}
	}

	/**
	 * Shows one turn as it streams, then the stored chat it left. A runner turn names what its
	 * Stop asks the server to end; a model provider's turn ends with its stream.
	 */
	async function showTurn(
		turnSessionId: string,
		userText: string | null,
		stream: (
			signal: AbortSignal,
			onEvent: (event: ChatStreamEvent) => void,
		) => Promise<ChatTurnRefusal | null>,
		runnerStop: { turnId?: string } | null,
	) {
		let turn = startLiveChatTurn(userText);
		liveTurn = turn;
		lastTurnFailure = null;
		streaming = true;
		const controller = new AbortController();
		let stopped = false;
		// A browser going away does not end a runner turn, so Stop asks the server first; the
		// stream ends after it, and the chat refreshes once the turn has stopped. A Stop the
		// server refused leaves the turn running, so the panel keeps following it.
		stopShownTurn = async () => {
			stopped = true;
			if (runnerStop !== null) {
				try {
					await stopChatTurn({ sessionId: turnSessionId, ...runnerStop });
				} catch (error) {
					stopped = false;
					toastError(translateServerError(error, m.chat_stop_error()));
					return;
				}
			}
			controller.abort();
		};
		void scrollThreadToEnd();
		try {
			const refusal = await stream(controller.signal, (event) => {
				if (stopped && event.type === CHAT_STREAM_EVENT.error) {
					return;
				}
				turn = withStreamEvent(turn, event);
				liveTurn = turn;
				followStreamEvent(event);
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
			stopShownTurn = null;
		}
		const turnError = liveTurn?.error ?? null;
		await Promise.allSettled([
			getChatSession({ sessionId: turnSessionId }).refresh(),
			getChatSessions({ wishlistShortId }).refresh(),
			getChatAvailability().refresh(),
		]);
		if (stopped && turn.parts.some((part) => part.type === CHAT_PART.text)) {
			await waitForStoppedAnswer(turnSessionId);
		}
		lastTurnFailure =
			turnError === null ? null : { sessionId: turnSessionId, error: turnError };
		liveTurn = null;
		void scrollThreadToEnd();
	}

	async function runTurn(request: ChatTurnRequest) {
		const turnSessionId = await ensureSession();
		if (turnSessionId === null) {
			return;
		}
		// Awaited, because `runnerEnabled` may still be loading when the first message goes out.
		// Without the flag the turn still runs, but Stop only ends its stream and the panel then
		// rejoins it.
		const answeredByRunner = await getChatRunnerEnabled().catch(() => false);
		const runnerTurn = answeredByRunner
			? {
					turnId: crypto.randomUUID(),
					model: assistant.runnerModel.current,
					effort: assistant.runnerEffort.current,
				}
			: null;
		await showTurn(
			turnSessionId,
			request.kind === CHAT_TURN_KIND.message ? request.text : null,
			(signal, onEvent) =>
				streamChatTurn({
					url: localizeInternalHref(
						resolve('/chat/[sessionId]/turns', { sessionId: turnSessionId }),
					),
					request: runnerTurn === null ? request : { ...request, ...runnerTurn },
					signal,
					onEvent,
				}),
			runnerTurn === null ? null : { turnId: runnerTurn.turnId },
		);
	}

	function send(text: string) {
		assistant.draft.current = '';
		void runTurn({ kind: CHAT_TURN_KIND.message, text });
	}

	function stop() {
		void stopShownTurn?.();
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

	async function useStarter(prompt: string) {
		assistant.draft.current = prompt;
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

	/** A thread following its latest message keeps it visible as the keyboard resizes the sheet. */
	$effect(() => {
		if (thread === undefined) {
			return;
		}
		const observed = thread;
		const observer = new ResizeObserver(() => {
			if (threadAtEnd) {
				observed.scrollTo({ top: observed.scrollHeight });
			}
		});
		observer.observe(observed);
		return () => observer.disconnect();
	});

	$effect(() => {
		dock.modal.current = modal;
		return () => {
			dock.modal.current = false;
		};
	});

	$effect(() => {
		if (open && assistant.takeFocusRequest()) {
			void tick().then(() => (composer ?? panel)?.focus());
		}
	});

	/** A panel opened while its chat's turn goes on, such as after a reload, shows it streaming. */
	$effect(() => {
		if (
			sessionId === null ||
			activeTurnUrl === null ||
			activeTurnUrl === rejoinedTurnUrl ||
			streaming ||
			liveTurn !== null
		) {
			return;
		}
		const url = activeTurnUrl;
		const rejoinedSessionId = sessionId;
		rejoinedTurnUrl = url;
		untrack(() => {
			void showTurn(
				rejoinedSessionId,
				null,
				async (signal, onEvent) => {
					await followChatTurn({ url, signal, onEvent });
					return null;
				},
				{},
			);
		});
	});

	/** A prompt queued from the gift menu goes out once its new chat is showing. */
	$effect(() => {
		const prompt = assistant.queuedPrompt.current;
		if (prompt === null || !open || streaming || creatingSession || !takesMessages) {
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
		inBar={proposalId === barProposalId}
		{decisionBar}
		{decidingProposals}
	/>
{/snippet}

{#snippet statusLine()}
	{#if availability === CHAT_AVAILABILITY.dailyCapReached}
		<ChatNote role="status" emphasis>
			<ClockIcon aria-hidden="true" />{m.chat_cap_reached()}
		</ChatNote>
	{:else if availability === CHAT_AVAILABILITY.disabled}
		<ChatNote role="status" emphasis>
			<PowerIcon aria-hidden="true" />{m.chat_disabled()}
		</ChatNote>
	{/if}
{/snippet}

{#snippet edge()}
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
		<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
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
{/snippet}

{#snippet messageInput()}
	{#if demo}
		<ChatDemoActions
			{sentTexts}
			busy={streaming || creatingSession}
			onsend={(text) => void runTurn({ kind: CHAT_TURN_KIND.message, text })}
		/>
	{:else}
		<ChatComposer
			bind:value={assistant.draft.current}
			bind:textarea={composer}
			streaming={streaming || creatingSession}
			disabled={!available}
			maxLines={compact ? composerMaxLines(keyboardInset.visibleHeight) : undefined}
			onsend={send}
			onstop={stop}
		/>
	{/if}
{/snippet}

{#snippet starterChipRow()}
	<div class="chips" role="group" aria-label={m.chat_starters_label()}>
		{#each CHAT_STARTERS as starter (starter.label)}
			<button
				type="button"
				class="chip"
				data-testid="assistant-starter-chip"
				onpointerdown={keepFocusOnPress}
				onclick={() => void useStarter(starter.prompt())}
			>
				<starter.icon aria-hidden="true" />{starter.label()}
			</button>
		{/each}
	</div>
{/snippet}

{#snippet runnerSettings()}
	<ChatRunnerSettings
		model={assistant.runnerModel.current}
		effort={assistant.runnerEffort.current}
		onmodel={(model) => (assistant.runnerModel.current = model)}
		oneffort={(effort) => (assistant.runnerEffort.current = effort)}
	/>
{/snippet}

{#snippet conversation()}
	{#if items.length === 0 && liveTurn === null}
		<ChatWelcome
			{available}
			{demo}
			showStarters={!compact}
			onstarter={(prompt) => void useStarter(prompt)}
		/>
	{/if}
	{#each items as item (item.id)}
		{#if item.type === CHAT_ITEM.user}
			<p class="bubble">{item.text}</p>
		{:else if item.id === continuedAnswer?.id}
			<ChatParts parts={continuedAnswer.parts} live={streaming} {proposal} />
		{:else}
			<ChatParts parts={item.parts} {proposal} />
		{/if}
	{/each}
	{#if liveTurn !== null && continuedAnswer === null}
		{#if liveTurn.userText !== null}
			<p class="bubble">{liveTurn.userText}</p>
		{/if}
		<ChatParts parts={liveTurn.parts} live={streaming} {proposal} />
	{/if}
	{#if unfinished || liveTurn?.error != null || shownTurnFailure !== null}
		<ChatTurnError
			proposed={liveTurn?.proposed === true}
			error={liveTurn?.error ?? shownTurnFailure}
			onretry={unfinished && takesMessages
				? () => void runTurn({ kind: CHAT_TURN_KIND.retry })
				: undefined}
		/>
	{/if}
{/snippet}

<aside
	id="assistant-panel"
	class="panel"
	data-sheet={mobile ? sheet : undefined}
	data-compact={compact || undefined}
	data-space={compact && keyboardInset.visibleHeight < TIGHT_VISIBLE_HEIGHT ? 'tight' : undefined}
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
	{@render edge()}
	<AssistantHeader
		{wishlistTitle}
		{view}
		{mobile}
		{compact}
		{sheet}
		{availability}
		{fastForward}
		bind:toolsMenuOpen
		hintDismissed={assistant.hintDismissed.current}
		onpreview={showPreview}
		onclose={() => void assistant.close()}
		onview={(next) => (assistant.view.current = next)}
		onnew={() => assistant.startNewChat()}
		onfastforward={(next) => void setFastForward(next)}
		ondismisshint={() => (assistant.hintDismissed.current = true)}
		onsheet={(next) => (assistant.sheet.current = next)}
		runnerSettings={runnerEnabled ? runnerSettings : undefined}
	/>
	<div
		class="thread"
		tabindex="-1"
		aria-label={view === ASSISTANT_VIEW.history
			? m.chat_history_title()
			: m.chat_thread_label()}
		data-testid="assistant-thread"
		bind:this={thread}
		onscroll={onthreadscroll}
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
			<Alert.Root tone="danger">
				<CircleAlertIcon aria-hidden="true" />
				<Alert.Description>{m.chat_load_error()}</Alert.Description>
				<Alert.Action>
					<Button intent="outline" size="sm" onclick={() => void sessionQuery?.refresh()}>
						<RefreshCwIcon data-icon="inline-start" />{m.chat_retry()}
					</Button>
				</Alert.Action>
			</Alert.Root>
		{:else if loading}
			<p class="note" aria-busy="true">{m.chat_history_loading()}</p>
		{:else}
			{@render conversation()}
		{/if}
	</div>
	{#if view === ASSISTANT_VIEW.chat}
		<footer class="foot" bind:offsetHeight={footerHeight}>
			{#if decisionBar.current !== null && !fastForward}
				<section class="decision-bar" aria-label={m.chat_decision_bar_label()}>
					{@render decisionBar.current.render(compact)}
				</section>
			{/if}
			{#if starterChips}
				{@render starterChipRow()}
			{/if}
			{@render statusLine()}
			{@render messageInput()}
		</footer>
	{/if}
</aside>

<style>
	.panel {
		/* One corner for every card-like surface in the assistant. */
		--chat-surface-radius: 12px;

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

	.bubble {
		justify-self: end;
		max-width: 85%;
		padding: var(--space-2) var(--space-3);
		border: 2px solid var(--ink);
		border-radius: var(--chat-surface-radius) var(--chat-surface-radius) 4px;
		background: var(--tint);
		font-size: var(--text-md);
		line-height: 1.5;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
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

		.foot {
			padding-bottom: calc(var(--space-3) + env(safe-area-inset-bottom));
		}

		/* Keyboard open: either sheet fills the space above the keyboard, leaving a thin peek of
		   the page while space allows, and the composer sits flush on the keyboard. */
		.panel[data-compact] {
			--sheet-peek: 10px;

			bottom: var(--keyboard-inset);
			height: calc(var(--visual-viewport-height) - var(--sheet-peek));
		}

		.panel[data-space='tight'] {
			--sheet-peek: 0px;
		}

		.panel[data-compact] .grabber {
			display: none;
		}

		.panel[data-compact] .thread {
			gap: 10px;
			padding-block: 10px 12px;
		}

		.panel[data-space='tight'] .thread {
			gap: var(--space-2);
			padding-block: var(--space-2) 10px;
		}

		.panel[data-compact] .foot {
			gap: 6px;
			padding-block: 6px;
		}

		.panel[data-compact] .decision-bar {
			padding-bottom: 6px;
		}
	}

	@media (width < 640px) and (prefers-reduced-motion: no-preference) {
		.panel {
			transition:
				height var(--duration-normal) var(--ease-standard),
				bottom var(--duration-normal) var(--ease-standard);
		}
	}

	/* One horizontally scrolling row directly above the composer; the fade shows there is more. */
	.chips {
		display: flex;
		gap: var(--nested-control-gap);
		margin-inline: calc(-1 * var(--space-3));
		padding: 2px var(--space-3) 3px;
		overflow-x: auto;
		scrollbar-width: none;
		mask-image: linear-gradient(90deg, #000 calc(100% - 28px), transparent);
	}

	.chip {
		position: relative;
		display: inline-flex;
		flex: none;
		align-items: center;
		gap: 6px;
		height: 36px;
		padding: 0 var(--space-3) 0 10px;
		border: 2px solid var(--ink);
		border-radius: 999px;
		background: var(--card);
		box-shadow: var(--elevation-compact);
		color: var(--ink);
		font-size: var(--text-md);
		font-weight: 600;
		white-space: nowrap;
		cursor: pointer;
	}

	/* The hit target reaches 40px without changing the visible chip. */
	.chip::before {
		position: absolute;
		inset: -3px 0;
		content: '';
	}

	.chip:hover {
		background: var(--panel-hover);
	}

	.chip:focus-visible {
		outline: 2px solid var(--ring);
		outline-offset: 2px;
	}

	.chip :global(svg) {
		width: 14px;
		height: 14px;
		color: var(--brand-link);
	}
</style>
