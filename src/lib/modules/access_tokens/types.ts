import * as v from 'valibot';
import { AGENT_SCOPE, type AgentScope } from './scopes.js';

export const ACCESS_TOKEN_NAME_MAX_LENGTH = 60;
export const ACCESS_TOKEN_EXPIRY_PRESET_DAYS = [30, 90, 365, 1825, 3650] as const;
export const ACCESS_TOKEN_DEFAULT_EXPIRY_DAYS = 365;

export type AccessTokenExpiryPresetDays = (typeof ACCESS_TOKEN_EXPIRY_PRESET_DAYS)[number];

/** Tokens always expire, after one of the preset numbers of days. */
const AccessTokenExpiryDaysSchema = v.picklist(ACCESS_TOKEN_EXPIRY_PRESET_DAYS);

export const CreateAccessTokenInputSchema = v.strictObject({
	name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(ACCESS_TOKEN_NAME_MAX_LENGTH)),
	/** `read` is always granted, listed or not. */
	scopes: v.array(v.picklist(Object.values(AGENT_SCOPE))),
	/** Null reaches every wishlist the user may; otherwise only these. */
	wishlistIds: v.nullable(v.pipe(v.array(v.string()), v.minLength(1))),
	expiryDays: v.optional(AccessTokenExpiryDaysSchema, ACCESS_TOKEN_DEFAULT_EXPIRY_DAYS),
	fastForward: v.optional(v.boolean(), false),
});

export type CreateAccessTokenInput = v.InferOutput<typeof CreateAccessTokenInputSchema>;

export const RevokeAccessTokenInputSchema = v.strictObject({ tokenId: v.string() });

export const RollAccessTokenInputSchema = v.strictObject({
	tokenId: v.string(),
	/** Omitted keeps the token's current lifetime, counted from the roll. */
	expiryDays: v.optional(AccessTokenExpiryDaysSchema),
});

export type RollAccessTokenInput = v.InferOutput<typeof RollAccessTokenInputSchema>;

/** One listed token; the value itself is shown only once, at creation. */
export interface AccessTokenSummary {
	id: string;
	name: string;
	/** The value's first characters, enough to tell tokens apart. */
	prefix: string;
	scopes: AgentScope[];
	/** Null when the token reaches every wishlist its user may. */
	wishlists: { id: string; title: string }[] | null;
	fastForward: boolean;
	expiresAt: Date;
	/** The preset of the token's current lifetime, from its creation or last roll to its expiry. */
	expiryPresetDays: AccessTokenExpiryPresetDays;
	expired: boolean;
	lastUsedAt: Date | null;
	createdAt: Date;
	/** When the value was last regenerated; null until the first roll. */
	rolledAt: Date | null;
}

/** A created or rolled token. */
export interface CreatedAccessToken {
	token: AccessTokenSummary;
	/** The token value, returned this once and never stored. */
	value: string;
}

export interface AccessTokenWishlistChoice {
	id: string;
	title: string;
	recipientDisplayName: string;
}

/** The wishlists a token can be limited to, as the user relates to them. */
export interface AccessTokenWishlistChoices {
	own: AccessTokenWishlistChoice[];
	managed: AccessTokenWishlistChoice[];
	followed: AccessTokenWishlistChoice[];
}
