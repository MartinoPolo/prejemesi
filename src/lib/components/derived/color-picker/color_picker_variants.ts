import { tv } from 'tailwind-variants';

export const colorPickerVariants = tv({
	slots: {
		trigger:
			'size-(--size-control-sm) shrink-0 rounded-btn border-[2.5px] border-ink shadow-sticker-sm outline-none transition-[border-color,box-shadow,opacity,transform] focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-45',
		swatch: 'size-7 rounded-btn border-2 border-ink outline-none transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring aria-pressed:ring-2 aria-pressed:ring-ring aria-pressed:ring-offset-2 aria-pressed:ring-offset-background disabled:cursor-not-allowed disabled:opacity-45',
	},
});
