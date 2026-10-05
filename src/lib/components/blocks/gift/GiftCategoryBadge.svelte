<script lang="ts">
	import type { PublicGiftCategory } from '$lib/modules/gift-categories/types.js';
	import { labelForGiftCategory } from '$lib/modules/gift-categories/types.js';
	import { foregroundForCategoryColor } from '$lib/modules/gift-categories/gift_category_colors.js';
	import { getLocale } from '$lib/paraglide/runtime.js';
	import { cn } from '$lib/utils.js';
	import { badgeShape } from '$lib/components/base/badge/index.js';

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

<!-- Prefer one line, clamp at two with an ellipsis; words break only when a single word cannot
     fit. The full label stays in the DOM for assistive technology and in the title tooltip. -->
<span
	data-testid="gift-category-badge"
	class={cn(
		badgeShape,
		'max-w-full overflow-hidden border-ink px-2.5 py-0.5 text-xs leading-4 font-extrabold [display:-webkit-inline-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] [overflow-wrap:break-word]',
		isDimmed && 'opacity-50',
		className,
	)}
	style:background-color={category.color}
	style:color={foreground}
	title={label}
>
	{label}
</span>
