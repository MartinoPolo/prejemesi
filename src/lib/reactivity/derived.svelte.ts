export class Derived<T> {
	#current: T;

	constructor(get: () => T) {
		this.#current = $derived.by(get);
	}

	get current() {
		return this.#current;
	}

	set current(value: T) {
		this.#current = value;
	}
}
