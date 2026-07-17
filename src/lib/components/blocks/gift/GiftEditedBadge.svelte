<script lang="ts">
	import InfoIcon from '@lucide/svelte/icons/info';
	import { SimpleTooltip } from '$lib/components/base/tooltip/index.js';
	import * as m from '$lib/paraglide/messages.js';

	interface GiftEditedBadgeProps {
		editedAfterShareAt: Date | null;
		compact?: boolean;
		compactOnMobile?: boolean;
		/** Latest post-share update text; the compact control must expose the actual
			message, not just the badge label (#163 REQ-5), when the surface hides
			description appends (list rows). */
		updateText?: string | null;
	}

	let {
		editedAfterShareAt,
		compact = false,
		compactOnMobile = false,
		updateText = null,
	}: GiftEditedBadgeProps = $props();

	const compactMessage = $derived(
		updateText !== null && updateText.trim() !== ''
			? `${m.gift_edited_after_share_badge()}: ${updateText}`
			: m.gift_edited_after_share_badge(),
	);
</script>

<!-- Wrapper keeps the pill content-sized: as a direct flex item the inline-flex tag would
	otherwise stretch full-width in the card's column body (align-items: stretch). -->
{#if editedAfterShareAt !== null}
	<div class="flex">
		{#if compact || compactOnMobile}
			<!-- Compact list treatment: an actual focusable control exposes the full update message. -->
			<div class={compactOnMobile ? 'sm:hidden' : undefined}>
				<SimpleTooltip text={compactMessage} side="top">
					{#snippet asChild(triggerProps)}
						<button
							{...triggerProps}
							type="button"
							aria-label={compactMessage}
							class="inline-flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-tag-edited text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						>
							<InfoIcon class="size-3.5" aria-hidden="true" />
						</button>
					{/snippet}
				</SimpleTooltip>
			</div>
		{/if}
		{#if !compact}
			<!-- „Upraveno po sdílení" tag sticker (`anime-gift-detail-modal.html` .tag-edited) -->
			<span
				class={compactOnMobile
					? 'hidden w-fit rotate-1 items-center gap-1 rounded-full border-2 border-ink bg-tag-edited px-2.5 py-0.5 text-[11px] font-bold text-foreground sm:inline-flex'
					: 'inline-flex w-fit rotate-1 items-center gap-1 rounded-full border-2 border-ink bg-tag-edited px-2.5 py-0.5 text-[11px] font-bold text-foreground'}
			>
				<InfoIcon class="size-2.5" aria-hidden="true" />
				{m.gift_edited_after_share_badge()}
			</span>
		{/if}
	</div>
{/if}
