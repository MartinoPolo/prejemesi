<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import { normalizeGiftUrl, extractGiftUrlDomain } from '$lib/modules/gifts/gift_url.js';
	import { SimpleTooltip } from '$lib/components/base/tooltip/index.js';
	import type { GiftLink } from '$lib/modules/gifts/types.js';

	interface GiftLinkListProps {
		links: GiftLink[];
		maxVisible?: number;
	}

	let { links, maxVisible = 3 }: GiftLinkListProps = $props();

	const visibleLinks = $derived(links.slice(0, maxVisible));
	const overflowCount = $derived(links.length - maxVisible);
</script>

{#if links.length === 0}
	<span class="text-xs text-ink-soft italic">{m.gift_link_none()}</span>
{:else}
	<!-- Link tag chips (`anime-sky-final.html` .tag-link): ink pills tinted on hover. -->
	<div class="flex flex-wrap items-center gap-1.5">
		{#each visibleLinks as link, index (index)}
			{@const safeUrl = normalizeGiftUrl(link.url)}
			{@const domain = extractGiftUrlDomain(link.url)}
			<SimpleTooltip text={link.url} side="top">
				{#snippet asChild(triggerProps)}
					<a
						{...triggerProps}
						href={safeUrl ?? '#'}
						target="_blank"
						rel="external noopener noreferrer"
						class="inline-flex max-w-full items-center gap-1 rounded-full border-2 border-ink bg-card px-2.5 py-0.5 text-[11.5px] font-bold text-[color:var(--link)] no-underline transition-colors hover:bg-link-tint"
						onclick={(e: MouseEvent) => e.stopPropagation()}
					>
						<ExternalLinkIcon class="size-3 flex-shrink-0" />
						<span class="truncate">{link.label ?? domain ?? link.url}</span>
					</a>
				{/snippet}
			</SimpleTooltip>
		{/each}
		{#if overflowCount > 0}
			<span class="text-xs font-semibold text-ink-soft"
				>{m.gift_link_overflow({ count: overflowCount })}</span
			>
		{/if}
	</div>
{/if}
