import { createContext } from 'svelte';
import type { InputSize } from '$lib/components/base/input/index.js';

interface InputGroupContext {
	readonly size: InputSize | undefined;
}

type InputGroupContextValue = ReturnType<typeof createInputGroupContext>;

const [useInputGroup, setInputGroupInternal] = createContext<InputGroupContextValue>();
export { useInputGroup };

export function setInputGroupContext(getSize: () => InputSize | undefined) {
	const context = createInputGroupContext(getSize);
	setInputGroupInternal(context);
	return context;
}

function createInputGroupContext(getSize: () => InputSize | undefined): InputGroupContext {
	return {
		get size() {
			return getSize();
		},
	};
}
