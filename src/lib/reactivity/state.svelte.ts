import { untrack } from 'svelte';

export interface MutableState<T> {
	get current(): T;
	set current(value: T);
}

export interface ReadableState<T> {
	get current(): T;
}

export interface StateUpdateOptions<T> {
	isEqual?: (previousValue: NoInfer<T>, newValue: NoInfer<T>) => boolean;
	transform?: (value: NoInfer<T>) => NoInfer<T>;
}

export class StateRaw<T> implements MutableState<T> {
	#current: T;
	#isEqual?: (previousValue: T, newValue: T) => boolean;
	#transform: (value: T) => T;

	constructor(initialValue: T, mutateOptions?: StateUpdateOptions<T>) {
		this.#current = $state.raw(initialValue);
		this.#isEqual = mutateOptions?.isEqual;
		this.#transform = mutateOptions?.transform ?? ((value) => value);
	}

	get current() {
		return this.#current;
	}

	set current(newValue: T) {
		const oldValue = untrack(() => this.#current);
		const newValueTransformed = this.#transform(newValue);
		if (this.#isEqual?.(oldValue, newValueTransformed) === true) {
			return;
		}
		this.#current = newValueTransformed;
	}

	readonly() {
		return new ReadonlyState(this);
	}

	protected() {
		return new ProtectedState(this);
	}
}

export class ReadonlyState<T> implements ReadableState<T> {
	#state;

	constructor(state: MutableState<T>) {
		this.#state = state;
	}

	get current(): T {
		return this.#state.current;
	}
}

export class ProtectedState<T> implements ReadableState<T> {
	#state;

	constructor(state: MutableState<T>) {
		this.#state = state;
	}

	get current() {
		return this.#state.current;
	}

	setUnprotected(value: T) {
		this.#state.current = value;
	}
}
