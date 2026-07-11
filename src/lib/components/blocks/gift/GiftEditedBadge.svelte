<script lang="ts">
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import * as m from '$lib/paraglide/messages.js';

	interface GiftEditedBadgeProps {
		editedAfterShareAt: Date | null;
	}

	let { editedAfterShareAt }: GiftEditedBadgeProps = $props();
</script>

<!-- Wrapper keeps the pill content-sized: as a direct flex item the inline-flex tag would
	otherwise stretch full-width in the card's column body (align-items: stretch). -->
{#if editedAfterShareAt !== null}
	<div class="flex">
		<!-- „Upraveno po sdílení" tag sticker (`anime-gift-detail-modal.html` .tag-edited) -->
		<span
			class="inline-flex w-fit rotate-1 items-center gap-1 rounded-full border-2 border-ink bg-tag-edited px-2.5 py-0.5 text-[11px] font-bold text-foreground"
		>
			<PencilIcon class="size-2.5" />
			{m.gift_edited_after_share_badge()}
		</span>
	</div>
{/if}
