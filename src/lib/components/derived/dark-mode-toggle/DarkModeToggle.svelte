<script lang="ts">
	import { userPrefersMode, setMode } from 'mode-watcher';
	import { Button } from '$lib/components/base/button/index.js';
	import { SimpleTooltip } from '$lib/components/base/tooltip/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import MonitorIcon from '@lucide/svelte/icons/monitor';
	import SunIcon from '@lucide/svelte/icons/sun';

	const MODES = ['light', 'dark', 'system'] as const;
	type Mode = (typeof MODES)[number];

	const MODE_LABELS: Record<Mode, () => string> = {
		light: m.mode_toggle_light,
		dark: m.mode_toggle_dark,
		system: m.mode_toggle_system,
	};

	const tooltipText = $derived(MODE_LABELS[(userPrefersMode.current as Mode) ?? 'system']());

	function cycleMode() {
		const current: Mode = userPrefersMode.current as Mode;
		const next = MODES[(MODES.indexOf(current) + 1) % MODES.length];
		setMode(next);
	}
</script>

<SimpleTooltip text={tooltipText} side="bottom">
	{#snippet asChild(triggerProps)}
		<Button
			{...triggerProps}
			onclick={cycleMode}
			intent="ghost"
			size="icon"
			aria-label={tooltipText}
		>
			{#if userPrefersMode.current === 'light'}
				<SunIcon data-icon />
			{:else if userPrefersMode.current === 'dark'}
				<MoonIcon data-icon />
			{:else}
				<MonitorIcon data-icon />
			{/if}
		</Button>
	{/snippet}
</SimpleTooltip>
