import { tv } from 'tailwind-variants';

export const tooltipContentShellClass =
	'z-(--z-tooltip) origin-(--bits-tooltip-content-transform-origin) drop-shadow-[var(--elevation-compact)] data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2';

export const tooltipContentVariants = tv({
	base: 'inline-flex w-fit max-w-xs items-center gap-1.5 rounded-btn border-2 border-ink bg-card px-3 py-1.5 text-[11px] font-semibold text-ink break-words has-data-[slot=kbd]:pr-1.5 **:data-[slot=kbd]:relative **:data-[slot=kbd]:isolate **:data-[slot=kbd]:z-50 **:data-[slot=kbd]:rounded-sm',
});
