import type { Component } from 'svelte';

// `never` props let any component satisfy the constraint, whatever props it declares.
export type AnyComponent = Component<never, Record<string, unknown>, string>;

export type ComponentImporter<LoadedComponent extends AnyComponent> = () => Promise<{
	default: LoadedComponent;
}>;

/** A component split into its own chunk, imported on first use and shared by every caller. */
export class LazyComponent<LoadedComponent extends AnyComponent> {
	component = $state.raw<LoadedComponent>();
	#importComponent: ComponentImporter<LoadedComponent>;
	#loading: Promise<LoadedComponent> | undefined;

	constructor(importComponent: ComponentImporter<LoadedComponent>) {
		this.#importComponent = importComponent;
	}

	load(): Promise<LoadedComponent> {
		this.#loading ??= this.#importComponent().then(
			(module) => {
				this.component = module.default;
				return module.default;
			},
			(error: unknown) => {
				this.#loading = undefined;
				throw error;
			},
		);
		return this.#loading;
	}

	/** Starts the import on intent; a failure surfaces only once the component is needed. */
	preload = (): void => {
		this.load().catch(() => undefined);
	};
}

export function lazyComponent<LoadedComponent extends AnyComponent>(
	importComponent: ComponentImporter<LoadedComponent>,
): LazyComponent<LoadedComponent> {
	return new LazyComponent(importComponent);
}
