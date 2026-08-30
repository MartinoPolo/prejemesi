import type { CarouselAPI, CarouselPlugins } from './context.js';

export type SoftenedDragMomentumType = NonNullable<CarouselPlugins>[number];

interface SoftenedDragMomentumOptions {
	remainingMomentum?: number;
}

export function SoftenedDragMomentum({
	remainingMomentum = 0.5,
}: SoftenedDragMomentumOptions = {}): SoftenedDragMomentumType {
	const momentumFactor = Number.isFinite(remainingMomentum)
		? Math.min(1, Math.max(0, remainingMomentum))
		: 0.5;
	let api: CarouselAPI | undefined;

	function softenRemainingTravel() {
		if (!api) {
			return;
		}

		// Embla has no public release-momentum control; keep this version-sensitive access isolated.
		const { location, target } = api.internalEngine();
		const currentLocation = location.get();
		target.set(currentLocation + (target.get() - currentLocation) * momentumFactor);
	}

	const self: SoftenedDragMomentumType = {
		name: 'softenedDragMomentum',
		options: {},
		init(emblaApi: CarouselAPI) {
			api = emblaApi;
			api.on('pointerUp', softenRemainingTravel);
		},
		destroy() {
			api?.off('pointerUp', softenRemainingTravel);
			api = undefined;
		},
	};

	return self;
}
