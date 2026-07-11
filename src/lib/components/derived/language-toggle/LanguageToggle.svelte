<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Button } from '$lib/components/base/button/index.js';
	import * as Popover from '$lib/components/base/popover/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import { localizeCurrentHref } from '$lib/i18n/locale.js';
	import { updatePreferredLocale } from '$lib/modules/settings/settings.remote.js';
	import { getLocaleForUrl, locales, setLocale, type Locale } from '$lib/paraglide/runtime.js';
	import { cn } from '$lib/utils.js';
	import CheckIcon from '@lucide/svelte/icons/check';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import LanguageFlag from './LanguageFlag.svelte';

	interface LanguageToggleProps {
		variant?: 'wide' | 'icon';
	}

	let { variant = 'wide' }: LanguageToggleProps = $props();

	const LOCALE_META: Record<Locale, { label: () => string }> = {
		cs: { label: m.settings_language_cs },
		en: { label: m.settings_language_en },
	};

	/** Short codes for the compact header trigger (flags appear only in the dropdown items). */
	const LOCALE_CODES: Record<Locale, string> = {
		cs: 'CZ',
		en: 'EN',
	};

	const LOCALE_SORT_ORDER: Record<Locale, number> = {
		cs: 0,
		en: 1,
	};

	const availableLocales = [...locales].sort(
		(a, b) => LOCALE_SORT_ORDER[a] - LOCALE_SORT_ORDER[b],
	);
	const currentLocale = $derived(getLocaleForUrl(page.url.href));
	const currentLanguage = $derived(LOCALE_META[currentLocale]);
	const currentLabel = $derived(currentLanguage.label());
	const isIconVariant = $derived(variant === 'icon');
	const ariaLabel = $derived(`${m.settings_language_label()}: ${currentLabel}`);
	const isLoggedIn = $derived(page.data.user != null);

	let isOpen = $state(false);
	let triggerElement = $state<HTMLSpanElement | null>(null);
	let contentElement = $state<HTMLDivElement | null>(null);
	let isSwitchingLocale = $state(false);
	let closeTimer: number | undefined = undefined;

	function clearCloseTimer() {
		if (closeTimer !== undefined) {
			window.clearTimeout(closeTimer);
			closeTimer = undefined;
		}
	}

	function openMenu() {
		clearCloseTimer();
		isOpen = true;
	}

	function queueClose() {
		clearCloseTimer();
		closeTimer = window.setTimeout(() => {
			isOpen = false;
			closeTimer = undefined;
		}, 120);
	}

	function containsMouseTarget(target: EventTarget | null) {
		return (
			target instanceof Node &&
			(triggerElement?.contains(target) === true || contentElement?.contains(target) === true)
		);
	}

	function handleMouseOut(event: MouseEvent) {
		if (containsMouseTarget(event.relatedTarget)) {
			return;
		}

		queueClose();
	}

	function handleFocusOut(event: FocusEvent) {
		if (containsMouseTarget(event.relatedTarget)) {
			return;
		}

		queueClose();
	}

	async function handleLocaleChange(newLocale: Locale) {
		isOpen = false;
		clearCloseTimer();
		if (newLocale === currentLocale || isSwitchingLocale) {
			return;
		}

		const nextHref = localizeCurrentHref(page.url, newLocale);

		isSwitchingLocale = true;
		setLocale(newLocale, { reload: false });

		try {
			if (isLoggedIn) {
				await updatePreferredLocale({ preferredLocale: newLocale });
			}
			await goto(nextHref, { noScroll: true });
		} catch {
			window.location.href = nextHref;
		} finally {
			isSwitchingLocale = false;
		}
	}
</script>

<div role="group" aria-label={ariaLabel}>
	<Popover.Root bind:open={isOpen}>
		<span
			bind:this={triggerElement}
			role="presentation"
			class="inline-flex"
			onmouseover={openMenu}
			onmouseout={handleMouseOut}
			onfocus={openMenu}
			onblur={handleFocusOut}
			onfocusin={openMenu}
			onfocusout={handleFocusOut}
		>
			<Popover.Trigger>
				{#snippet child({ props })}
					<Button
						{...props}
						intent="outline"
						size="md"
						class={cn(!isIconVariant && 'w-40 justify-between')}
						aria-label={ariaLabel}
						title={ariaLabel}
					>
						<span>{isIconVariant ? LOCALE_CODES[currentLocale] : currentLabel}</span>
						<ChevronDownIcon data-icon class="opacity-60" />
					</Button>
				{/snippet}
			</Popover.Trigger>
		</span>
		<Popover.Content
			bind:ref={contentElement}
			align={isIconVariant ? 'end' : 'start'}
			class="w-44 min-w-0 p-1"
			role="menu"
			aria-label={m.settings_language_label()}
			onmouseover={openMenu}
			onmouseout={handleMouseOut}
			onfocus={openMenu}
			onblur={handleFocusOut}
		>
			{#each availableLocales as locale (locale)}
				{@const language = LOCALE_META[locale]}
				<Popover.Item
					class="justify-between"
					active={locale === currentLocale}
					aria-current={locale === currentLocale ? 'true' : undefined}
					aria-disabled={isSwitchingLocale ? 'true' : undefined}
					onclick={() => handleLocaleChange(locale)}
				>
					<span class="flex items-center gap-2">
						<LanguageFlag {locale} />
						<span>{language.label()}</span>
					</span>
					{#if locale === currentLocale}
						<CheckIcon class="size-4 text-primary" aria-hidden="true" />
					{/if}
				</Popover.Item>
			{/each}
		</Popover.Content>
	</Popover.Root>
</div>
