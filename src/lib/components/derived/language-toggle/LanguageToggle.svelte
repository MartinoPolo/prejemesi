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
		/** `wide`/`icon` = popover trigger in headers; `inline` = label + rows for drawers/consolidated menus. */
		variant?: 'wide' | 'icon' | 'inline';
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

{#if variant === 'inline'}
	<div role="group" aria-label={m.settings_language_label()} class="flex flex-col gap-1.5">
		<span class="text-(length:--text-sm) font-semibold text-foreground-muted"
			>{m.settings_language_label()}</span
		>
		<div class="grid gap-1">
			{#each availableLocales as locale (locale)}
				{@const language = LOCALE_META[locale]}
				<button
					type="button"
					class={cn(
						'flex cursor-pointer items-center gap-2 rounded-btn border-2 border-transparent px-2 py-1.5 text-left text-(length:--text-sm) font-semibold text-foreground transition-colors',
						'hover:bg-accent focus-visible:bg-accent focus-visible:outline-none',
						locale === currentLocale && 'border-ink bg-accent',
					)}
					aria-pressed={locale === currentLocale}
					aria-disabled={isSwitchingLocale ? 'true' : undefined}
					onclick={() => handleLocaleChange(locale)}
				>
					<LanguageFlag {locale} />
					<span class="flex-1">{language.label()}</span>
					{#if locale === currentLocale}
						<CheckIcon class="size-4 text-primary" aria-hidden="true" />
					{/if}
				</button>
			{/each}
		</div>
	</div>
{:else}
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
							<span>{isIconVariant ? LOCALE_CODES[currentLocale] : currentLabel}</span
							>
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
{/if}
