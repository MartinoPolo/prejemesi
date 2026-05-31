<script lang="ts">
	import * as Select from '$lib/components/base/select/index.js';
	import { getLocale, setLocale, locales, type Locale } from '$lib/paraglide/runtime.js';
	import GlobeIcon from '@lucide/svelte/icons/globe';

	const LOCALE_LABELS: Record<Locale, string> = {
		cs: 'Čeština',
		en: 'English',
	};

	let currentLocale = $derived(getLocale());

	function handleLocaleChange(newLocale: string | undefined) {
		if (newLocale != null && newLocale !== '' && newLocale !== currentLocale) {
			setLocale(newLocale as Locale);
		}
	}
</script>

<div class="flex items-center gap-3">
	<GlobeIcon class="size-4 shrink-0 text-muted-foreground" />
	<Select.Root type="single" value={currentLocale} onValueChange={handleLocaleChange}>
		<Select.Trigger class="w-40">
			{LOCALE_LABELS[currentLocale]}
		</Select.Trigger>
		<Select.Content>
			<Select.Group>
				{#each locales as locale (locale)}
					<Select.Item value={locale}>{LOCALE_LABELS[locale]}</Select.Item>
				{/each}
			</Select.Group>
		</Select.Content>
	</Select.Root>
</div>
