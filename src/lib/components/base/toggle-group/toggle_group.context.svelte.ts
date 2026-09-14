import { createContext } from 'svelte';
import type { ToggleFormat, ToggleIntent, ToggleSize } from '../toggle/toggle_variants.js';

interface ToggleGroupContext {
	readonly intent: ToggleIntent;
	readonly size: ToggleSize | undefined;
	readonly format: ToggleFormat;
}

type ToggleGroupContextValue = ReturnType<typeof createToggleGroupContext>;

const [useToggleGroup, setToggleGroupInternal] = createContext<ToggleGroupContextValue>();
export { useToggleGroup };

export function setToggleGroupContext(
	getIntent: () => ToggleIntent,
	getSize: () => ToggleSize | undefined,
	getFormat: () => ToggleFormat,
) {
	const context = createToggleGroupContext(getIntent, getSize, getFormat);
	setToggleGroupInternal(context);
	return context;
}

function createToggleGroupContext(
	getIntent: () => ToggleIntent,
	getSize: () => ToggleSize | undefined,
	getFormat: () => ToggleFormat,
): ToggleGroupContext {
	return {
		get intent() {
			return getIntent();
		},
		get size() {
			return getSize();
		},
		get format() {
			return getFormat();
		},
	};
}
