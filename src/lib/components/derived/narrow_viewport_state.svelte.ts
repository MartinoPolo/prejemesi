import { flushSync, onMount } from 'svelte';

const QUERY = '(max-width: 639px)';

let current = $state(false);
let mediaQuery: MediaQueryList | null = null;
let mountedConsumerCount = 0;

function updateCurrent(matches: boolean) {
	flushSync(() => {
		current = matches;
	});
}

function handleChange(event: MediaQueryListEvent) {
	updateCurrent(event.matches);
}

export function useNarrowViewportState(): Readonly<{ current: boolean }> {
	onMount(() => {
		mountedConsumerCount += 1;

		if (mountedConsumerCount === 1) {
			mediaQuery = window.matchMedia(QUERY);
			mediaQuery.addEventListener('change', handleChange);
			updateCurrent(mediaQuery.matches);
		}

		return () => {
			mountedConsumerCount -= 1;

			if (mountedConsumerCount === 0) {
				mediaQuery?.removeEventListener('change', handleChange);
				mediaQuery = null;
				updateCurrent(false);
			}
		};
	});

	return {
		get current() {
			return current;
		},
	};
}
