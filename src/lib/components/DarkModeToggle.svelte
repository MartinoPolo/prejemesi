<script lang="ts">
	import { userPrefersMode, setMode } from 'mode-watcher';
	import { Button } from '$lib/components/ui/button/index.js';
	import Moon from '@lucide/svelte/icons/moon';
	import Monitor from '@lucide/svelte/icons/monitor';
	import Sun from '@lucide/svelte/icons/sun';

	const MODES = ['light', 'system', 'dark'] as const;
	type Mode = (typeof MODES)[number];

	function cycleMode() {
		const current: Mode = userPrefersMode.current as Mode;
		const next = MODES[(MODES.indexOf(current) + 1) % MODES.length];
		setMode(next);
	}
</script>

<Button
	onclick={cycleMode}
	variant="outline"
	size="icon"
	aria-label={`Toggle theme (${userPrefersMode.current})`}
>
	{#if userPrefersMode.current === 'light'}
		<Sun size={16} />
	{:else if userPrefersMode.current === 'dark'}
		<Moon size={16} />
	{:else}
		<Monitor size={16} />
	{/if}
</Button>
