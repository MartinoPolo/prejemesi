<script lang="ts">
	import { userPrefersMode, setMode } from 'mode-watcher';
	import { Button } from '$lib/components/base/button/index.js';
	import { SimpleTooltip } from '$lib/components/base/tooltip/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import MonitorIcon from '@lucide/svelte/icons/monitor';
	import SunIcon from '@lucide/svelte/icons/sun';

	interface DarkModeToggleProps {
		/** `icon` = bordered header button; `inline` = label + row for drawers/consolidated menus. */
		variant?: 'icon' | 'inline';
	}

	const MODES = ['light', 'dark', 'system'] as const;
	type Mode = (typeof MODES)[number];

	const MODE_LABELS: Record<Mode, () => string> = {
		light: m.mode_toggle_light,
		dark: m.mode_toggle_dark,
		system: m.mode_toggle_system,
	};

	let { variant = 'icon' }: DarkModeToggleProps = $props();

	const tooltipText = $derived(MODE_LABELS[(userPrefersMode.current as Mode) ?? 'system']());

	function cycleMode() {
		const current: Mode = userPrefersMode.current as Mode;
		const next = MODES[(MODES.indexOf(current) + 1) % MODES.length];
		setMode(next);
	}
</script>

{#snippet modeIcon()}
	{#if userPrefersMode.current === 'light'}
		<SunIcon data-icon />
	{:else if userPrefersMode.current === 'dark'}
		<MoonIcon data-icon />
	{:else}
		<MonitorIcon data-icon />
	{/if}
{/snippet}

{#if variant === 'inline'}
	<div role="group" aria-label={m.settings_dark_mode_label()} class="flex flex-col gap-1.5">
		<span class="text-(length:--text-sm) font-semibold text-foreground-muted"
			>{m.settings_dark_mode_label()}</span
		>
		<Button
			onclick={cycleMode}
			intent="outline"
			size="md"
			class="w-full justify-start"
			aria-label={tooltipText}
		>
			{@render modeIcon()}
			{tooltipText}
		</Button>
	</div>
{:else}
	<SimpleTooltip text={tooltipText} side="bottom">
		{#snippet asChild(triggerProps)}
			<Button
				{...triggerProps}
				onclick={cycleMode}
				intent="outline"
				size="icon"
				aria-label={tooltipText}
			>
				{@render modeIcon()}
			</Button>
		{/snippet}
	</SimpleTooltip>
{/if}
