import { tv } from 'tailwind-variants';

export type GiftDraftRowStatus = 'ready' | 'duplicate' | 'error' | 'neutral';

export const giftDraftRowVariants = tv({
	base: 'rounded-lg border p-4 transition-[background-color,border-color,opacity] duration-150',
	variants: {
		status: {
			ready: 'bg-[color-mix(in_oklab,var(--status-success)_16%,var(--surface))] border-[color-mix(in_oklab,var(--status-success)_55%,var(--border))]',
			duplicate:
				'bg-[color-mix(in_oklab,var(--status-dup)_20%,var(--surface))] border-[color-mix(in_oklab,var(--status-dup)_62%,var(--border))]',
			error: 'bg-[color-mix(in_oklab,var(--status-danger)_15%,var(--surface))] border-[color-mix(in_oklab,var(--status-danger)_60%,var(--border))]',
			neutral: 'bg-surface border-border',
		},
		excluded: {
			true: 'opacity-50',
			false: '',
		},
	},
	defaultVariants: {
		status: 'neutral',
		excluded: false,
	},
});

export const GIFT_DRAFT_ROW_STATUSES = Object.keys(
	giftDraftRowVariants.variants.status,
) as GiftDraftRowStatus[];
