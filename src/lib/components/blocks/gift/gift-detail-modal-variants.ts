import { tv } from 'tailwind-variants';

export const giftDetailModalVariants = tv({
	slots: {
		content: 'sm:max-w-[900px] max-h-[90dvh] overflow-hidden p-0 gap-0 max-w-[calc(100%-1rem)]',
		body: 'grid grid-cols-1 sm:grid-cols-[45%_55%] min-h-[400px] sm:min-h-[520px]',
		imageColumn:
			'relative overflow-hidden bg-muted border-b sm:border-b-0 sm:border-r border-border h-[200px] sm:h-auto',
		imagePlaceholder:
			'flex size-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-muted to-accent/30',
		image: 'size-full object-cover',
		detailColumn: 'flex flex-col gap-0 overflow-y-auto p-5 sm:p-7',
		formField: 'flex flex-col gap-1.5',
		formLabel: 'text-sm font-medium text-foreground',
		formRow: 'grid grid-cols-2 gap-3',
		formActions: 'mt-auto flex flex-col gap-2 pt-4',
		submitButton: 'w-full',
		deleteButton: 'w-full',
		receivedButton: 'w-full',
		imageInputRow: 'flex flex-col gap-2',
		imageTabRow: 'flex gap-1',
		imageTab: 'rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer',
	},
	variants: {
		imageTabActive: {
			true: {
				imageTab: 'bg-primary text-primary-foreground',
			},
			false: {
				imageTab: 'bg-muted text-muted-foreground hover:bg-muted/80',
			},
		},
	},
	defaultVariants: {
		imageTabActive: false,
	},
});

export type GiftDetailModalMode = 'create' | 'edit';
