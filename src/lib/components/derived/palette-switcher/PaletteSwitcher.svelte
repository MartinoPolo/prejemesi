<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/base/button/index.js';
	import * as Popover from '$lib/components/base/popover/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import { setUserPalette } from '$lib/modules/settings/settings.remote.js';
	import {
		DEFAULT_PALETTE,
		PALETTES,
		PALETTE_LABELS,
		PALETTE_SWATCHES,
		isPalette,
		type Palette,
	} from '$lib/theme/palettes.js';
	import { cn } from '$lib/utils.js';

	let isOpen = $state(false);
	// SSR renders the viewer's palette as `data-palette` on <html> (hooks.server.ts);
	// the client picks it up here to mark the current selection.
	let currentPalette = $state<Palette>(DEFAULT_PALETTE);

	onMount(() => {
		const domPalette = document.documentElement.dataset.palette;
		if (isPalette(domPalette)) {
			currentPalette = domPalette;
		}
	});

	async function selectPalette(palette: Palette) {
		isOpen = false;
		if (palette === currentPalette) {
			return;
		}

		currentPalette = palette;
		// Instant feedback: retheme the whole page before the server round-trip.
		document.documentElement.dataset.palette = palette;

		try {
			await setUserPalette(palette);
		} catch (err) {
			// The page is already themed; only persistence failed (retried on next change).
			console.error('[PaletteSwitcher] failed to persist palette', err);
		}
	}
</script>

<Popover.Root bind:open={isOpen}>
	<Popover.Trigger>
		{#snippet child({ props })}
			<Button
				{...props}
				intent="outline"
				size="icon"
				aria-label={m.palette_switcher_label()}
				title={m.palette_switcher_label()}
			>
				<!-- Dot inherits the active palette via the cascade (--primary = --p-brand). -->
				<span
					class="size-4 shrink-0 rounded-full border-2 border-ink bg-primary"
					aria-hidden="true"
				></span>
			</Button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content align="end" class="w-66 min-w-0 p-2.5" aria-label={m.palette_switcher_label()}>
		<Popover.Label>{m.palette_switcher_label()}</Popover.Label>
		<div class="grid grid-cols-2 gap-1">
			{#each PALETTES as palette (palette)}
				<button
					type="button"
					class={cn(
						'flex cursor-pointer items-center gap-2 rounded-btn border-2 border-transparent px-2 py-1.5 text-left text-(length:--text-sm) font-semibold text-foreground transition-colors',
						'hover:bg-accent focus-visible:bg-accent focus-visible:outline-none',
						palette === currentPalette && 'border-ink bg-accent',
					)}
					aria-pressed={palette === currentPalette}
					onclick={() => selectPalette(palette)}
				>
					<span
						class="size-4 shrink-0 rounded-full border-2 border-ink"
						style:background-color={PALETTE_SWATCHES[palette]}
						aria-hidden="true"
					></span>
					{PALETTE_LABELS[palette]}
				</button>
			{/each}
		</div>
	</Popover.Content>
</Popover.Root>
