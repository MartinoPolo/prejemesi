import type { Component } from 'svelte';
import BabyIcon from '@lucide/svelte/icons/baby';
import CakeIcon from '@lucide/svelte/icons/cake';
import Flower2Icon from '@lucide/svelte/icons/flower-2';
import GemIcon from '@lucide/svelte/icons/gem';
import GraduationCapIcon from '@lucide/svelte/icons/graduation-cap';
import InfinityIcon from '@lucide/svelte/icons/infinity';
import SparklesIcon from '@lucide/svelte/icons/sparkles';
import TreePineIcon from '@lucide/svelte/icons/tree-pine';
import * as m from '$lib/paraglide/messages.js';
import {
	WISHLIST_KIND,
	WISHLIST_OCCASION,
	type WishlistKind,
	type WishlistOccasion,
} from './types.js';

interface WishlistOccasionDisplay {
	icon: Component;
	label: () => string;
}

/**
 * One icon set and one label per occasion, shared by the occasion field and the card badge.
 * Narozeniny (cake) and Svátek (flower) keep clearly different silhouettes.
 */
export const WISHLIST_OCCASION_DISPLAY: Record<WishlistOccasion, WishlistOccasionDisplay> = {
	christmas: { icon: TreePineIcon, label: m.wishlist_occasion_christmas },
	birthday: { icon: CakeIcon, label: m.wishlist_occasion_birthday },
	name_day: { icon: Flower2Icon, label: m.wishlist_occasion_name_day },
	wedding: { icon: GemIcon, label: m.wishlist_occasion_wedding },
	baby: { icon: BabyIcon, label: m.wishlist_occasion_baby },
	graduation: { icon: GraduationCapIcon, label: m.wishlist_occasion_graduation },
	other: { icon: SparklesIcon, label: m.wishlist_occasion_other },
	permanent: { icon: InfinityIcon, label: m.wishlist_kind_permanent },
};

/** The occasion a wishlist shows: a permanent list is always the Stálý seznam. */
export function displayedWishlistOccasion(
	kind: WishlistKind,
	occasion: WishlistOccasion,
): WishlistOccasion {
	return kind === WISHLIST_KIND.permanent ? WISHLIST_OCCASION.permanent : occasion;
}

/**
 * The occasion's label for the wishlist hero, or null for Jiná, which names nothing; the Stálý
 * seznam is named.
 */
export function occasionDisplayLabel(occasion: WishlistOccasion): string | null {
	return occasion === WISHLIST_OCCASION.other
		? null
		: WISHLIST_OCCASION_DISPLAY[occasion].label();
}

/** Jiná and the Stálý seznam say nothing worth a badge on a wishlist card. */
export function occasionHasCardBadge(occasion: WishlistOccasion): boolean {
	return occasion !== WISHLIST_OCCASION.other && occasion !== WISHLIST_OCCASION.permanent;
}
