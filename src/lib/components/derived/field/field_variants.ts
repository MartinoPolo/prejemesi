import type { WithElementRef } from '$lib/utils.js';
import type { HTMLAttributes } from 'svelte/elements';
import type { Snippet } from 'svelte';
import { tv } from 'tailwind-variants';

/** Vertical stack that spaces sibling fields evenly (issue: unified form-field UX). */
export const fieldGroupVariants = tv({
	base: 'flex flex-col gap-4',
});

/** A single field row: label + control + optional error/help, stacked. */
export const fieldVariants = tv({
	base: 'flex flex-col gap-2',
});

/** Error message text shown below a field's control and linked via aria-describedby. */
export const fieldErrorVariants = tv({
	base: 'flex items-center gap-1 text-(length:--text-xs) leading-snug text-destructive',
});

export type FieldGroupProps = WithElementRef<HTMLAttributes<HTMLDivElement>>;

/** Wiring passed to the control slot so every field applies the same error contract. */
export interface FieldControlContext {
	/** True when the field has an error message; drive `state="error"` + `aria-invalid`. */
	hasError: boolean;
	/** The error node's id, or `undefined`; pass to the control's `aria-describedby`. */
	errorId: string | undefined;
}

export type FieldProps = Omit<WithElementRef<HTMLAttributes<HTMLDivElement>>, 'children'> & {
	/** Base id for the control; the error node uses `${fieldId}-error`. */
	fieldId: string;
	/** Visible field label, rendered in a `<Label for={fieldId}>`. */
	label: string;
	/** Error text; when present the field is in the error state and the message is rendered + linked. */
	errorMessage?: string;
	/** The control markup; receives the a11y wiring to apply the shared error contract. */
	children: Snippet<[FieldControlContext]>;
	/** Optional helper snippet shown below the control when there is no error. */
	help?: Snippet;
};

export type FieldErrorProps = WithElementRef<HTMLAttributes<HTMLParagraphElement>>;
