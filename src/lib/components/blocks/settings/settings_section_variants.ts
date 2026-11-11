import { tv } from 'tailwind-variants';

/** The icon, title and description that open every settings card. */
export const settingsSectionHeaderVariants = tv({
	slots: {
		row: 'flex items-center gap-2',
		icon: 'size-5',
		title: '',
	},
	variants: {
		tone: {
			default: { icon: 'text-muted-foreground' },
			/** A section whose actions destroy or undo something. */
			danger: { icon: 'text-status-danger-text', title: 'text-status-danger-text' },
		},
	},
	defaultVariants: {
		tone: 'default',
	},
});

export type SettingsSectionTone = keyof typeof settingsSectionHeaderVariants.variants.tone;

export const SETTINGS_SECTION_TONES = Object.keys(
	settingsSectionHeaderVariants.variants.tone,
) as SettingsSectionTone[];

/** A card that holds one destructive or undoing action with its explanation. */
export const dangerActionCardVariants = tv({
	slots: {
		root: 'border-destructive/30',
		content: 'flex flex-col gap-3',
		actionRow: 'flex items-center justify-end gap-4',
		actionText: 'me-auto',
		actionTitle: 'text-sm font-medium',
		actionDescription: 'text-xs text-muted-foreground',
	},
});
