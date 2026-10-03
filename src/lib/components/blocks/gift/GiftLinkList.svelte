<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { normalizeGiftUrl, extractGiftUrlDomain } from '$lib/modules/gifts/gift_url.js';
	import { SimpleTooltip } from '$lib/components/base/tooltip/index.js';
	import { TextLink } from '$lib/components/base/text-link/index.js';
	import { giftLinkListVariants, type GiftLinkListDisplay } from './gift_link_list_variants.js';
	import type { GiftLink } from '$lib/modules/gifts/types.js';

	interface GiftLinkListProps {
		links: GiftLink[];
		maxVisible?: number;
		/** `chip` (default): inline links for card/list rows. `row`: stacked detail links with
		 *  touch-sized hit areas (issue #165). */
		display?: GiftLinkListDisplay;
	}

	let { links, maxVisible = 3, display = 'chip' }: GiftLinkListProps = $props();

	const visibleLinks = $derived(links.slice(0, maxVisible));
	const overflowCount = $derived(links.length - maxVisible);
	const styles = $derived(giftLinkListVariants({ display }));
</script>

{#if links.length === 0}
	<span class="text-xs text-muted-foreground italic">{m.gift_link_none()}</span>
{:else}
	<div class={styles.root()}>
		{#each visibleLinks as link, index (index)}
			{@const safeUrl = normalizeGiftUrl(link.url)}
			{@const domain = extractGiftUrlDomain(link.url)}
			<SimpleTooltip text={link.url} side="top">
				{#snippet asChild(triggerProps)}
					<TextLink
						{...triggerProps}
						href={safeUrl ?? '#'}
						external
						size={display === 'row' ? 'md' : 'sm'}
						onclick={(e: MouseEvent) => e.stopPropagation()}
					>
						{link.label ?? domain ?? link.url}
						{#if link.label && domain}
							<span class={styles.domain()}>({domain})</span>
						{/if}
					</TextLink>
				{/snippet}
			</SimpleTooltip>
		{/each}
		{#if overflowCount > 0}
			<span class={styles.overflow()}>{m.gift_link_overflow({ count: overflowCount })}</span>
		{/if}
	</div>
{/if}
