import { onMount } from 'svelte';

const QUERY = '(max-width: 639px)';

let current = $state(false);
let mediaQuery: MediaQueryList | null = null;
let mountedConsumerCount = 0;

function updateCurrent(matches: boolean) {
	// This can run while Svelte is mounting or destroying an entire card/list view. A nested
	// flushSync during that lifecycle flush corrupts Svelte's active effect batch when the view is
	// switched with reduced motion. Assigning the rune normally keeps the shared media state
	// reactive without re-entering the scheduler.
	current = matches;
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
