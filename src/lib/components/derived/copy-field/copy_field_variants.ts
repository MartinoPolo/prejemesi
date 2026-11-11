import { tv } from 'tailwind-variants';
import type { ControlSize } from '$lib/components/base/control_sizing.js';

export const copyFieldVariants = tv({
	slots: {
		/** A size container, so a narrow field can give the value the room the copy label needs. */
		root: '@container/copy-field w-full',
		input: 'text-ellipsis',
		/**
		 * Icon-only in a narrow field; from 22rem a stable width keeps the field from jumping when
		 * "Copy" turns into "Copied".
		 */
		copyButton: '@min-[22rem]/copy-field:min-w-33',
		/** Hidden in a narrow field, where it still names the icon-only button. */
		copyLabel: 'sr-only @min-[22rem]/copy-field:not-sr-only',
	},
	variants: {
		kind: {
			/** Links and other readable values use the body font. */
			text: {},
			/** Secrets such as access tokens: monospace on a muted field so each character reads clearly. */
			secret: {
				root: 'bg-muted',
				input: 'font-mono text-(length:--text-md) text-foreground',
			},
		},
	},
	defaultVariants: {
		kind: 'text',
	},
});

export type CopyFieldKind = keyof typeof copyFieldVariants.variants.kind;

export const COPY_FIELD_KINDS = Object.keys(copyFieldVariants.variants.kind) as CopyFieldKind[];

export interface CopyFieldProps {
	/** The exact text written to the clipboard. */
	value: string;
	/** Shorter text shown in the field, such as a link without its protocol; defaults to `value`. */
	displayValue?: string;
	kind?: CopyFieldKind;
	size?: ControlSize;
	/** Input id, for a visible `<Label for>`; use `label` when there is no visible label. */
	id?: string;
	/** Accessible name of the field when it has no visible label. */
	label?: string;
	/** Runs after a successful copy. */
	oncopied?: () => void;
}
