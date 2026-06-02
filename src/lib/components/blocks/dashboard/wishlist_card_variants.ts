import { tv } from 'tailwind-variants';

export const wishlistCardVariants = tv({
	slots: {
		root: 'group/card relative flex cursor-pointer flex-col overflow-hidden rounded-xl border border-border bg-card transition-all duration-slow ease-out',
		banner: 'relative flex h-45 shrink-0 items-center justify-center overflow-hidden',
		bannerOverlay:
			'pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-black/5 to-black/45 dark:from-black/10 dark:via-black/30 dark:to-black/65',
		bannerTitle:
			'absolute bottom-3 left-3.5 right-20 font-heading text-lg font-bold leading-tight tracking-tight text-white/95 [text-shadow:0_1px_3px_oklch(0_0_0/0.45)]',
		statusBadge:
			'absolute bottom-3 right-3 inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-white/18 bg-black/52 px-2.5 py-1 text-[11px] font-bold tracking-wide text-white/95 backdrop-blur-md',
		statusDot: 'size-1.5 shrink-0 rounded-full',
		body: 'flex flex-1 flex-col gap-2.5 px-4 pb-4 pt-3.5',
		metaRow: 'flex flex-wrap items-center gap-2',
		themeBadge:
			'inline-flex h-5.5 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-primary/22 bg-primary/10 px-2.5 text-[11px] font-semibold text-primary',
		metaText: 'truncate text-xs text-muted-foreground',
		giftCount: 'flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground',
		ownerRow: 'flex items-center gap-2 text-[13px] text-muted-foreground',
		ownerAvatar:
			'flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary',
		ownerLabel: 'text-xs text-muted-foreground/70',
		progressWrap: 'flex flex-col gap-1.5',
		progressLabelRow: 'flex items-center justify-between text-xs text-muted-foreground',
		progressValue: 'font-bold text-primary',
		progressTrack: 'h-1.5 overflow-hidden rounded-full border border-border bg-muted',
		progressFill: 'h-full rounded-full bg-primary transition-[width] duration-slow ease-out',
		reservationChip:
			'inline-flex h-5.5 items-center gap-1 whitespace-nowrap rounded-full border border-primary/25 bg-primary/12 px-2.5 text-[11px] font-semibold text-primary',
		availableCount: 'text-xs font-medium text-muted-foreground',
		divider: 'my-0.5 h-px bg-border',
		actions: 'flex flex-wrap items-center gap-1.5',
		actionsEnd: 'ml-auto flex items-center gap-1.5',
	},
	variants: {
		archived: {
			true: {
				root: 'opacity-65 saturate-[0.28] brightness-[0.96]',
			},
			false: {
				root: 'hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-[0_0_0_2px_oklch(0.527_0.154_150/0.18),0_8px_28px_oklch(0.527_0.154_150/0.1),0_2px_6px_oklch(0_0_0/0.05)]',
			},
		},
	},
	defaultVariants: {
		archived: false,
	},
});

export const STATUS_DOT_CLASSES = {
	draft: 'bg-muted-foreground/50',
	active: 'bg-status-success',
	archived: 'bg-muted-foreground/40',
} as const;
