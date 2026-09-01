import { CIRCULAR_STICKER_BUTTON_CLASSES } from '$lib/components/base/button/button_variants.js';

/**
 * Cross-in-circle overlay close button shared by dialog and sheet content. The sticker surface
 * lifts without rotating; only the X icon rotates, and all motion is disabled under reduced motion.
 */
export const overlayCloseButtonClass = `absolute top-4 right-4 size-(--size-control-lg) rounded-full border-[2.5px] border-ink bg-card text-ink hover:bg-card hover:text-ink [&_svg]:size-4 [&_svg]:transition-[rotate] [&_svg]:duration-(--duration-normal) [&_svg]:ease-(--ease-standard) [&_svg]:delay-0 hover:[&_svg]:rotate-90 motion-reduce:[&_svg]:transition-none motion-reduce:hover:[&_svg]:rotate-0 ${CIRCULAR_STICKER_BUTTON_CLASSES}`;
