import { tv } from 'tailwind-variants';
import {
	CONTROL_ICON_SIZE_CLASSES,
	CONTROL_SIZES,
	CONTROL_SIZE_CLASSES,
	RESPONSIVE_CONTROL_SIZE_CLASSES,
	type ControlSize,
} from '../control_sizing.js';

export const checkboxVariants = tv({
	slots: {
		owner: 'group elevation-owner elevation-owner-raised elevation-owner-anchored relative inline-flex aspect-square shrink-0 rounded-btn outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed',
		surface:
			'elevation-surface pointer-events-none grid size-full place-content-center rounded-[inherit] border-2 border-ink bg-card text-current transition-[translate,scale,box-shadow,background-color] data-[checked]:bg-primary data-[checked]:text-primary-foreground data-[indeterminate]:bg-primary data-[indeterminate]:text-primary-foreground data-[disabled]:opacity-50 group-aria-invalid:border-invalid-border group-aria-invalid:ring-3 group-aria-invalid:ring-invalid-ring',
		indicator: 'grid place-content-center text-current transition-none',
	},
	variants: {
		size: {
			responsive: {
				owner: RESPONSIVE_CONTROL_SIZE_CLASSES,
				surface: CONTROL_ICON_SIZE_CLASSES.lg,
			},
			sm: { owner: CONTROL_SIZE_CLASSES.sm, surface: CONTROL_ICON_SIZE_CLASSES.sm },
			md: { owner: CONTROL_SIZE_CLASSES.md, surface: CONTROL_ICON_SIZE_CLASSES.md },
			lg: { owner: CONTROL_SIZE_CLASSES.lg, surface: CONTROL_ICON_SIZE_CLASSES.lg },
			xl: { owner: CONTROL_SIZE_CLASSES.xl, surface: CONTROL_ICON_SIZE_CLASSES.xl },
		},
	},
	defaultVariants: { size: 'responsive' },
});

export type CheckboxSize = ControlSize;
export const CHECKBOX_SIZES = [...CONTROL_SIZES];
