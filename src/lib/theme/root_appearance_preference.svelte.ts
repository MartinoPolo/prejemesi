import { onMount } from 'svelte';

type RootDatasetKey = 'depth' | 'darkWishlistBackground';

// Persistence order must span every mounted surface of a preference, not just one component instance.
const persistenceQueues: Record<RootDatasetKey, Promise<void>> = {
	depth: Promise.resolve(),
	darkWishlistBackground: Promise.resolve(),
};

/**
 * One viewer appearance preference mirrored on `<html>`: every mounted control shows the same
 * choice, applies it before paint and persists changes in order. Construct during component init.
 */
export class RootAppearancePreference<Value extends string> {
	selected = $state() as Value;
	/** False until the control has read the server-rendered value, so it never flashes the default. */
	synchronized = $state(false);

	readonly #datasetKey: RootDatasetKey;
	readonly #changeEvent: string;
	readonly #isValue: (value: unknown) => value is Value;
	readonly #persist: (value: Value) => Promise<unknown>;
	readonly #description: string;

	constructor(options: {
		datasetKey: RootDatasetKey;
		isValue: (value: unknown) => value is Value;
		fallback: Value;
		persist: (value: Value) => Promise<unknown>;
		/** Names the preference in the persistence error log. */
		description: string;
	}) {
		this.#datasetKey = options.datasetKey;
		this.#changeEvent = `app-${options.datasetKey.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}-change`;
		this.#isValue = options.isValue;
		this.#persist = options.persist;
		this.#description = options.description;
		this.selected = options.fallback;

		onMount(() => {
			const initial = this.current;
			if (initial !== undefined) {
				this.selected = initial;
			}
			this.synchronized = true;

			const synchronize = (event: Event) => {
				const value = (event as CustomEvent<unknown>).detail;
				if (this.#isValue(value)) {
					this.selected = value;
				}
			};
			window.addEventListener(this.#changeEvent, synchronize);
			return () => window.removeEventListener(this.#changeEvent, synchronize);
		});
	}

	/** The value applied on `<html>`, if valid. */
	get current(): Value | undefined {
		const value = document.documentElement.dataset[this.#datasetKey];
		return this.#isValue(value) ? value : undefined;
	}

	/** Applies, broadcasts and persists a new choice; ignores invalid and unchanged values. */
	select(value: string) {
		if (!this.#isValue(value) || value === document.documentElement.dataset[this.#datasetKey]) {
			return;
		}
		this.selected = value;
		document.documentElement.dataset[this.#datasetKey] = value;
		window.dispatchEvent(new CustomEvent<Value>(this.#changeEvent, { detail: value }));
		persistenceQueues[this.#datasetKey] = persistenceQueues[this.#datasetKey]
			.then(() => this.#persist(value))
			.then(
				() => undefined,
				(error: unknown) => {
					console.error(`[appearance] failed to persist ${this.#description}`, error);
				},
			);
	}
}
