<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils.js';
	import {
		GIFT_GALLERY_INDICATOR_KINDS,
		galleryIndicatorKind,
		type GiftGalleryIndicatorKind,
	} from '$lib/modules/gifts/gift_gallery.js';

	interface Props {
		count: number;
		index: number;
		/** Overrides the dots-or-counter choice the gallery size makes. */
		kind?: GiftGalleryIndicatorKind;
		class?: string;
	}

	let { count, index, kind = galleryIndicatorKind(count), class: className }: Props = $props();

	const position = $derived(index + 1);
	const dotIndexes = $derived(Array.from({ length: count }, (_, dotIndex) => dotIndex));
</script>

{#if kind !== GIFT_GALLERY_INDICATOR_KINDS.none}
	<div
		class={cn(
			'pointer-events-none flex h-5 items-center rounded-full bg-[color-mix(in_oklab,var(--card)_88%,transparent)] shadow-[0_0_0_1.5px_var(--ink-faint)]',
			kind === GIFT_GALLERY_INDICATOR_KINDS.dots
				? 'gap-[5px] px-[7px]'
				: 'px-2 text-[11px] font-extrabold text-ink tabular-nums',
			className,
		)}
		data-testid="gift-gallery-indicator"
		data-kind={kind}
	>
		{#if kind === GIFT_GALLERY_INDICATOR_KINDS.dots}
			{#each dotIndexes as dotIndex (dotIndex)}
				<!-- The current dot is longer, not only darker, so position never rests on colour alone. -->
				<span
					class={cn(
						'block h-1.5 rounded-full motion-safe:transition-[width,background-color] motion-safe:duration-(--duration-normal) motion-safe:ease-(--ease-standard)',
						dotIndex === index
							? 'w-3.5 bg-ink'
							: 'w-1.5 bg-[color-mix(in_oklab,var(--ink)_38%,transparent)]',
					)}
					data-current={dotIndex === index || undefined}
					aria-hidden="true"
				></span>
			{/each}
		{:else}
			<span aria-hidden="true">{position}/{count}</span>
		{/if}
		<span class="sr-only" aria-live="polite"
			>{m.gift_gallery_position({ position, count })}</span
		>
	</div>
{/if}
