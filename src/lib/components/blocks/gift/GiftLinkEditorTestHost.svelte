<!-- Hosts GiftLinkEditor with its own links state, as GiftDetailForm owns them, so edits flow
     back into the editor. -->
<script lang="ts">
	import { untrack } from 'svelte';
	import GiftLinkEditor from './GiftLinkEditor.svelte';
	import { ensureGiftLinkIds } from '$lib/modules/gifts/gift_url.js';
	import type { GiftLink } from '$lib/modules/gifts/types.js';

	interface Props {
		initialLinks: GiftLink[];
		maxLinks?: number;
		disabled?: boolean;
		onlinkschange?: (links: GiftLink[]) => void;
	}

	let linkEditorProps: Props = $props();

	let links = $state(ensureGiftLinkIds(untrack(() => linkEditorProps.initialLinks)));
</script>

<GiftLinkEditor
	{links}
	maxLinks={linkEditorProps.maxLinks}
	disabled={linkEditorProps.disabled}
	onlinkschange={(updated) => {
		links = updated;
		linkEditorProps.onlinkschange?.(updated);
	}}
/>
