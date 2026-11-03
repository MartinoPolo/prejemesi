<script lang="ts">
	import { HelpText } from '$lib/components/base/help-text/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import * as Card from '$lib/components/base/card/index.js';
	import SettingsSectionHeader from './SettingsSectionHeader.svelte';
	import * as SegmentedToggle from '$lib/components/derived/segmented-toggle/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	import { Separator } from '$lib/components/base/separator/index.js';
	import LanguageToggle from '$lib/components/derived/language-toggle/LanguageToggle.svelte';
	import PaletteSwitcher from '$lib/components/derived/palette-switcher/PaletteSwitcher.svelte';
	import DepthStyleSwitcher from '$lib/components/derived/depth-style-switcher/DepthStyleSwitcher.svelte';
	import { userPrefersMode, setMode } from 'mode-watcher';
	import PaletteIcon from '@lucide/svelte/icons/palette';
	import SunIcon from '@lucide/svelte/icons/sun';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import MonitorIcon from '@lucide/svelte/icons/monitor';

	type Mode = 'light' | 'dark' | 'system';

	const currentMode = $derived((userPrefersMode.current ?? 'system') as Mode);

	function handleModeChange(value: string) {
		if (value === 'light' || value === 'dark' || value === 'system') {
			setMode(value);
		}
	}
</script>

<Card.Root>
	<SettingsSectionHeader
		icon={PaletteIcon}
		title={m.settings_appearance_title()}
		description={m.settings_appearance_description()}
	/>
	<Card.Content>
		<div class="flex flex-col gap-6">
			<!-- Dark mode -->
			<div class="flex flex-col gap-2">
				<Label>{m.settings_dark_mode_label()}</Label>
				<SegmentedToggle.Root value={currentMode} onValueChange={handleModeChange}>
					<SegmentedToggle.Item value="light" aria-label={m.settings_mode_light()}>
						<SunIcon data-icon="inline-start" />
						{m.settings_mode_light()}
					</SegmentedToggle.Item>
					<SegmentedToggle.Item value="dark" aria-label={m.settings_mode_dark()}>
						<MoonIcon data-icon="inline-start" />
						{m.settings_mode_dark()}
					</SegmentedToggle.Item>
					<SegmentedToggle.Item value="system" aria-label={m.settings_mode_system()}>
						<MonitorIcon data-icon="inline-start" />
						{m.settings_mode_system()}
					</SegmentedToggle.Item>
				</SegmentedToggle.Root>
			</div>

			<Separator />

			<!-- App palette (issue #102 REQ-3): persists via setUserPalette + cookie mirror -->
			<PaletteSwitcher variant="inline" />

			<Separator />

			<DepthStyleSwitcher />

			<Separator />

			<!-- Language -->
			<LanguageToggle variant="inline" />
		</div>
	</Card.Content>
	<Card.Footer>
		<HelpText>{m.settings_appearance_autosave_hint()}</HelpText>
	</Card.Footer>
</Card.Root>
