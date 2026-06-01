import { tv } from 'tailwind-variants';

export const wishlistListViewVariants = tv({
	slots: {
		root: 'flex flex-col divide-y divide-border rounded-xl border border-border bg-card',
		row: 'group/row flex items-center gap-4 px-4 py-3 transition-colors duration-normal hover:bg-accent/50',
		bannerMini:
			'relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg',
		bannerMiniOverlay:
			'pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent to-black/30 dark:from-black/5 dark:to-black/40',
		bannerMiniEmoji: 'select-none text-lg opacity-75 dark:opacity-55',
		info: 'flex min-w-0 flex-1 flex-col gap-0.5',
		title: 'truncate text-sm font-semibold text-foreground',
		subtitle: 'truncate text-xs text-muted-foreground',
		trailing: 'flex shrink-0 items-center gap-3',
		statusBadge:
			'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-white/18 bg-black/52 px-2 py-0.5 text-[10px] font-bold text-white/95 backdrop-blur-md',
		statusDot: 'size-1.5 shrink-0 rounded-full',
		giftCount: 'whitespace-nowrap text-xs text-muted-foreground',
	},
	variants: {
		archived: {
			true: {
				row: 'opacity-65 saturate-[0.28] brightness-[0.96]',
			},
		},
	},
});
