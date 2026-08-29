<script lang="ts">
	import type { PublicGiftCategory } from '$lib/modules/gift-categories/types.js';
	import { labelForGiftCategory } from '$lib/modules/gift-categories/types.js';
	import { foregroundForCategoryColor } from '$lib/modules/gift-categories/gift_category_colors.js';
	import { getLocale } from '$lib/paraglide/runtime.js';

	interface Props {
		category: PublicGiftCategory;
	}

	let { category }: Props = $props();
	const label = $derived(
		labelForGiftCategory(category, getLocale().startsWith('en') ? 'en' : 'cs'),
	);
	const foreground = $derived(foregroundForCategoryColor(category.color));
</script>

<span
	data-testid="gift-category-badge"
	class="absolute top-3 left-3 z-20 inline-block max-w-[calc(100%-5rem)] -rotate-3 truncate rounded-md border-2 border-black px-2.5 py-1 text-xs font-extrabold shadow-sticker"
	style:background-color={category.color}
	style:color={foreground}
	title={label}
>
	{label}
</span>
