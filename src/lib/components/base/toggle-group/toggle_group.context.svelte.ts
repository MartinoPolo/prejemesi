import { createContext } from 'svelte';
import type { ToggleIntent, ToggleSize } from '../toggle/toggle_variants.js';

interface ToggleGroupContext {
	readonly intent: ToggleIntent;
	readonly size: ToggleSize;
}

type ToggleGroupContextValue = ReturnType<typeof createToggleGroupContext>;

const [useToggleGroup, setToggleGroupInternal] = createContext<ToggleGroupContextValue>();
export { useToggleGroup };

export function setToggleGroupContext(getIntent: () => ToggleIntent, getSize: () => ToggleSize) {
	const context = createToggleGroupContext(getIntent, getSize);
	setToggleGroupInternal(context);
	return context;
}

function createToggleGroupContext(
	getIntent: () => ToggleIntent,
	getSize: () => ToggleSize,
): ToggleGroupContext {
	return {
		get intent() {
			return getIntent();
		},
		get size() {
			return getSize();
		},
	};
}
