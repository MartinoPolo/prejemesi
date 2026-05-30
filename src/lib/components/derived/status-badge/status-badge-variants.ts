import { tv } from 'tailwind-variants';
import { asExhaustiveArray } from '$lib/utils/variants.js';

export const statusBadgeVariants = tv({
	base: 'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
	variants: {
		status: {
			success: 'border-status-success/30 bg-status-success/10 text-status-success',
			warning: 'border-status-warning/30 bg-status-warning/10 text-status-warning',
			danger: 'border-status-danger/30 bg-status-danger/10 text-status-danger',
			info: 'border-status-info/30 bg-status-info/10 text-status-info',
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
