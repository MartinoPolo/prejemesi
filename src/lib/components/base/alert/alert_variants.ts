import type { Snippet } from 'svelte';
import { tv } from 'tailwind-variants';
import type { HTMLAttributes } from 'svelte/elements';
import type { WithElementRef } from '$lib/utils.js';

export const alertVariants = tv({
	base: "grid gap-0.5 rounded-[12px] border-[2.5px] border-ink px-4 py-3 text-left text-sm has-[>svg]:grid-cols-[auto_1fr] has-data-[slot=alert-action]:grid-cols-[1fr_auto] has-[>svg]:has-data-[slot=alert-action]:grid-cols-[auto_1fr_auto] has-data-[slot=alert-action]:gap-x-3 has-[>svg]:gap-x-2.5 *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg]:text-current *:[svg:not([class*='size-'])]:size-4 group/alert relative w-full",
	variants: {
		tone: {
			/** Explains or gives context. */
			info: 'bg-tint text-card-foreground',
			/** Confirms that something worked. */
			success:
				'bg-[color-mix(in_oklab,var(--status-success)_14%,var(--card))] text-card-foreground *:[svg]:text-status-success-text',
			/** The user must act now or lose something. */
			warning:
				'border-accent-loud-foreground bg-accent-loud text-accent-loud-foreground font-semibold shadow-sticker-strong *:data-[slot=alert-description]:text-accent-loud-foreground/90 *:[svg]:text-current',
			/** Reports an error, usually with a Retry action when retryable. */
			danger: 'bg-[color-mix(in_oklab,var(--status-danger)_14%,var(--card))] text-card-foreground *:[svg]:text-status-danger-text',
		},
	},
	defaultVariants: {
		tone: 'info',
	},
});

export type AlertTone = keyof typeof alertVariants.variants.tone;

export const ALERT_TONES = Object.keys(alertVariants.variants.tone) as AlertTone[];

/**
 * Default ARIA role per tone: only errors interrupt the screen reader, successes are announced
 * politely, and static info or warning callouts are read in place. Pass `role="alert"` to a
 * non-danger callout that appears in response to an action and must be announced.
 */
export const ALERT_TONE_ROLES = {
	danger: 'alert',
	success: 'status',
	warning: 'note',
	info: 'note',
} as const satisfies Record<AlertTone, string>;

export type AlertProps = WithElementRef<HTMLAttributes<HTMLDivElement>> & {
	tone?: AlertTone;
	children?: Snippet;
};
