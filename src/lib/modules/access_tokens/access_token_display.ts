import * as m from '$lib/paraglide/messages.js';
import { getLocale } from '$lib/paraglide/runtime.js';
import { czechPluralCategory } from '$lib/modules/gifts/gift_display.js';
import { AGENT_SCOPE, type AgentScope } from './scopes.js';
import {
	ACCESS_TOKEN_EXPIRY_PRESET_DAYS,
	type AccessTokenExpiryPresetDays,
	type AccessTokenSummary,
} from './types.js';

const DAY_MILLISECONDS = 24 * 60 * 60 * 1000;
const EXPIRING_SOON_DAYS = 7;
const WISHLIST_LINE_TITLE_LIMIT = 2;

interface AccessTokenScopeCopy {
	label: () => string;
	description: () => string;
	/** The verb phrase the row sentence lists, e.g. "upravuje dárky". */
	ability: () => string;
	warning?: () => string;
}

export const ACCESS_TOKEN_SCOPE_COPY = {
	[AGENT_SCOPE.read]: {
		label: m.access_tokens_scope_read,
		description: m.access_tokens_scope_read_description,
		ability: m.access_tokens_scope_read_ability,
	},
	[AGENT_SCOPE.giftsWrite]: {
		label: m.access_tokens_scope_gifts_write,
		description: m.access_tokens_scope_gifts_write_description,
		ability: m.access_tokens_scope_gifts_write_ability,
	},
	[AGENT_SCOPE.reservationsWrite]: {
		label: m.access_tokens_scope_reservations_write,
		description: m.access_tokens_scope_reservations_write_description,
		ability: m.access_tokens_scope_reservations_write_ability,
	},
	[AGENT_SCOPE.managersInvite]: {
		label: m.access_tokens_scope_managers_invite,
		description: m.access_tokens_scope_managers_invite_description,
		ability: m.access_tokens_scope_managers_invite_ability,
	},
	[AGENT_SCOPE.reservationsIdentities]: {
		label: m.access_tokens_scope_reservations_identities,
		description: m.access_tokens_scope_reservations_identities_description,
		ability: m.access_tokens_scope_reservations_identities_ability,
		warning: m.access_tokens_scope_reservations_identities_warning,
	},
} satisfies Record<AgentScope, AccessTokenScopeCopy>;

/** Every scope in its canonical order, the order the picker and details list them in. */
export const ACCESS_TOKEN_SCOPES: readonly AgentScope[] = Object.values(AGENT_SCOPE);

const EXPIRY_PRESET_LABELS = {
	30: m.access_tokens_expiry_30,
	90: m.access_tokens_expiry_90,
	365: m.access_tokens_expiry_365,
	1825: m.access_tokens_expiry_1825,
	3650: m.access_tokens_expiry_3650,
} satisfies Record<AccessTokenExpiryPresetDays, () => string>;

export function accessTokenExpiryPresetLabel(days: AccessTokenExpiryPresetDays): string {
	return EXPIRY_PRESET_LABELS[days]();
}

export function isAccessTokenExpiryPreset(days: number): days is AccessTokenExpiryPresetDays {
	return ACCESS_TOKEN_EXPIRY_PRESET_DAYS.some((presetDays) => presetDays === days);
}

/** When a token created or regenerated now with this preset would expire. */
export function accessTokenExpiryAfter(days: AccessTokenExpiryPresetDays, from = new Date()): Date {
	return new Date(from.getTime() + days * DAY_MILLISECONDS);
}

export function formatAccessTokenDate(date: Date): string {
	return new Intl.DateTimeFormat(getLocale(), {
		day: 'numeric',
		month: 'numeric',
		year: 'numeric',
	}).format(date);
}

export function isAccessTokenExpiringSoon(
	token: Pick<AccessTokenSummary, 'expired' | 'expiresAt'>,
	now = new Date(),
): boolean {
	return (
		!token.expired &&
		token.expiresAt.getTime() - now.getTime() <= EXPIRING_SOON_DAYS * DAY_MILLISECONDS
	);
}

/**
 * What the token lets an agent do and where, e.g. "Čte a upravuje dárky na 1 seznamu".
 * `wishlistCount` is null when the token reaches every wishlist.
 */
export function accessTokenAbilitySentence(
	scopes: readonly AgentScope[],
	wishlistCount: number | null,
): string {
	const abilities = ACCESS_TOKEN_SCOPES.filter(
		(scope) => scope === AGENT_SCOPE.read || scopes.includes(scope),
	).map((scope) => ACCESS_TOKEN_SCOPE_COPY[scope].ability());
	const abilityList =
		abilities.length === 1
			? m.access_tokens_ability_read_only()
			: capitalize(
					new Intl.ListFormat(getLocale(), { type: 'conjunction' }).format(abilities),
				);

	if (wishlistCount === null) {
		return m.access_tokens_sentence_all({ abilities: abilityList });
	}
	if (wishlistCount === 1) {
		return m.access_tokens_sentence_one({ abilities: abilityList });
	}
	return m.access_tokens_sentence_other({ abilities: abilityList, count: wishlistCount });
}

/** What regenerating keeps: the same abilities, wishlists and review setting. */
export function accessTokenRegenerateKeptLine(
	token: Pick<AccessTokenSummary, 'scopes' | 'wishlists' | 'fastForward'>,
): string {
	const sentence = accessTokenAbilitySentence(token.scopes, token.wishlists?.length ?? null);
	const summary = sentence.charAt(0).toLocaleLowerCase(getLocale()) + sentence.slice(1);
	return token.fastForward
		? m.access_tokens_regenerate_kept_fast_forward({ summary })
		: m.access_tokens_regenerate_kept({ summary });
}

/** The short wishlist line under the sentence: "Všechny seznamy" or "Jen: A, B +2". */
export function accessTokenWishlistLine(wishlists: AccessTokenSummary['wishlists']): string {
	if (wishlists === null) {
		return m.access_tokens_lists_all();
	}
	const titles = wishlists
		.slice(0, WISHLIST_LINE_TITLE_LIMIT)
		.map((wishlist) => wishlist.title)
		.join(', ');
	const hiddenCount = wishlists.length - WISHLIST_LINE_TITLE_LIMIT;
	return hiddenCount > 0
		? m.access_tokens_lists_only_more({ titles, count: hiddenCount })
		: m.access_tokens_lists_only({ titles });
}

/** "2 aktivní" or "2 aktivní, 1 vypršel", beside the list heading. */
export function accessTokenCountLabel(
	tokens: readonly Pick<AccessTokenSummary, 'expired'>[],
): string {
	const expiredCount = tokens.filter((token) => token.expired).length;
	const active = m.access_tokens_count_active({ count: tokens.length - expiredCount });
	if (expiredCount === 0) {
		return active;
	}
	const expiredMessages = {
		one: m.access_tokens_count_expired_one,
		few: m.access_tokens_count_expired_few,
		other: m.access_tokens_count_expired_other,
	};
	const expired = expiredMessages[czechPluralCategory(expiredCount)]({ count: expiredCount });
	return m.access_tokens_count_with_expired({ active, expired });
}

function capitalize(text: string): string {
	return text.charAt(0).toLocaleUpperCase(getLocale()) + text.slice(1);
}
