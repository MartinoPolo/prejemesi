import { tv } from 'tailwind-variants';

export const tooltipContentShellClass =
	'z-(--z-tooltip) origin-(--bits-tooltip-content-transform-origin) drop-shadow-[var(--elevation-compact)] transition-[opacity,scale,translate] duration-150 ease-[ease] data-[state=delayed-open]:starting:opacity-0 data-[state=delayed-open]:starting:scale-95 data-[state=delayed-open]:data-[side=bottom]:starting:-translate-y-2 data-[state=delayed-open]:data-[side=top]:starting:translate-y-2 data-[state=delayed-open]:data-[side=left]:starting:translate-x-2 data-[state=delayed-open]:data-[side=right]:starting:-translate-x-2 data-ending-style:opacity-0 data-ending-style:scale-95';

export const tooltipContentVariants = tv({
	base: 'inline-flex w-fit max-w-xs items-center gap-1.5 rounded-btn border-2 border-edge bg-card px-3 py-1.5 text-[11px] font-semibold text-ink break-words has-data-[slot=kbd]:pr-1.5 **:data-[slot=kbd]:relative **:data-[slot=kbd]:isolate **:data-[slot=kbd]:z-50 **:data-[slot=kbd]:rounded-sm',
});
