<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import * as Card from '$lib/components/base/card/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	import { Separator } from '$lib/components/base/separator/index.js';
	import LanguageToggle from '$lib/components/derived/language-toggle/LanguageToggle.svelte';
	import { userPrefersMode, setMode } from 'mode-watcher';
	import PaletteIcon from '@lucide/svelte/icons/palette';
	import SunIcon from '@lucide/svelte/icons/sun';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import MonitorIcon from '@lucide/svelte/icons/monitor';

	type Mode = 'light' | 'dark' | 'system';

	let currentMode = $derived((userPrefersMode.current ?? 'system') as Mode);
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
				<div class="mode-selector">
					<button
						class="mode-option"
						class:is-active={currentMode === 'light'}
						type="button"
						onclick={() => setMode('light')}
						aria-label={m.settings_mode_light()}
					>
						<SunIcon class="size-4" />
						<span>{m.settings_mode_light()}</span>
					</button>
					<button
						class="mode-option"
						class:is-active={currentMode === 'dark'}
						type="button"
						onclick={() => setMode('dark')}
						aria-label={m.settings_mode_dark()}
					>
						<MoonIcon class="size-4" />
						<span>{m.settings_mode_dark()}</span>
					</button>
					<button
						class="mode-option"
						class:is-active={currentMode === 'system'}
						type="button"
						onclick={() => setMode('system')}
						aria-label={m.settings_mode_system()}
					>
						<MonitorIcon class="size-4" />
						<span>{m.settings_mode_system()}</span>
					</button>
				</div>
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

<style>
	.mode-selector {
		display: flex;
		gap: 2px;
		background: var(--muted);
		border-radius: var(--radius-lg);
		padding: 2px;
		width: fit-content;
	}

	.mode-option {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 14px;
		border: none;
		background: transparent;
		border-radius: var(--radius-md);
		font-size: var(--text-sm);
		font-weight: var(--weight-medium);
		color: var(--muted-foreground);
		cursor: pointer;
		font-family: var(--font-sans);
		transition:
			background var(--duration-fast),
			color var(--duration-fast),
			box-shadow var(--duration-fast);
		white-space: nowrap;
	}

	.mode-option:hover {
		color: var(--foreground);
	}

	.mode-option.is-active {
		background: var(--background);
		color: var(--foreground);
		box-shadow: var(--shadow-sm);
	}
</style>
