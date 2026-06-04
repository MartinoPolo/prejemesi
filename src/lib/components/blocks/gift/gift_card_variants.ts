import { tv } from 'tailwind-variants';

export const giftCardVariants = tv({
	slots: {
		card: 'group relative flex flex-col overflow-hidden rounded-xl shadow-sm ring-1 ring-border bg-card transition-shadow hover:shadow-md',
		imageArea: 'relative h-40 w-full overflow-hidden bg-muted',
		image: 'size-full object-cover',
		imagePlaceholder:
			'flex size-full items-center justify-center bg-gradient-to-br from-muted to-accent text-4xl',
		body: 'flex flex-1 flex-col gap-2 p-4',
		nameRow: 'flex flex-wrap items-baseline gap-1.5',
		name: 'line-clamp-2 font-heading text-base font-semibold leading-snug text-foreground',
		price: 'text-lg font-bold text-primary',
		priceEmpty: 'text-sm text-muted-foreground',
		priorityEyebrow: 'flex items-center gap-1',
		linkList: 'mt-auto flex flex-col',
		footer: 'flex items-center justify-between border-t border-border px-4 py-2.5',
		reservedOverlay: 'absolute inset-0 flex items-center justify-center bg-background/40',
	},
	variants: {
		reserved: {
			true: {
				card: 'opacity-[0.78]',
			},
			false: {},
		},
	},
	defaultVariants: {
		reserved: false,
	},
});
