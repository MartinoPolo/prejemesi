<script lang="ts">
	import { RadioGroup as RadioGroupPrimitive } from 'bits-ui';
	import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { HelpText } from '$lib/components/base/help-text/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	import {
		WISHLIST_HEADING_FONTS,
		type WishlistBorderStyle,
		type WishlistCornerStyle,
		type WishlistHeadingFont,
		type WishlistImageMat,
		type WishlistStyleTokens,
	} from '$lib/theme/wishlist_themes.js';
	import WishlistAppearanceOptionRow from './WishlistAppearanceOptionRow.svelte';
	import { wishlistAppearanceChoiceVariants } from './wishlist_appearance_choice_variants.js';

	interface WishlistStyleTokenEditorProps {
		/** The resolved look: theme defaults merged under the overrides. */
		style: WishlistStyleTokens;
		hasOverrides: boolean;
		onchange: <Token extends keyof WishlistStyleTokens>(
			token: Token,
			value: WishlistStyleTokens[Token],
		) => void;
		onreset: () => void;
		disabled?: boolean;
	}

	const CORNER_OPTIONS = [
		{ value: 'round', label: m.wishlist_appearance_corners_round() },
		{ value: 'soft', label: m.wishlist_appearance_corners_soft() },
		{ value: 'sharp', label: m.wishlist_appearance_corners_sharp() },
	] satisfies { value: WishlistCornerStyle; label: string }[];
	const BORDER_OPTIONS = [
		{ value: 'bold', label: m.wishlist_appearance_border_bold() },
		{ value: 'fine', label: m.wishlist_appearance_border_fine() },
	] satisfies { value: WishlistBorderStyle; label: string }[];
	const MAT_OPTIONS = [
		{ value: 'dotted', label: m.wishlist_appearance_mat_dotted() },
		{ value: 'white', label: m.wishlist_appearance_mat_white() },
		{ value: 'black', label: m.wishlist_appearance_mat_black() },
	] satisfies { value: WishlistImageMat; label: string }[];
	const HEADING_FONT_LABELS = {
		playful: m.wishlist_appearance_heading_playful,
		elegant: m.wishlist_appearance_heading_elegant,
		plain: m.wishlist_appearance_heading_plain,
		hand: m.wishlist_appearance_heading_hand,
	} satisfies Record<WishlistHeadingFont, () => string>;

	let {
		style,
		hasOverrides,
		onchange,
		onreset,
		disabled = false,
	}: WishlistStyleTokenEditorProps = $props();

	const choiceStyles = wishlistAppearanceChoiceVariants();
	let selectedHeadingFont = $derived<string>(style.heading);

	function handleHeadingFontChange(nextValue: string) {
		const font = WISHLIST_HEADING_FONTS.find((candidate) => candidate === nextValue);
		if (font === undefined) {
			selectedHeadingFont = style.heading;
			return;
		}
		onchange('heading', font);
	}
</script>

<div class="flex flex-col gap-4">
	<WishlistAppearanceOptionRow
		id="wishlist-appearance-corners"
		label={m.wishlist_appearance_corners_label()}
		value={style.corners}
		options={CORNER_OPTIONS}
		onchange={(value) => onchange('corners', value)}
		{disabled}
	/>
	<WishlistAppearanceOptionRow
		id="wishlist-appearance-border"
		label={m.wishlist_appearance_border_label()}
		value={style.border}
		options={BORDER_OPTIONS}
		onchange={(value) => onchange('border', value)}
		{disabled}
	/>
	<WishlistAppearanceOptionRow
		id="wishlist-appearance-mat"
		label={m.wishlist_appearance_mat_label()}
		value={style.mat}
		options={MAT_OPTIONS}
		onchange={(value) => onchange('mat', value)}
		{disabled}
	/>
	<div class="flex flex-col gap-2 sm:grid sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-3">
		<Label id="wishlist-appearance-heading-label" class="sm:pt-2">
			{m.wishlist_appearance_heading_label()}
		</Label>
		<RadioGroupPrimitive.Root
			bind:value={selectedHeadingFont}
			onValueChange={handleHeadingFontChange}
			aria-labelledby="wishlist-appearance-heading-label"
			{disabled}
			loop
			class={choiceStyles.root()}
		>
			{#each WISHLIST_HEADING_FONTS as font (font)}
				<RadioGroupPrimitive.Item value={font} class={choiceStyles.item()}>
					<span
						class="flex h-14 items-center justify-center font-heading text-2xl leading-none font-semibold"
						data-heading={font}
						aria-hidden="true"
					>
						{m.wishlist_appearance_heading_sample()}
					</span>
					<span class={choiceStyles.label()}>{HEADING_FONT_LABELS[font]()}</span>
				</RadioGroupPrimitive.Item>
			{/each}
		</RadioGroupPrimitive.Root>
	</div>
	<HelpText>{m.wishlist_appearance_style_hint()}</HelpText>
	<div>
		<Button
			type="button"
			intent="outline"
			disabled={disabled || !hasOverrides}
			onclick={onreset}
		>
			<RotateCcwIcon data-icon="inline-start" />
			{m.wishlist_appearance_style_reset()}
		</Button>
	</div>
</div>
