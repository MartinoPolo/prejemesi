<script lang="ts">
	import type { Snippet } from 'svelte';
	import {
		ACCENT_COLORS,
		BACKGROUND_THEMES,
		THEME_MODES,
		type ThemeMode,
		type AccentColor,
		type BackgroundTheme,
	} from '$lib/components/base/theme/types.js';
	import * as Tooltip from '$lib/components/base/tooltip/index.js';

	let { children }: { children: Snippet } = $props();

	let themeMode = $state<ThemeMode>('light');
	let accentColor = $state<AccentColor>('moss');
	let backgroundTheme = $state<BackgroundTheme>('default');

	const isDark = $derived(
		themeMode === 'dark' ||
			(themeMode === 'system' &&
				typeof window !== 'undefined' &&
				window.matchMedia('(prefers-color-scheme: dark)').matches),
	);

	$effect(() => {
		const rootElement = document.documentElement;
		const previousColorScheme = rootElement.style.colorScheme;
		const previousAccentColor = rootElement.getAttribute('data-accent');
		const previousBackgroundTheme = rootElement.getAttribute('data-bg-theme');
		const hadDarkClass = rootElement.classList.contains('dark');
		const hadLightClass = rootElement.classList.contains('light');

		rootElement.classList.toggle('dark', isDark);
		rootElement.classList.toggle('light', !isDark);
		rootElement.style.colorScheme = isDark ? 'dark' : 'light';
		rootElement.setAttribute('data-accent', accentColor);

		if (backgroundTheme === 'default') {
			rootElement.removeAttribute('data-bg-theme');
		} else {
			rootElement.setAttribute('data-bg-theme', backgroundTheme);
		}

		return () => {
			rootElement.classList.toggle('dark', hadDarkClass);
			rootElement.classList.toggle('light', hadLightClass);
			rootElement.style.colorScheme = previousColorScheme;

			if (previousAccentColor == null) {
				rootElement.removeAttribute('data-accent');
			} else {
				rootElement.setAttribute('data-accent', previousAccentColor);
			}

			if (previousBackgroundTheme == null) {
				rootElement.removeAttribute('data-bg-theme');
			} else {
				rootElement.setAttribute('data-bg-theme', previousBackgroundTheme);
			}
		};
	});
</script>

<div class="min-h-screen bg-background text-foreground">
	<div class="flex flex-col gap-4 p-4">
		<div class="flex flex-wrap items-center gap-4 border-b border-border pb-3">
			<div class="flex items-center gap-2">
				<span class="text-sm font-medium text-muted-foreground">Theme:</span>
				{#each THEME_MODES as mode (mode)}
					<button
						class="rounded px-2 py-1 text-xs capitalize {themeMode === mode
							? 'bg-primary text-primary-foreground'
							: 'bg-muted text-muted-foreground'}"
						onclick={() => (themeMode = mode)}
					>
						{mode}
					</button>
				{/each}
			</div>
			<div class="flex items-center gap-2">
				<span class="text-sm font-medium text-muted-foreground">Accent:</span>
				{#each ACCENT_COLORS as accent (accent)}
					<button
						class="rounded px-2 py-1 text-xs capitalize {accentColor === accent
							? 'bg-primary text-primary-foreground'
							: 'bg-muted text-muted-foreground'}"
						onclick={() => (accentColor = accent)}
					>
						{accent}
					</button>
				{/each}
			</div>
			<div class="flex items-center gap-2">
				<span class="text-sm font-medium text-muted-foreground">Background:</span>
				{#each BACKGROUND_THEMES as bgTheme (bgTheme)}
					<button
						class="rounded px-2 py-1 text-xs capitalize {backgroundTheme === bgTheme
							? 'bg-primary text-primary-foreground'
							: 'bg-muted text-muted-foreground'}"
						onclick={() => (backgroundTheme = bgTheme)}
					>
						{bgTheme}
					</button>
				{/each}
			</div>
		</div>
		<Tooltip.Provider delayDuration={600}>
			<div class="rounded-lg p-6">
				{@render children()}
			</div>
		</Tooltip.Provider>
	</div>
</div>
