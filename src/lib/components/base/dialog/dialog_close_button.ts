/**
 * Cross-in-circle overlay close button (issue #164): shared by dialog and sheet content so the
 * two treatments cannot drift. Rotate/scale hover animation is disabled under reduced motion.
 */
export const overlayCloseButtonClass =
	'absolute top-4 right-4 size-(--size-control-lg) rounded-full border-[2.5px] border-ink bg-card text-ink shadow-sticker-sm transition-transform duration-200 ease-spring hover:rotate-90 hover:scale-[1.08] hover:bg-card hover:text-ink motion-reduce:transition-none motion-reduce:hover:rotate-0 motion-reduce:hover:scale-100 [&_svg]:size-4';
