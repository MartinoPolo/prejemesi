import { tv } from 'tailwind-variants';
import { asExhaustiveArray } from '$lib/utils/variants.js';

export const statusBadgeVariants = tv({
	base: 'inline-flex items-center gap-1.5 rounded-badge border-2 border-ink px-2.5 py-0.5 text-xs font-medium',
	variants: {
		status: {
			success: 'bg-status-success/10 text-status-success',
			warning: 'bg-status-warning/10 text-status-warning',
			danger: 'bg-status-danger/10 text-status-danger',
			info: 'bg-status-info/10 text-status-info',
		},
	},
	defaultVariants: {
		status: 'info',
	},
});

export type StatusBadgeStatus = keyof typeof statusBadgeVariants.variants.status;

export const STATUS_BADGE_STATUSES = asExhaustiveArray<StatusBadgeStatus>()([
	'success',
	'warning',
	'danger',
	'info',
] as const);
