<script module lang="ts">
	// Persistence order must span every mounted appearance surface, not just one component instance.
	let persistenceQueue: Promise<void> = Promise.resolve();
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import { HelpText } from '$lib/components/base/help-text/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	import * as SegmentedToggle from '$lib/components/derived/segmented-toggle/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils.js';
	import { setUserDarkWishlistBackground } from '$lib/modules/settings/settings.remote.js';
	import {
		DARK_WISHLIST_BACKGROUNDS,
		DEFAULT_DARK_WISHLIST_BACKGROUND,
		isDarkWishlistBackground,
		type DarkWishlistBackground,
	} from '$lib/theme/dark_wishlist_background.js';

	const DARK_WISHLIST_BACKGROUND_CHANGE_EVENT = 'app-dark-wishlist-background-change';
	const labelId = $props.id();
	let selected = $state<DarkWishlistBackground>(DEFAULT_DARK_WISHLIST_BACKGROUND);
	let synchronized = $state(false);

	const labels: Record<DarkWishlistBackground, () => string> = {
		wishlist: m.dark_wishlist_background_wishlist,
		app: m.dark_wishlist_background_app,
		tint: m.dark_wishlist_background_tint,
	};

	onMount(() => {
		const initial = document.documentElement.dataset.darkWishlistBackground;
		if (isDarkWishlistBackground(initial)) {
			selected = initial;
		}
		synchronized = true;

		const synchronize = (event: Event) => {
			const value = (event as CustomEvent<DarkWishlistBackground>).detail;
			if (isDarkWishlistBackground(value)) {
				selected = value;
			}
		};
		window.addEventListener(DARK_WISHLIST_BACKGROUND_CHANGE_EVENT, synchronize);
		return () => window.removeEventListener(DARK_WISHLIST_BACKGROUND_CHANGE_EVENT, synchronize);
	});

	function persistDarkWishlistBackground(value: DarkWishlistBackground) {
		persistenceQueue = persistenceQueue
			.then(() => setUserDarkWishlistBackground(value))
			.catch((error) => {
				console.error(
					'[DarkWishlistBackgroundSwitcher] failed to persist dark wishlist background',
					error,
				);
			});
	}

	function selectDarkWishlistBackground(value: string) {
		if (
			!isDarkWishlistBackground(value) ||
			value === document.documentElement.dataset.darkWishlistBackground
		) {
			return;
		}

		selected = value;
		document.documentElement.dataset.darkWishlistBackground = value;
		window.dispatchEvent(
			new CustomEvent<DarkWishlistBackground>(DARK_WISHLIST_BACKGROUND_CHANGE_EVENT, {
				detail: value,
			}),
		);
		persistDarkWishlistBackground(value);
	}
</script>

<div class="flex flex-col gap-2">
	<Label id={labelId}>{m.dark_wishlist_background_label()}</Label>
	<!-- Three labels cannot share one phone-width row at the fixed control height, so they stack. -->
	<SegmentedToggle.Root
		width="fill"
		aria-labelledby={labelId}
		value={selected}
		onValueChange={selectDarkWishlistBackground}
		class={cn('max-sm:grid max-sm:h-auto max-sm:grid-cols-1', !synchronized && 'invisible')}
		aria-hidden={!synchronized}
	>
		{#each DARK_WISHLIST_BACKGROUNDS as background (background)}
			<SegmentedToggle.Item value={background} class="max-sm:h-(--size-control-lg)">
				{labels[background]()}
			</SegmentedToggle.Item>
		{/each}
	</SegmentedToggle.Root>
	<HelpText>{m.dark_wishlist_background_help()}</HelpText>
</div>
