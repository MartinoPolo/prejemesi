<script lang="ts">
	import type { PublicGiftCategory } from '$lib/modules/gift-categories/types.js';
	import { labelForGiftCategory } from '$lib/modules/gift-categories/types.js';
	import { foregroundForCategoryColor } from '$lib/modules/gift-categories/gift_category_colors.js';
	import { getLocale } from '$lib/paraglide/runtime.js';
	import { cn } from '$lib/utils.js';

	interface Props {
		category: PublicGiftCategory;
		isDimmed?: boolean;
		class?: string;
	}

	let { category, isDimmed = false, class: className }: Props = $props();
	const label = $derived(
		labelForGiftCategory(category, getLocale().startsWith('en') ? 'en' : 'cs'),
	);
	const foreground = $derived(foregroundForCategoryColor(category.color));
</script>

<span
	data-testid="gift-category-badge"
	class={cn(
		'inline-block max-w-full -rotate-3 rounded-md border-2 border-black px-2.5 py-0.5 text-xs leading-4 font-extrabold shadow-sticker [overflow-wrap:anywhere]',
		isDimmed && 'opacity-50',
		className,
	)}
	style:background-color={category.color}
	style:color={foreground}
	title={label}
>
	{label}
</span>
