import { tv } from 'tailwind-variants';

export const tooltipPositionerClass = 'z-(--z-tooltip) drop-shadow-[2px_2px_0_var(--hard-shadow)]';

export const tooltipContentVariants = tv({
	base: 'data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 inline-flex items-center gap-1.5 rounded-btn px-3 py-1.5 text-[11px] font-semibold break-words has-data-[slot=kbd]:pr-1.5 **:data-[slot=kbd]:relative **:data-[slot=kbd]:isolate **:data-[slot=kbd]:z-50 **:data-[slot=kbd]:rounded-sm bg-card text-ink border-2 border-ink w-fit max-w-xs origin-(--bits-tooltip-content-transform-origin)',
});
