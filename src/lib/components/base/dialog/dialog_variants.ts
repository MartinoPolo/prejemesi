import { tv } from 'tailwind-variants';
import { asExhaustiveArray } from '$lib/utils/variants.js';

export const dialogContentVariants = tv({
	base: [
		'bg-card text-card-foreground data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 fixed top-[50%] left-[50%] z-(--z-modal) grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-panel border-[2.5px] border-ink p-6 shadow-sticker duration-200',
		// On a phone with the keyboard open the dialog rises to sit just above it, and scrolls
		// when it is taller than the space left.
		'keyboard-open:top-auto keyboard-open:bottom-[calc(var(--keyboard-inset)+0.5rem)] keyboard-open:max-h-[calc(var(--visual-viewport-height)-1rem)] keyboard-open:translate-y-0 keyboard-open:overflow-y-auto',
	],
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
		layout: {
			/** Short dialogs: padded content that centers vertically. */
			default: '',
			/**
			 * Long dialogs: header and footer stay pinned while `Dialog.Body` scrolls. Top-anchored so
			 * content that grows (accordions, validation errors) extends downward instead of re-centering
			 * and jumping. A direct `form` child joins the column so Body and Footer can sit inside it.
			 */
			scroll: [
				'top-[10vh] flex max-h-[85dvh] translate-y-0 flex-col gap-0 overflow-hidden p-0',
				'*:[form]:flex *:[form]:min-h-0 *:[form]:flex-1 *:[form]:flex-col',
				// The body starts as far below a divided header's line as the header content sits above it.
				'[--dialog-body-padding-top:--spacing(1)] has-data-header-divided:[--dialog-body-padding-top:--spacing(4)]',
			],
		},
	},
	defaultVariants: {
		size: 'lg',
		layout: 'default',
	},
});

export type DialogContentSize = keyof typeof dialogContentVariants.variants.size;
export type DialogContentLayout = keyof typeof dialogContentVariants.variants.layout;

export const DIALOG_CONTENT_LAYOUTS = Object.keys(
	dialogContentVariants.variants.layout,
) as DialogContentLayout[];

/** Paint for the pinned header, scrolling body and pinned footer inside a `layout="scroll"` dialog. */
export const dialogScrollSectionVariants = tv({
	slots: {
		header: 'in-data-[dialog-layout=scroll]:shrink-0 in-data-[dialog-layout=scroll]:px-6 in-data-[dialog-layout=scroll]:pt-6 in-data-[dialog-layout=scroll]:pb-4',
		body: 'in-data-[dialog-layout=scroll]:min-h-0 in-data-[dialog-layout=scroll]:flex-1 in-data-[dialog-layout=scroll]:overflow-y-auto in-data-[dialog-layout=scroll]:px-6 in-data-[dialog-layout=scroll]:pt-(--dialog-body-padding-top) in-data-[dialog-layout=scroll]:pb-6',
		footer: 'in-data-[dialog-layout=scroll]:shrink-0 in-data-[dialog-layout=scroll]:border-t in-data-[dialog-layout=scroll]:border-border in-data-[dialog-layout=scroll]:bg-background in-data-[dialog-layout=scroll]:px-6 in-data-[dialog-layout=scroll]:py-4',
	},
	variants: {
		/**
		 * Separates a header that carries a stepper or tabs from the scrolling body. The title row
		 * shares the close button's row and height so the stepper or tabs below clear the button.
		 */
		divided: {
			true: {
				header: [
					'border-b border-border',
					'in-data-[dialog-layout=scroll]:gap-(--nested-control-gap) in-data-[dialog-layout=scroll]:pt-(--overlay-close-inset)',
					'*:data-[slot=dialog-title]:min-h-(--size-control-lg) *:data-[slot=dialog-title]:content-center',
				],
			},
			false: {},
		},
	},
	defaultVariants: {
		divided: false,
	},
});

export const DIALOG_CONTENT_SIZES = asExhaustiveArray<DialogContentSize>()([
	'sm',
	'md',
	'lg',
	'xl',
	'2xl',
]);
