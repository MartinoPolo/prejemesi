<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/base/button/index.js';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import ChevronUpIcon from '@lucide/svelte/icons/chevron-up';
	import { cn } from '$lib/utils.js';
	import { formatAppendDate } from '$lib/modules/gifts/gift_display.js';
	import GiftEditedBadge from './GiftEditedBadge.svelte';
	import type { DescriptionAppend } from '$lib/modules/gifts/types.js';

	interface GiftDescriptionProps {
		description: string | null;
		descriptionAppends: DescriptionAppend[];
		maxVisibleAppends?: number | null;
		showAppends?: boolean;
		/**
		 * Anchors the „Upraveno po sdílení" badge to the description/append content
		 * instead of floating near the title (issue #165 REQ-2): it becomes the
		 * header of the most recent append, or — when a post-share edit carried no
		 * new append text (e.g. a price-only change) — the header of an otherwise
		 * text-free update strip. Null (default): no badge, existing card/list/edit
		 * form usages are unaffected.
		 */
		editedAfterShareAt?: Date | null;
		descriptionClass?: string;
		class?: string;
	}

	let {
		description,
		descriptionAppends,
		maxVisibleAppends = null,
		showAppends = true,
		editedAfterShareAt = null,
		descriptionClass = '',
		class: className = '',
	}: GiftDescriptionProps = $props();

	let showAllAppends = $state(false);

	const hasBase = $derived((description ?? '').trim() !== '');
	const hasAppends = $derived(showAppends && descriptionAppends.length > 0);
	// REQ-2 edge case: edited after share with no description append at all.
	const hasEditedStrip = $derived(editedAfterShareAt !== null && !hasAppends);
	const hasContent = $derived(hasBase || hasAppends || hasEditedStrip);
	const latestAppendIndex = $derived(descriptionAppends.length - 1);
	const visibleAppendItems = $derived.by(() => {
		if (maxVisibleAppends === null || showAllAppends) {
			return showAppends
				? descriptionAppends.map((append, index) => ({ append, index }))
				: [];
		}
		if (maxVisibleAppends <= 0) {
			return [];
		}
		const startIndex = Math.max(0, descriptionAppends.length - maxVisibleAppends);
		return descriptionAppends
			.slice(startIndex)
			.map((append, offset) => ({ append, index: startIndex + offset }));
	});
	const collapsedHiddenAppendCount = $derived(
		!showAppends || maxVisibleAppends === null
			? 0
			: Math.max(0, descriptionAppends.length - Math.max(0, maxVisibleAppends)),
	);
	const canToggleAppends = $derived(collapsedHiddenAppendCount > 0);

	function toggleAppendHistory(event: MouseEvent) {
		event.stopPropagation();
		showAllAppends = !showAllAppends;
	}
</script>

{#if hasContent}
	<div class={cn('flex flex-col gap-1.5', className)}>
		{#if hasBase}
			<p class={cn('whitespace-pre-line text-sm text-muted-foreground', descriptionClass)}>
				{description}
			</p>
		{/if}
		{#each visibleAppendItems as item (`${item.append.addedAt}:${item.index}`)}
			<!-- Post-share append (issue #102, `anime-gift-detail-modal.html` desc-append):
			     immutable note on an accent-tinted block with the timestamp. The most
			     recent append additionally hosts the „Upraveno po sdílení" badge as its
			     header row instead of a bare date (issue #165 REQ-2). -->
			<div
				class="rounded-r-[10px] border-l-4 border-accent-loud bg-[color-mix(in_oklab,var(--accent-loud)_16%,var(--card))] px-3 py-1.5 text-sm whitespace-pre-line text-foreground"
			>
				{#if editedAfterShareAt !== null && item.index === latestAppendIndex}
					<div class="mb-1 flex flex-wrap items-center gap-2">
						<GiftEditedBadge {editedAfterShareAt} />
						<span class="text-xs font-semibold text-ink-soft">
							{m.gift_description_append_date({
								date: formatAppendDate(item.append.addedAt),
							})}
						</span>
					</div>
				{:else}
					<span class="text-xs font-bold text-ink-soft"
						>{formatAppendDate(item.append.addedAt)}</span
					>
					<br />
				{/if}
				{item.append.text}
			</div>
		{/each}
		{#if hasEditedStrip && editedAfterShareAt !== null}
			<!-- REQ-2 edge case: edited after share with no description append (e.g. a
			     price-only change) – the badge still anchors inside the content flow,
			     never beside the title. -->
			<div
				class="rounded-r-[10px] border-l-4 border-accent-loud bg-[color-mix(in_oklab,var(--accent-loud)_16%,var(--card))] px-3 py-1.5 text-sm text-foreground"
			>
				<div class="flex flex-wrap items-center gap-2">
					<GiftEditedBadge {editedAfterShareAt} />
					<span class="text-xs font-semibold text-ink-soft">
						{m.gift_description_append_date({
							date: formatAppendDate(editedAfterShareAt.toISOString()),
						})}
					</span>
				</div>
			</div>
		{/if}
		{#if canToggleAppends}
			<Button
				type="button"
				size="sm"
				intent="ghost"
				class="-ml-1.5 h-7 w-fit px-1.5 text-xs text-muted-foreground hover:text-foreground"
				aria-expanded={showAllAppends}
				onclick={toggleAppendHistory}
				onkeydown={(event: KeyboardEvent) => event.stopPropagation()}
			>
				{#if showAllAppends}
					<ChevronUpIcon data-icon="inline-start" />
					{m.gift_description_history_hide()}
				{:else}
					<ChevronDownIcon data-icon="inline-start" />
					{m.gift_description_history_show({ count: collapsedHiddenAppendCount })}
				{/if}
			</Button>
		{/if}
	</div>
{/if}
