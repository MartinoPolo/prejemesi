import { browser } from '$app/environment';
import { on } from 'svelte/events';
import { createSubscriber } from 'svelte/reactivity';
import { ReadonlyState, type MutableState, type ReadableState } from './state.svelte';

interface Serde<T> {
	serialize: (value: T) => string;
	deserialize: (value: string) => { success: true; data: T } | { success: false };
}

export function jsonSerde<T>(validate: (value: unknown) => value is T): Serde<T> {
	return {
		serialize: (value: T) => JSON.stringify(value),
		deserialize: (raw: string) => {
			try {
				const parsed: unknown = JSON.parse(raw);
				if (validate(parsed)) {
					return { success: true, data: parsed };
				}
				return { success: false };
			} catch {
				return { success: false };
			}
		},
	};
}

interface PersistedOptions<T> {
	key: string;
	serde: Serde<T>;
	defaultValue: NoInfer<T>;
}

/**
 * A raw state persisted in localStorage. Listens to `storage` events for cross-tab sync.
 */
export class Persisted<T> implements MutableState<T> {
	#key;
	#defaultValue;
	#subscribe;
	#update: (() => void) | undefined = undefined;
	#serde: Serde<T>;

	constructor({ key, serde, defaultValue }: PersistedOptions<T>) {
		this.#key = key;
		this.#defaultValue = defaultValue;
		this.#serde = serde;

		if (!browser) {
			return;
		}

		this.#subscribe = createSubscriber((update) => {
			this.#update = update;
			const cleanup = on(window, 'storage', (e) => {
				if (e.key === key) {
					update();
				}
			});
			return () => {
				cleanup();
				this.#update = undefined;
			};
		});
	}

	#setToStorage(value: T) {
		localStorage.setItem(this.#key, this.#serde.serialize(value));
	}

	get current(): T {
		if (!browser) {
			return this.#defaultValue;
		}
		this.#subscribe?.();
		const val = localStorage.getItem(this.#key);
		if (val == null) {
			return this.#defaultValue;
		}
		const parsed = this.#serde.deserialize(val);
		if (!parsed.success) {
			this.#setToStorage(this.#defaultValue);
			return this.#defaultValue;
		}
		return parsed.data;
	}

	set current(newValue: T) {
		this.#setToStorage(newValue);
		this.#update?.();
	}

	setDefaultValue(): void {
		this.#setToStorage(this.#defaultValue);
		this.#update?.();
	}

	readonly(): ReadableState<T> {
		return new ReadonlyState(this);
	}
}
