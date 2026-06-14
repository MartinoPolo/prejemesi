<script lang="ts">
	import { cn } from '$lib/utils.js';
	import { formatAppendDate } from '$lib/modules/gifts/gift_display.js';
	import type { DescriptionAppend } from '$lib/modules/gifts/types.js';

	interface GiftDescriptionProps {
		description: string | null;
		descriptionAppends: DescriptionAppend[];
		class?: string;
	}

	let { description, descriptionAppends, class: className = '' }: GiftDescriptionProps = $props();

	const hasBase = $derived((description ?? '').trim() !== '');
	const hasAppends = $derived(descriptionAppends.length > 0);
	const hasContent = $derived(hasBase || hasAppends);
</script>

{#if hasContent}
	<div class={cn('flex flex-col gap-1', className)}>
		{#if hasBase}
			<p class="whitespace-pre-line text-sm text-muted-foreground">{description}</p>
		{/if}
		{#each descriptionAppends as append, i (`${append.addedAt}:${i}`)}
			<div class="whitespace-pre-line text-sm text-wishlist-accent">
				<span class="text-xs opacity-70"
					>{formatAppendDate(append.addedAt)} –
				</span>{append.text}
			</div>
		{/each}
	</div>
{/if}
