<script lang="ts">
	import { untrack } from 'svelte';
	import { RadioGroup } from 'bits-ui';
	import * as m from '$lib/paraglide/messages.js';
	import { isBackgroundTheme, type BackgroundTheme } from '$lib/components/base/theme/types.js';
	import { BackgroundThemePreview } from '$lib/components/base/background-theme-preview/index.js';
	import { HelpText } from '$lib/components/base/help-text/index.js';
	import { toastError } from '$lib/components/base/toast/index.js';
	import { cn } from '$lib/utils.js';
	import CheckIcon from '@lucide/svelte/icons/check';

	interface BackgroundThemeChooserProps {
		/** Initial persisted preference (REQ-2). Seeds local selection once. */
		value: BackgroundTheme;
		/** Persists the chosen theme (REQ-2). Injected so the block stays server-free. */
		onSave: (theme: BackgroundTheme) => Promise<void>;
	}

	const OPTIONS = [
		{
			value: 'default',
			label: m.settings_bg_theme_default,
			note: m.settings_bg_theme_default_note,
		},
		{
			value: 'golden-hour',
			label: m.settings_bg_theme_golden_hour,
			note: m.settings_bg_theme_golden_hour_note,
		},
		{
			value: 'twilight',
			label: m.settings_bg_theme_twilight,
			note: m.settings_bg_theme_twilight_note,
		},
	] as const satisfies ReadonlyArray<{
		value: BackgroundTheme;
		label: () => string;
		note: () => string;
	}>;

	let { value, onSave }: BackgroundThemeChooserProps = $props();

	// untrack(): the prop seeds local state once; selection diverges thereafter.
	let selected = $state(untrack(() => value));
	let savedTimer: ReturnType<typeof setTimeout> | undefined;
	let showSaved = $state(false);

	async function handleChange(next: string) {
		if (!isBackgroundTheme(next) || next === selected) {
			return;
		}

		const previous = selected;
		// Optimistic (REQ-3): the effect applies data-bg-theme to <html> live.
		selected = next;
		showSaved = false;

		try {
			await onSave(next);
			clearTimeout(savedTimer);
			showSaved = true;
			savedTimer = setTimeout(() => {
				showSaved = false;
			}, 2000);
		} catch {
			// Revert on failure – the effect restores the previous attribute.
			selected = previous;
			toastError(m.settings_bg_theme_error());
		}
	}

	// REQ-3/REQ-5: drive ONLY data-bg-theme on the app root. The `.dark` class
	// (color mode) is owned by mode-watcher on the same element and never touched
	// here – the two axes (tint vs brightness) stay orthogonal.
	$effect(() => {
		document.documentElement.setAttribute('data-bg-theme', selected);
	});

	$effect(() => {
		return () => clearTimeout(savedTimer);
	});
</script>

<div class="flex flex-col gap-2">
	<div class="flex items-center gap-2">
		<span class="text-sm font-medium">{m.settings_bg_theme_label()}</span>
		<!-- Live region stays mounted (empty) so screen readers announce the change. -->
		<span class="flex items-center gap-1 text-xs text-status-success" aria-live="polite">
			{#if showSaved}
				<CheckIcon class="size-3" />
				{m.settings_bg_theme_saved()}
			{/if}
		</span>
	</div>

	<RadioGroup.Root
		value={selected}
		onValueChange={handleChange}
		aria-label={m.settings_bg_theme_label()}
		class="grid grid-cols-3 gap-4"
	>
		{#each OPTIONS as option (option.value)}
			<RadioGroup.Item
				value={option.value}
				aria-label={option.label()}
				class={cn(
					'group relative cursor-pointer rounded-lg border-[1.5px] border-border bg-surface p-2.5 text-left outline-none transition-all',
					'hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md',
					'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring',
					'active:scale-[0.97]',
					'data-[state=checked]:border-primary data-[state=checked]:shadow-[0_0_0_3px_color-mix(in_oklch,var(--primary)_25%,transparent)]',
				)}
			>
				{#snippet children({ checked })}
					{#if checked}
						<span
							class="absolute top-2.5 right-2.5 z-[1] grid size-[22px] place-items-center rounded-full bg-primary text-primary-foreground"
							aria-hidden="true"
						>
							<CheckIcon class="size-3" />
						</span>
					{/if}
					<BackgroundThemePreview theme={option.value} />
					<div class="px-1 pt-2.5">
						<div class="text-base font-semibold text-foreground">{option.label()}</div>
						<div class="text-xs text-foreground-subtle">{option.note()}</div>
					</div>
				{/snippet}
			</RadioGroup.Item>
		{/each}
	</RadioGroup.Root>

	<HelpText>{m.settings_bg_theme_description()}</HelpText>
</div>
