/**
 * Overlay enter and exit as CSS transitions. Unlike keyframes, a transition interrupted by the
 * opposite action reverses from its current value instead of jumping to the other animation's
 * start. Enter uses `@starting-style` rather than Bits' `data-starting-style`, which Bits only sets
 * when `open` flips after mount, so content mounted already open still enters. Exit uses Bits'
 * `data-ending-style`; Bits waits on `getAnimations()`, which includes transitions, before unmounting.
 */
const fadeScaleStates =
	'ease-[ease] starting:opacity-0 starting:scale-95 data-ending-style:opacity-0 data-ending-style:scale-95';

/** Leaves `translate` untransitioned so layout offsets such as the dialog's keyboard lift still snap. */
export const fadeScaleOverlayMotionClass = `transition-[opacity,scale] ${fadeScaleStates}`;

/** Enter also slides in from the trigger's side; exit only fades and shrinks. */
export const slidingFadeScaleOverlayMotionClass = `transition-[opacity,scale,translate] ${fadeScaleStates} data-[side=bottom]:starting:-translate-y-2 data-[side=top]:starting:translate-y-2 data-[side=left]:starting:translate-x-2 data-[side=right]:starting:-translate-x-2 data-[side=inline-start]:starting:translate-x-2 data-[side=inline-end]:starting:-translate-x-2`;

export const fadeOverlayMotionClass =
	'transition-opacity ease-[ease] starting:opacity-0 data-ending-style:opacity-0';
