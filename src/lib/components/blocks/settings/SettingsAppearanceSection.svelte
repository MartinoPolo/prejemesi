<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import * as Card from '$lib/components/base/card/index.js';
	import * as ToggleGroup from '$lib/components/base/toggle-group/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	import { Separator } from '$lib/components/base/separator/index.js';
	import LanguageToggle from '$lib/components/derived/language-toggle/LanguageToggle.svelte';
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
	<Card.Header>
		<div class="flex items-center gap-2">
			<PaletteIcon class="size-5 text-muted-foreground" />
			<div>
				<Card.Title>{m.settings_appearance_title()}</Card.Title>
				<Card.Description>{m.settings_appearance_description()}</Card.Description>
			</div>
		</div>
	</Card.Header>
	<Card.Content>
		<div class="flex flex-col gap-6">
			<!-- Dark mode -->
			<div class="flex flex-col gap-2">
				<Label>{m.settings_dark_mode_label()}</Label>
				<ToggleGroup.Root
					type="single"
					value={currentMode}
					onValueChange={handleModeChange}
				>
					<ToggleGroup.Item value="light" aria-label={m.settings_mode_light()}>
						<SunIcon data-icon="inline-start" />
						{m.settings_mode_light()}
					</ToggleGroup.Item>
					<ToggleGroup.Item value="dark" aria-label={m.settings_mode_dark()}>
						<MoonIcon data-icon="inline-start" />
						{m.settings_mode_dark()}
					</ToggleGroup.Item>
					<ToggleGroup.Item value="system" aria-label={m.settings_mode_system()}>
						<MonitorIcon data-icon="inline-start" />
						{m.settings_mode_system()}
					</ToggleGroup.Item>
				</ToggleGroup.Root>
			</div>

			<Separator />

			<!-- Language -->
			<div class="flex flex-col gap-2">
				<Label>{m.settings_language_label()}</Label>
				<LanguageToggle />
			</div>
		</div>
	</Card.Content>
</Card.Root>
