import type { Attachment } from 'svelte/attachments';
import { createContext } from 'svelte';

interface CarouselContext {
	readonly canScrollPrev: boolean;
	readonly canScrollNext: boolean;
	scrollPrev: () => void;
	scrollNext: () => void;
	handleKeyDown: (event: KeyboardEvent) => void;
	/** Wires the native horizontal scroller that hosts the slides. */
	attachViewport: Attachment<HTMLElement>;
}

export const [useCarousel, setCarouselContext] = createContext<CarouselContext>();
