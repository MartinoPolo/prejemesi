import { hasContext, setContext } from 'svelte';

const sharedTooltipProviderKey = Symbol('shared tooltip provider');

export function markSharedTooltipProvider() {
	setContext(sharedTooltipProviderKey, true);
}

export function hasSharedTooltipProvider(): boolean {
	return hasContext(sharedTooltipProviderKey);
}
