import { tv } from 'tailwind-variants';
import { asExhaustiveArray } from '$lib/utils/variants.js';

export const dialogContentVariants = tv({
	base: 'bg-card text-card-foreground data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 fixed top-[50%] left-[50%] z-(--z-modal) grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-panel border-[2.5px] border-ink p-6 shadow-sticker duration-200',
	variants: {
		size: {
			// tailwind-merge treats each `sm:` breakpoint class as its own conflict group per
			// utility, so every size must live at the same `sm:` modifier to correctly override.
			sm: 'sm:max-w-sm',
			md: 'sm:max-w-md',
			lg: 'sm:max-w-lg',
			xl: 'sm:max-w-xl',
			'2xl': 'sm:max-w-2xl',
		},
	},
	defaultVariants: {
		size: 'lg',
	},
});

export type DialogContentSize = keyof typeof dialogContentVariants.variants.size;

export const DIALOG_CONTENT_SIZES = asExhaustiveArray<DialogContentSize>()([
	'sm',
	'md',
	'lg',
	'xl',
	'2xl',
]);
