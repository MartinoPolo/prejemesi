<script lang="ts">
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import * as m from '$lib/paraglide/messages.js';
	import { giftImageEditEntryVariants } from './gift_image_edit_entry_variants.js';

	interface Props {
		/** Wide images widen the sticker into the labelled pill on hover or focus. */
		expandable?: boolean;
		disabled?: boolean;
		onclick: () => void;
	}

	let { expandable = false, disabled = false, onclick }: Props = $props();

	const styles = $derived(giftImageEditEntryVariants({ expandable }));
</script>

<button
	type="button"
	class={styles.root()}
	{disabled}
	{onclick}
	aria-label={m.gift_image_edit()}
	data-testid="gift-image-edit-entry"
>
	<span class={styles.scrim()} aria-hidden="true"></span>
	<span class={styles.stickerStack()} aria-hidden="true">
		<span class={styles.pill()} data-testid="gift-image-edit-pill">
			<PencilIcon />{m.gift_image_edit()}
		</span>
		<span class={styles.circle()}><PencilIcon /></span>
	</span>
</button>
