import { createContext } from 'svelte';
import { StateRaw } from '$lib/reactivity/state.svelte.js';
import type { UploadProgress } from './types.js';

type UploadsContext = ReturnType<typeof createUploadsContext>;

const [useUploads, setUploadsInternal] = createContext<UploadsContext>();
export { useUploads };

export function setUploadsContext() {
	const context = createUploadsContext();
	setUploadsInternal(context);
	return context;
}

function createUploadsContext() {
	const activeUploadCount = new StateRaw(0);
	const lastProgress = new StateRaw<UploadProgress>({
		status: 'idle',
		percentage: 0,
	});

	function trackUploadStart() {
		activeUploadCount.current += 1;
	}

	function trackUploadEnd(progress: UploadProgress) {
		activeUploadCount.current = Math.max(0, activeUploadCount.current - 1);
		lastProgress.current = progress;
	}

	return {
		activeUploadCount: activeUploadCount.readonly(),
		lastProgress: lastProgress.readonly(),
		trackUploadStart,
		trackUploadEnd,
	};
}
