<script lang="ts">
	import ImageIcon from '@lucide/svelte/icons/image';
	import * as m from '$lib/paraglide/messages.js';
	import { Badge } from '$lib/components/base/badge/index.js';
	import { czechPluralCategory } from '$lib/modules/gifts/gift_display.js';
	import { cn } from '$lib/utils.js';

	interface Props {
		/** Images after the cover. */
		additionalCount: number;
		class?: string;
	}

	let { additionalCount, class: className }: Props = $props();

	const description = $derived.by(() => {
		const category = czechPluralCategory(additionalCount);
		if (category === 'one') {
			return m.gift_gallery_more_images_one();
		}
		return category === 'few'
			? m.gift_gallery_more_images_few({ count: additionalCount })
			: m.gift_gallery_more_images_other({ count: additionalCount });
	});
</script>

<Badge
	tone="neutral"
	badgeStyle="overlay"
	class={cn('pointer-events-none', className)}
	data-testid="gift-gallery-count-chip"
>
	<ImageIcon class="size-3 shrink-0" strokeWidth={2.6} aria-hidden="true" />
	<span aria-hidden="true">+{additionalCount}</span>
	<span class="sr-only">{description}</span>
</Badge>
