<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import * as Card from '$lib/components/base/card/index.js';
	import * as ToggleGroup from '$lib/components/base/toggle-group/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	import { Separator } from '$lib/components/base/separator/index.js';
	import LanguageToggle from '$lib/components/derived/language-toggle/LanguageToggle.svelte';
	import PaletteSwitcher from '$lib/components/derived/palette-switcher/PaletteSwitcher.svelte';
	import { userPrefersMode, setMode } from 'mode-watcher';
	import PaletteIcon from '@lucide/svelte/icons/palette';
	import SunIcon from '@lucide/svelte/icons/sun';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import MonitorIcon from '@lucide/svelte/icons/monitor';

	type Mode = 'light' | 'dark' | 'system';

	const currentMode = $derived((userPrefersMode.current ?? 'system') as Mode);

	// Bits UI's ToggleGroup.Root (type="single") mutates its own bindable `value`
	// on every click, including a re-click of the already-active item (see
	// GiftViewSwitcher.svelte for the full root-cause note). Passing `currentMode`
	// as a plain prop leaves the group uncontrolled, so that transient deselect is
	// never undone. A local `selected` state kept in sync with `currentMode` makes
	// the rendered state always resolvable, and resetting `selected` inside
	// handleModeChange undoes the deselect before Svelte flushes the DOM.
	// svelte-ignore state_referenced_locally (intentional one-time seed; kept in sync below)
	let selected = $state(currentMode);
	$effect(() => {
		selected = currentMode;
	});

	function handleModeChange(value: string) {
		if (value === '') {
			selected = currentMode;
			return;
		}
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
					bind:value={selected}
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

			<!-- App palette (issue #102 REQ-3): persists via setUserPalette + cookie mirror -->
			<PaletteSwitcher variant="inline" />

			<Separator />

			<!-- Language -->
			<LanguageToggle variant="inline" />
		</div>
	</Card.Content>
	<Card.Footer>
		<p class="text-sm text-muted-foreground">{m.settings_appearance_autosave_hint()}</p>
	</Card.Footer>
</Card.Root>
