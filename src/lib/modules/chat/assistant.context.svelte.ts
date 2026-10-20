import { createContext, tick } from 'svelte';
import { innerWidth } from 'svelte/reactivity/window';
import { Derived } from '$lib/reactivity/derived.svelte.js';
import { StateRaw } from '$lib/reactivity/state.svelte.js';
import { Persisted, jsonSerde } from '$lib/reactivity/persisted.svelte.js';

export const ASSISTANT_PANEL_WIDTH = { min: 360, max: 640, default: 420 } as const;
/** The panel never takes more than half the viewport. */
const MAX_VIEWPORT_SHARE = 0.5;

export const ASSISTANT_VIEW = { chat: 'chat', history: 'history' } as const;
export type AssistantView = (typeof ASSISTANT_VIEW)[keyof typeof ASSISTANT_VIEW];

export const ASSISTANT_SHEET = { half: 'half', full: 'full' } as const;
export type AssistantSheet = (typeof ASSISTANT_SHEET)[keyof typeof ASSISTANT_SHEET];

export const CHAT_SELECTION = { latest: 'latest', new: 'new', session: 'session' } as const;

/** Which chat the panel shows: the newest one, a blank new chat, or a chosen one. */
type ChatSelection =
	| { type: typeof CHAT_SELECTION.latest }
	| { type: typeof CHAT_SELECTION.new }
	| { type: typeof CHAT_SELECTION.session; sessionId: string };

type AssistantContext = ReturnType<typeof createAssistantContext>;

const [useAssistant, setAssistantInternal] = createContext<AssistantContext>();
export { useAssistant };

export function setAssistantContext() {
	const context = createAssistantContext();
	setAssistantInternal(context);
	return context;
}

function isPanelWidth(value: unknown): value is number {
	return (
		typeof value === 'number' &&
		value >= ASSISTANT_PANEL_WIDTH.min &&
		value <= ASSISTANT_PANEL_WIDTH.max
	);
}

function isBoolean(value: unknown): value is boolean {
	return typeof value === 'boolean';
}

function createAssistantContext() {
	const open = new StateRaw(false);
	const view = new StateRaw<AssistantView>(ASSISTANT_VIEW.chat);
	const sheet = new StateRaw<AssistantSheet>(ASSISTANT_SHEET.full);
	const selection = new StateRaw<ChatSelection>({ type: CHAT_SELECTION.latest });
	/** Sent as soon as the panel has a chat to send it in, e.g. from the gift menu. */
	const queuedPrompt = new StateRaw<string | null>(null);
	/** Put in the composer for the user to finish, e.g. from a starter. */
	const draft = new StateRaw('');
	const width = new Persisted<number>({
		key: 'prejemesi-assistant-width',
		serde: jsonSerde(isPanelWidth),
		defaultValue: ASSISTANT_PANEL_WIDTH.default,
	});
	const hintDismissed = new Persisted<boolean>({
		key: 'prejemesi-assistant-hint-dismissed',
		serde: jsonSerde(isBoolean),
		defaultValue: false,
	});
	const maxWidth = new Derived(() =>
		Math.max(
			ASSISTANT_PANEL_WIDTH.min,
			Math.min(
				ASSISTANT_PANEL_WIDTH.max,
				Math.floor(
					(innerWidth.current ?? ASSISTANT_PANEL_WIDTH.max * 2) * MAX_VIEWPORT_SHARE,
				),
			),
		),
	);
	const panelWidth = new Derived(() => Math.min(width.current, maxWidth.current));
	let trigger: HTMLElement | null = null;

	function resize(next: number) {
		width.current = Math.round(
			Math.min(maxWidth.current, Math.max(ASSISTANT_PANEL_WIDTH.min, next)),
		);
	}

	function show() {
		if (!open.current) {
			trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		}
		view.current = ASSISTANT_VIEW.chat;
		sheet.current = ASSISTANT_SHEET.full;
		open.current = true;
	}

	/** Escape and ✕ return focus to whatever opened the panel. */
	async function close() {
		open.current = false;
		await tick();
		trigger?.focus();
		trigger = null;
	}

	function startNewChat(prompt: string | null = null) {
		selection.current = { type: CHAT_SELECTION.new };
		queuedPrompt.current = prompt;
		draft.current = '';
		show();
	}

	return {
		open,
		view,
		sheet,
		selection,
		queuedPrompt,
		draft,
		maxWidth,
		panelWidth,
		hintDismissed,
		show,
		close,
		resize,
		startNewChat,
	};
}
