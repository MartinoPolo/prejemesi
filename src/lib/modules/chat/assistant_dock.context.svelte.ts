import { createContext, type Snippet } from 'svelte';
import { StateRaw } from '$lib/reactivity/state.svelte.js';

type AssistantDockContext = ReturnType<typeof createAssistantDockContext>;

const [useAssistantDock, setAssistantDockInternal] = createContext<AssistantDockContext>();
export { useAssistantDock };

/** The app layout docks a page's assistant panel beside the scrolling content, so it pushes it. */
export function setAssistantDockContext() {
	const context = createAssistantDockContext();
	setAssistantDockInternal(context);
	return context;
}

function createAssistantDockContext() {
	const panel = new StateRaw<Snippet | null>(null);
	/** The mobile sheet at full height is modal: the page behind it is inert. */
	const modal = new StateRaw(false);
	return { panel, modal };
}
