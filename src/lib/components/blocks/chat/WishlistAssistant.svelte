<script lang="ts">
	import { untrack } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import type { ChangeRowContext } from '$lib/components/blocks/change-proposals/change_row_model.js';
	import { useAssistant } from '$lib/modules/chat/assistant.context.svelte.js';
	import { useAssistantDock } from '$lib/modules/chat/assistant_dock.context.svelte.js';
	import type { ChatAvailability } from '$lib/modules/chat/types.js';
	import AssistantFab from './AssistantFab.svelte';
	import AssistantPanel from './AssistantPanel.svelte';

	/**
	 * The assistant on a wishlist page: the floating button here, and the panel docked by the app
	 * layout beside the content. The panel mounts on first open and then stays.
	 */
	let {
		wishlistShortId,
		wishlistTitle,
		availability,
		rowContext,
	}: {
		wishlistShortId: string;
		wishlistTitle: string;
		availability: ChatAvailability;
		rowContext: Omit<ChangeRowContext, 'submitterName' | 'kindTitle'>;
	} = $props();

	const assistant = useAssistant();
	const dock = useAssistantDock();
	const mobile = new MediaQuery('(width < 640px)');

	$effect(() => {
		if (assistant.open.current && untrack(() => dock.panel.current) !== panel) {
			dock.panel.current = panel;
		}
	});

	$effect(() => () => {
		dock.panel.current = null;
	});
</script>

{#snippet panel()}
	<AssistantPanel
		{assistant}
		{dock}
		{wishlistShortId}
		{wishlistTitle}
		{availability}
		mobile={mobile.current}
		{rowContext}
	/>
{/snippet}

<AssistantFab
	open={assistant.open.current}
	mobile={mobile.current}
	panelWidth={assistant.panelWidth.current}
	ontoggle={() => (assistant.open.current ? void assistant.close() : assistant.show())}
/>
