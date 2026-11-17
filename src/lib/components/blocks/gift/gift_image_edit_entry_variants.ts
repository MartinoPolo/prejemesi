import { tv } from 'tailwind-variants';

/**
 * The gift editor's image entry: the whole image is one button with a centred pencil sticker. On
 * a wide image, hover (pointer devices only) or keyboard focus dims the photo and widens the
 * sticker into a labelled pill by unclipping it, never by animating its width; reduced motion
 * keeps only the fades.
 */
export const giftImageEditEntryVariants = tv({
	slots: {
		root: [
			'group/image-edit absolute inset-0 grid size-full cursor-pointer place-items-center rounded-[inherit] outline-none',
			'disabled:cursor-not-allowed focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-inset',
		],
		scrim: [
			'pointer-events-none absolute inset-0 rounded-[inherit] bg-scrim opacity-0',
			'transition-opacity duration-(--duration-normal) ease-(--ease-out-strong)',
			'group-hover/image-edit:opacity-50 group-focus-visible/image-edit:opacity-50 group-disabled/image-edit:opacity-0',
		],
		stickerStack: 'pointer-events-none relative grid place-items-center',
		circle: [
			'col-start-1 row-start-1 grid size-(--size-control-lg) place-items-center rounded-full border-(length:--border-w) border-edge bg-card text-ink shadow-sticker-sm [&_svg]:size-4',
			'transition-opacity duration-(--duration-fast) ease-(--ease-out-strong)',
		],
		pill: [
			'col-start-1 row-start-1 flex h-(--size-control-lg) items-center gap-2 rounded-full border-(length:--border-w) border-edge bg-card px-4 text-sm font-semibold whitespace-nowrap text-ink shadow-sticker-sm opacity-0 [&_svg]:size-4',
			'[clip-path:inset(0_calc(50%-var(--size-control-lg)/2)_round_9999px)]',
			'transition-[clip-path,opacity] duration-(--duration-normal) ease-(--ease-out-strong) motion-reduce:transition-opacity',
		],
	},
	variants: {
		/** Wide images widen into the labelled pill from `sm`; narrow ones keep the icon. */
		expandable: {
			true: {
				circle: 'sm:group-hover/image-edit:opacity-0 sm:group-focus-visible/image-edit:opacity-0',
				pill: 'hidden sm:flex sm:group-hover/image-edit:opacity-100 sm:group-hover/image-edit:[clip-path:inset(-0.5rem_round_9999px)] sm:group-focus-visible/image-edit:opacity-100 sm:group-focus-visible/image-edit:[clip-path:inset(-0.5rem_round_9999px)]',
			},
			false: { pill: 'hidden' },
		},
	},
	defaultVariants: { expandable: false },
});
