<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import * as Select from '$lib/components/base/select/index.js';
	import { DatePicker } from '$lib/components/derived/date-picker/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	import { HelpText } from '$lib/components/base/help-text/index.js';
	import WishlistOccasionField from './WishlistOccasionField.svelte';
	import { WISHLIST_OCCASION, type WishlistOccasion } from '$lib/modules/wishlists/types.js';
	import { eventDateAfterOccasionChange } from '$lib/modules/wishlists/wishlist_occasion.js';
	import {
		WISHLIST_THEME_IDS,
		isWishlistThemeId,
		type WishlistThemeId,
	} from '$lib/theme/wishlist_themes.js';
	import { wishlistThemeName } from '$lib/theme/wishlist_theme_messages.js';

	interface CreateWishlistOccasionSectionProps {
		occasion: WishlistOccasion;
		eventDate: Date | null;
		/** True while the date is the occasion's pre-fill, which a later occasion change may replace. */
		eventDatePrefilled: boolean;
		/** Undefined follows the suggested motif; null is an explicit "no motif". */
		chosenThemeId: WishlistThemeId | null | undefined;
		suggestedThemeId: WishlistThemeId | null;
		disabled?: boolean;
	}

	let {
		occasion = $bindable(),
		eventDate = $bindable(),
		eventDatePrefilled = $bindable(),
		chosenThemeId = $bindable(),
		suggestedThemeId,
		disabled = false,
	}: CreateWishlistOccasionSectionProps = $props();

	/** Select value of "no motif"; never a registry id. */
	const NO_THEME_VALUE = 'no-theme';

	const isPermanent = $derived(occasion === WISHLIST_OCCASION.permanent);
	const selectedThemeId = $derived(
		chosenThemeId === undefined ? suggestedThemeId : chosenThemeId,
	);
	const showsSuggestionHint = $derived(chosenThemeId === undefined && suggestedThemeId !== null);

	function themeLabel(themeId: WishlistThemeId | null): string {
		return themeId === null ? m.wishlist_appearance_no_theme() : wishlistThemeName(themeId);
	}

	function selectOccasion(nextOccasion: WishlistOccasion) {
		occasion = nextOccasion;
		({ eventDate, eventDatePrefilled } = eventDateAfterOccasionChange(
			nextOccasion,
			{ eventDate, eventDatePrefilled },
			new Date(),
		));
	}

	function selectTheme(selected: string) {
		if (selected === NO_THEME_VALUE) {
			chosenThemeId = null;
		} else if (isWishlistThemeId(selected)) {
			chosenThemeId = selected;
		}
	}
</script>

<WishlistOccasionField
	id="wishlist-create-occasion"
	value={occasion}
	onvaluechange={selectOccasion}
	{disabled}
/>

{#if !isPermanent}
	<div class="flex flex-col gap-2">
		<Label id="wishlist-event-date-label">{m.wishlist_event_date_label()}</Label>
		<DatePicker
			id="wishlist-event-date"
			ariaLabelledby="wishlist-event-date-label"
			ariaDescribedby="wishlist-event-date-helper"
			size="lg"
			bind:value={
				() => eventDate,
				(pickedDate) => {
					eventDate = pickedDate;
					eventDatePrefilled = false;
				}
			}
			{disabled}
		/>
		<HelpText id="wishlist-event-date-helper"
			>{eventDatePrefilled
				? m.wishlist_event_date_prefilled_hint()
				: m.wishlist_event_date_helper()}</HelpText
		>
	</div>
{/if}

<div class="flex flex-col gap-2">
	<Label for="wishlist-create-theme">{m.wishlist_appearance_theme_heading()}</Label>
	<Select.Root
		type="single"
		value={selectedThemeId ?? NO_THEME_VALUE}
		onValueChange={selectTheme}
		{disabled}
	>
		<Select.Trigger
			id="wishlist-create-theme"
			size="lg"
			class="w-full"
			aria-describedby={showsSuggestionHint ? 'wishlist-create-theme-helper' : undefined}
		>
			{themeLabel(selectedThemeId)}
		</Select.Trigger>
		<Select.Content>
			<Select.Group>
				<Select.Item value={NO_THEME_VALUE} label={themeLabel(null)}>
					{themeLabel(null)}
				</Select.Item>
				{#each WISHLIST_THEME_IDS as themeId (themeId)}
					<Select.Item value={themeId} label={themeLabel(themeId)}>
						{themeLabel(themeId)}
					</Select.Item>
				{/each}
			</Select.Group>
		</Select.Content>
	</Select.Root>
	{#if showsSuggestionHint}
		<HelpText id="wishlist-create-theme-helper">{m.create_theme_suggested_hint()}</HelpText>
	{/if}
</div>
