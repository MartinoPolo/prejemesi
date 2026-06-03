<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import { normalizeGiftUrl, extractGiftUrlDomain } from '$lib/modules/gifts/gift_url.js';
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
	<span class="text-xs text-muted-foreground">{m.gift_link_none()}</span>
{:else}
	<div class="flex flex-col">
		{#each visibleLinks as link, index (index)}
			{@const safeUrl = normalizeGiftUrl(link.url)}
			{@const domain = extractGiftUrlDomain(link.url)}
			<a
				href={safeUrl ?? '#'}
				target="_blank"
				rel="external noopener noreferrer"
				class="flex items-center gap-1.5 border-b border-border/50 py-1 text-xs last:border-b-0 {index ===
				0
					? 'text-primary hover:text-primary hover:underline'
					: 'text-primary/80 hover:text-primary hover:underline'}"
				title={link.url}
				onclick={(e: MouseEvent) => e.stopPropagation()}
			>
				<ExternalLinkIcon class="size-3 flex-shrink-0" />
				<span class="truncate">{link.label ?? domain ?? link.url}</span>
			</a>
		{/each}
		{#if overflowCount > 0}
			<span class="py-1 text-xs text-muted-foreground"
				>{m.gift_link_overflow({ count: overflowCount })}</span
			>
		{/if}
	</div>
{/if}
