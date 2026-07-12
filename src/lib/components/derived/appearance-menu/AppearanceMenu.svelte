<script lang="ts">
	import { Button } from '$lib/components/base/button/index.js';
	import * as Popover from '$lib/components/base/popover/index.js';
	import { Separator } from '$lib/components/base/separator/index.js';
	import { SimpleTooltip } from '$lib/components/base/tooltip/index.js';
	import DarkModeToggle from '$lib/components/derived/dark-mode-toggle/DarkModeToggle.svelte';
	import LanguageToggle from '$lib/components/derived/language-toggle/LanguageToggle.svelte';
	import PaletteSwitcher from '$lib/components/derived/palette-switcher/PaletteSwitcher.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import Settings2Icon from '@lucide/svelte/icons/settings-2';

	// Consolidated appearance controls (palette / language / dark mode) for narrow
	// viewports where the three separate header buttons don't fit (DECISIONS.md,
	// "Navigation: pill states, landing anchor links, mobile control consolidation").
	let isOpen = $state(false);
</script>

<Popover.Root bind:open={isOpen}>
	<SimpleTooltip text={m.appearance_menu_tooltip()} side="bottom" disabled={isOpen}>
		<Popover.Trigger>
			{#snippet child({ props })}
				<Button
					{...props}
					intent="outline"
					size="icon"
					aria-label={m.settings_appearance_title()}
				>
					<Settings2Icon data-icon />
				</Button>
			{/snippet}
		</Popover.Trigger>
	</SimpleTooltip>
	<Popover.Content
		align="end"
		class="flex w-72 min-w-0 flex-col gap-3 p-3"
		aria-label={m.settings_appearance_title()}
	>
		<PaletteSwitcher variant="inline" />
		<Separator />
		<LanguageToggle variant="inline" />
		<Separator />
		<DarkModeToggle variant="inline" />
	</Popover.Content>
</Popover.Root>
