const EDGE_EPSILON = 1;
const RELEASE_SAMPLE_WINDOW = 100;
const RELEASE_STILLNESS = 40;
const RELEASE_GLIDE_DURATION = 300;

export interface CarouselScrollability {
	canScrollPrev: boolean;
	canScrollNext: boolean;
}

export interface PointerSample {
	x: number;
	time: number;
}

export function resolveScrollability(
	scrollLeft: number,
	scrollWidth: number,
	clientWidth: number,
): CarouselScrollability {
	return {
		canScrollPrev: scrollLeft > EDGE_EPSILON,
		canScrollNext: scrollLeft < scrollWidth - clientWidth - EDGE_EPSILON,
	};
}

/** The scroll offset that aligns the next (or previous) card start with the row's start edge. */
export function resolveCardTarget(
	cardStarts: readonly number[],
	from: number,
	maxScroll: number,
	direction: 1 | -1,
): number {
	const target =
		direction === 1
			? Math.min(maxScroll, ...cardStarts.filter((start) => start > from + EDGE_EPSILON))
			: Math.max(0, ...cardStarts.filter((start) => start < from - EDGE_EPSILON));
	return Math.min(maxScroll, Math.max(0, target));
}

/**
 * Scroll distance a released mouse drag keeps gliding: the recent pointer velocity carried for a
 * short, fixed time. A pointer held still before release does not fling.
 */
export function resolveReleaseGlide(
	samples: readonly PointerSample[],
	releaseTime: number,
): number {
	const last = samples.at(-1);
	if (last === undefined || releaseTime - last.time > RELEASE_STILLNESS) {
		return 0;
	}
	const first = samples.find((sample) => last.time - sample.time <= RELEASE_SAMPLE_WINDOW);
	if (first === undefined || last.time === first.time) {
		return 0;
	}
	// Dragging the pointer left scrolls the row toward its end, so the glide opposes pointer travel.
	const scrollVelocity = (first.x - last.x) / (last.time - first.time);
	return scrollVelocity * RELEASE_GLIDE_DURATION;
}
