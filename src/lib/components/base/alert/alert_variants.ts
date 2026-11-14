import type { Snippet } from 'svelte';
import { tv } from 'tailwind-variants';
import type { HTMLAttributes } from 'svelte/elements';
import type { WithElementRef } from '$lib/utils.js';

export const alertVariants = tv({
	base: [
		'group/alert relative grid w-full rounded-[12px] border-[2.5px] border-edge px-4 py-3 text-left text-base leading-5',
		'has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2.5 has-[>svg]:[&>*:not(svg,[data-slot=alert-action])]:col-start-2',
		'has-[>[data-slot=alert-action][data-placement=end]]:grid-cols-[1fr_auto] has-[>svg]:has-[>[data-slot=alert-action][data-placement=end]]:grid-cols-[auto_1fr_auto] has-[>[data-slot=alert-action][data-placement=end]]:gap-x-3',
		// The icon sits on the first line, so it centres on a one-line callout and stays with the
		// title or opening line of a longer one; it assumes the 20px (`leading-5`) line.
		"*:[svg]:self-start *:[svg]:translate-y-0.5 *:[svg]:text-current *:[svg:not([class*='size-'])]:size-4",
		'[&>[data-slot=alert-title]+*:not([data-slot=alert-action])]:mt-0.5',
	],
	variants: {
		tone: {
			/** Explains or gives context. */
			info: 'bg-[color-mix(in_oklab,var(--status-info)_14%,var(--card))] text-card-foreground',
			/** Confirms that something worked. */
			success:
				'bg-[color-mix(in_oklab,var(--status-success)_14%,var(--card))] text-card-foreground *:[svg]:text-status-success-text',
			/** The user must act now or lose something. */
			warning:
				'border-accent-loud-foreground bg-accent-loud text-accent-loud-foreground shadow-sticker-strong *:[svg]:text-current',
			/** States the list's own lifecycle (archived) in the list's palette tint, part of its look. */
			palette: 'bg-tint text-card-foreground',
			/** Reports an error, usually with a Retry action when retryable. */
			danger: 'bg-[color-mix(in_oklab,var(--status-danger)_14%,var(--card))] text-card-foreground *:[svg]:text-status-danger-text',
		},
	},
	defaultVariants: {
		tone: 'info',
	},
});

/** Where an `Alert.Action` sits; actions use Button `size="sm"`. */
export const alertActionVariants = tv({
	variants: {
		placement: {
			/**
			 * Right of the text, centred on the title and first line. The block margins shrink the
			 * button's share of the row to one 20px text line (and lift it by half its shadow), so the
			 * button never stretches a one-line callout and pushes its text off centre.
			 */
			end: 'col-end-[-1] row-span-2 row-start-1 mt-[calc((--spacing(5)-var(--size-control-sm)-var(--depth-clearance))/2)] mb-[calc((--spacing(5)-var(--size-control-sm)+var(--depth-clearance))/2)] self-center justify-self-end',
			/** Under the text, for a callout whose explanation leads to the action. */
			below: 'mt-3 justify-self-start group-has-[>svg]/alert:col-start-2',
		},
	},
	defaultVariants: {
		placement: 'end',
	},
});

export type AlertActionPlacement = keyof typeof alertActionVariants.variants.placement;

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
	palette: 'note',
} as const satisfies Record<AlertTone, string>;

export type AlertProps = WithElementRef<HTMLAttributes<HTMLDivElement>> & {
	tone?: AlertTone;
	children?: Snippet;
};
