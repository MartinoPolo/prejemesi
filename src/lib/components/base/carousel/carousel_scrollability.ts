import type { CarouselAPI, CarouselOptions } from './context.js';

const FREE_SCROLL_BOUNDARY_EPSILON = 0.001;

export interface CarouselScrollability {
	canScrollPrev: boolean;
	canScrollNext: boolean;
}

export function resolveCarouselScrollability(
	api: CarouselAPI,
	options: CarouselOptions,
): CarouselScrollability {
	if (options?.dragFree !== true || options.loop === true) {
		return {
			canScrollPrev: api.canScrollPrev(),
			canScrollNext: api.canScrollNext(),
		};
	}

	const hasOverflow = api.scrollSnapList().length > 1;
	if (!hasOverflow) {
		return { canScrollPrev: false, canScrollNext: false };
	}

	const progress = api.scrollProgress();
	return {
		canScrollPrev: progress > FREE_SCROLL_BOUNDARY_EPSILON,
		canScrollNext: progress < 1 - FREE_SCROLL_BOUNDARY_EPSILON,
	};
}
