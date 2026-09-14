export const CONTROL_SIZES = ['sm', 'md', 'lg', 'xl'] as const;
export type ControlSize = (typeof CONTROL_SIZES)[number];

export const CONTROL_SIZE_CLASSES = {
	sm: 'h-(--size-control-sm)',
	md: 'h-(--size-control-md)',
	lg: 'h-(--size-control-lg)',
	xl: 'h-(--size-control-xl)',
} as const satisfies Record<ControlSize, string>;

export const RESPONSIVE_CONTROL_SIZE_CLASSES = 'h-(--size-control-lg) sm:h-(--size-control-md)';

export const CONTROL_TEXT_SIZE_CLASSES = {
	sm: 'px-2.25 text-(length:--text-sm)',
	md: 'px-3 text-(length:--text-md)',
	lg: 'px-4 text-(length:--text-base)',
	xl: 'px-5 text-(length:--text-lg)',
} as const satisfies Record<ControlSize, string>;

export const RESPONSIVE_CONTROL_TEXT_SIZE_CLASSES =
	'px-4 text-(length:--text-base) sm:px-3 sm:text-(length:--text-md)';

export const CONTROL_ICON_SIZE_CLASSES = {
	sm: '[&_[data-icon]]:size-3.5 [&_svg]:size-3.5',
	md: '[&_[data-icon]]:size-4 [&_svg]:size-4',
	lg: '[&_[data-icon]]:size-4 [&_svg]:size-4',
	xl: '[&_[data-icon]]:size-5 [&_svg]:size-5',
} as const satisfies Record<ControlSize, string>;

export const CONTROL_DIRECT_ICON_SIZE_CLASSES = {
	sm: '[&>svg]:size-3.5',
	md: '[&>svg]:size-4',
	lg: '[&>svg]:size-4',
	xl: '[&>svg]:size-5',
} as const satisfies Record<ControlSize, string>;

export const RESPONSIVE_CONTROL_DIRECT_ICON_SIZE_CLASSES = CONTROL_DIRECT_ICON_SIZE_CLASSES.lg;
