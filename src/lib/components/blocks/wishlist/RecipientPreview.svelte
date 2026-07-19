<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';

	interface RecipientPreviewProps {
		/** Live recipient name as typed; an empty value shows a muted placeholder. */
		name: string;
	}

	let { name }: RecipientPreviewProps = $props();

	const trimmed = $derived(name.trim());
</script>

<!-- Live echo of the wishlist header's „Pro: {name}" line (issue #150) so the user picks the
     right Czech name form before saving. Shares wishlist_header_for_prefix with WishlistHeader
     to stay in sync. The dashed muted frame reads as a preview, not a second label. -->
<div class="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2">
	<p class="text-sm">
		<span class="text-muted-foreground">{m.wishlist_header_for_prefix()}</span>
		{#if trimmed === ''}
			<span class="text-muted-foreground italic">
				{m.create_recipient_name_preview_example()}
			</span>
		{:else}
			<strong class="font-heading font-semibold text-foreground">{trimmed}</strong>
		{/if}
	</p>
</div>
