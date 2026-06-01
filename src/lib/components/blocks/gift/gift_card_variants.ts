import { tv } from 'tailwind-variants';

export const giftCardVariants = tv({
	slots: {
		card: 'group relative overflow-hidden rounded-xl shadow-sm ring-1 ring-border bg-card transition-shadow hover:shadow-md',
		imageArea: 'relative h-40 w-full overflow-hidden bg-muted',
		image: 'size-full object-cover',
		imagePlaceholder:
			'flex size-full items-center justify-center bg-gradient-to-br from-muted to-accent text-4xl',
		body: 'flex flex-col gap-2 p-4',
		name: 'line-clamp-2 font-heading text-base font-semibold leading-snug text-foreground',
		price: 'text-lg font-bold text-primary',
		priceEmpty: 'text-sm text-muted-foreground',
		linkRow: 'inline-flex items-center gap-1 text-xs text-primary',
		linkEmpty: 'text-xs text-muted-foreground',
		footer: 'flex items-center justify-between border-t border-border px-4 py-2.5',
		badgeRow: 'flex flex-wrap items-center gap-1.5',
		reservedOverlay: 'absolute inset-0 flex items-center justify-center bg-background/40',
		quantityBadge: 'text-xs text-muted-foreground font-medium',
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
