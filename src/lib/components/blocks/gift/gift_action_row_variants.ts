import { tv } from 'tailwind-variants';

export const giftActionRowVariants = tv({
	slots: {
		row: 'gift-action-row ml-auto flex w-full max-w-full min-w-0 flex-nowrap items-start justify-end',
		leading: 'flex flex-none items-start',
		primaryGroup:
			'gift-action-primary-group flex max-w-full flex-nowrap items-start justify-end',
		primary:
			"gift-action-slot flex min-w-0 flex-none items-end [&>[data-slot='button']]:w-auto [&>[data-slot='button']]:grow-0 [&>[data-slot='button']]:shrink-0",
		secondary:
			"gift-action-slot flex max-w-full min-w-0 flex-none items-end [&>[data-slot='button']]:w-auto [&>[data-slot='button']]:grow-0",
		more: 'size-(--gift-action-control-size) min-h-0 min-w-0 flex-none self-start',
	},
});
