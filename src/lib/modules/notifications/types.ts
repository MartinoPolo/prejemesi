import * as v from 'valibot';
import * as m from '$lib/paraglide/messages.js';
import type { SupportedLocale } from '$lib/i18n/locale.js';
import type { notification } from '$lib/server/db/notification.schema.js';

// ── Notification Types ──────────────────────────────────────────────────────

export const NOTIFICATION_TYPE = {
	LIKED_GIFT_RESERVED: 'liked_gift_reserved',
	RESERVED_GIFT_EDITED: 'reserved_gift_edited',
	WISHLIST_ARCHIVED: 'wishlist_archived',
	// Recipient self-promoted to správce. Stored value kept as 'owner_self_promoted' so existing
	// production notification rows and the icon/message maps keyed on it stay valid (issue #99).
	RECIPIENT_SELF_PROMOTED: 'owner_self_promoted',
	NEW_GIFT_ADDED: 'new_gift_added',
	GIFT_RESERVED: 'gift_reserved',
	MODERATOR_INVITED: 'moderator_invited',
	// Claim invite (issue #150): a správce emailed a „Pozvat obdarovaného" link.
	CLAIM_INVITED: 'claim_invited',
	// The free-text recipient claimed their list — in-app heads-up to the active správci.
	RECIPIENT_CLAIMED: 'recipient_claimed',
	// A shared list was reverted to draft by an app admin — the reserver's reservation was
	// cancelled (issue #150). Emailed to registered + anonymous-with-email reservers; in-app for
	// registered. Anonymous reservers without an email are unreachable (accepted).
	RESERVATION_CANCELLED: 'reservation_cancelled',
} as const;

export type NotificationType = (typeof NOTIFICATION_TYPE)[keyof typeof NOTIFICATION_TYPE];

/** Types that trigger email notifications (critical) */
export const EMAIL_NOTIFICATION_TYPES: readonly NotificationType[] = [
	NOTIFICATION_TYPE.LIKED_GIFT_RESERVED,
	NOTIFICATION_TYPE.RESERVED_GIFT_EDITED,
	NOTIFICATION_TYPE.WISHLIST_ARCHIVED,
	NOTIFICATION_TYPE.RECIPIENT_SELF_PROMOTED,
	NOTIFICATION_TYPE.MODERATOR_INVITED,
	NOTIFICATION_TYPE.CLAIM_INVITED,
	// Email-capable so anonymous-with-email reservers (who have no in-app inbox) are reached.
	NOTIFICATION_TYPE.RESERVATION_CANCELLED,
] as const;

/** Types that are in-app only (non-critical) */
export const IN_APP_ONLY_NOTIFICATION_TYPES: readonly NotificationType[] = [
	NOTIFICATION_TYPE.NEW_GIFT_ADDED,
	NOTIFICATION_TYPE.GIFT_RESERVED,
	NOTIFICATION_TYPE.RECIPIENT_CLAIMED,
] as const;

// ── Notification Messages (Czech) ───────────────────────────────────────────

export const NOTIFICATION_MESSAGES = {
	liked_gift_reserved: (locale?: SupportedLocale) =>
		m.notification_type_liked_reserved({}, { locale }),
	reserved_gift_edited: (locale?: SupportedLocale) =>
		m.notification_type_reserved_edited({}, { locale }),
	wishlist_archived: (locale?: SupportedLocale) => m.notification_type_archived({}, { locale }),
	owner_self_promoted: (locale?: SupportedLocale) =>
		m.notification_type_owner_promoted({}, { locale }),
	new_gift_added: (locale?: SupportedLocale) => m.notification_type_new_gift({}, { locale }),
	gift_reserved: (locale?: SupportedLocale) => m.notification_type_reserved({}, { locale }),
	moderator_invited: (locale?: SupportedLocale) =>
		m.notification_type_moderator_invited({}, { locale }),
	claim_invited: (locale?: SupportedLocale) => m.notification_type_claim_invited({}, { locale }),
	recipient_claimed: (locale?: SupportedLocale) =>
		m.notification_type_recipient_claimed({}, { locale }),
	reservation_cancelled: (locale?: SupportedLocale) =>
		m.notification_type_reservation_cancelled({}, { locale }),
} satisfies Record<NotificationType, (locale?: SupportedLocale) => string>;

export function getNotificationEmailCopy(type: NotificationType, locale: SupportedLocale) {
	return {
		message: NOTIFICATION_MESSAGES[type](locale),
		wishlistLabel: m.notification_email_wishlist_label({}, { locale }),
		fromLabel: m.notification_email_from_label({}, { locale }),
		buttonLabel: m.notification_email_open_wishlist({}, { locale }),
		copyLinkText: m.notification_email_copy_link({}, { locale }),
	};
}

function assertNeverNotificationType(type: never): never {
	throw new Error(`Unhandled notification type: ${type as string}`);
}

/**
 * Short email card title (issue #205) – distinct from the subject line so the
 * rendered email doesn't repeat the same sentence in the subject and the `<h1>`.
 * In-app-only types never reach the email path (the dispatcher gates on
 * `EMAIL_NOTIFICATION_TYPES` before calling this), so they fall back to the
 * plain subject copy as an inert placeholder that keeps this switch exhaustive.
 */
export function getNotificationEmailHeading(
	type: NotificationType,
	locale?: SupportedLocale,
): string {
	switch (type) {
		case NOTIFICATION_TYPE.LIKED_GIFT_RESERVED:
			return m.notification_heading_liked_reserved({}, { locale });
		case NOTIFICATION_TYPE.RESERVED_GIFT_EDITED:
			return m.notification_heading_reserved_edited({}, { locale });
		case NOTIFICATION_TYPE.WISHLIST_ARCHIVED:
			return m.notification_heading_archived({}, { locale });
		case NOTIFICATION_TYPE.RECIPIENT_SELF_PROMOTED:
			return m.notification_heading_owner_promoted({}, { locale });
		case NOTIFICATION_TYPE.MODERATOR_INVITED:
			return m.notification_heading_moderator_invited({}, { locale });
		case NOTIFICATION_TYPE.CLAIM_INVITED:
			return m.notification_heading_claim_invited({}, { locale });
		case NOTIFICATION_TYPE.RESERVATION_CANCELLED:
			return m.notification_heading_reservation_cancelled({}, { locale });
		case NOTIFICATION_TYPE.NEW_GIFT_ADDED:
		case NOTIFICATION_TYPE.GIFT_RESERVED:
		case NOTIFICATION_TYPE.RECIPIENT_CLAIMED:
			return NOTIFICATION_MESSAGES[type](locale);
		default:
			return assertNeverNotificationType(type);
	}
}

/**
 * Email body's leading detail sentence (issue #205) – distinct from both the subject and
 * the heading. Gift-bearing types name the gift; a generic filler is used only as a
 * defensive fallback (every current email-eligible gift dispatch passes `giftName`).
 * The wishlist name is appended separately by `getEmailBody` below.
 */
export function getNotificationEmailBody(
	type: NotificationType,
	locale: SupportedLocale | undefined,
	params: { giftName?: string },
): string {
	const genericGiftName = m.notification_body_generic_gift_name({}, { locale });
	const giftName = params.giftName ?? genericGiftName;

	switch (type) {
		case NOTIFICATION_TYPE.LIKED_GIFT_RESERVED:
			return m.notification_body_liked_reserved({ giftName }, { locale });
		case NOTIFICATION_TYPE.RESERVED_GIFT_EDITED:
			return m.notification_body_reserved_edited({ giftName }, { locale });
		case NOTIFICATION_TYPE.WISHLIST_ARCHIVED:
			return m.notification_body_archived({}, { locale });
		case NOTIFICATION_TYPE.RECIPIENT_SELF_PROMOTED:
			return m.notification_body_owner_promoted({}, { locale });
		case NOTIFICATION_TYPE.MODERATOR_INVITED:
			return m.notification_body_moderator_invited({}, { locale });
		case NOTIFICATION_TYPE.CLAIM_INVITED:
			return m.notification_body_claim_invited({}, { locale });
		case NOTIFICATION_TYPE.RESERVATION_CANCELLED:
			// One type, two events (issue #213): a SINGLE release always knows which gift it
			// freed, while the BULK revert-to-draft (issue #150) sweeps a whole list and names
			// none — so the gift name is exactly the discriminator between the two copies.
			return params.giftName === undefined
				? m.notification_body_reservation_cancelled({}, { locale })
				: m.notification_body_reservation_released({ giftName }, { locale });
		case NOTIFICATION_TYPE.NEW_GIFT_ADDED:
		case NOTIFICATION_TYPE.GIFT_RESERVED:
		case NOTIFICATION_TYPE.RECIPIENT_CLAIMED:
			return NOTIFICATION_MESSAGES[type](locale);
		default:
			return assertNeverNotificationType(type);
	}
}

// ── DB Row Type ─────────────────────────────────────────────────────────────

export type NotificationRow = typeof notification.$inferSelect;

// ── Client-facing Notification ──────────────────────────────────────────────

export interface Notification {
	id: string;
	type: NotificationType;
	message: string;
	wishlistId: string | null;
	/** Wishlist's route-facing shortId, resolved via a join at the read path (issue #204) — the
	 *  in-app link must navigate by shortId, never the `wishlistId` UUID. Null when the
	 *  wishlist no longer exists. */
	wishlistShortId: string | null;
	giftId: string | null;
	actorName: string | null;
	read: boolean;
	createdAt: Date;
}

// ── Notification Preferences ────────────────────────────────────────────────

export interface NotificationPreferenceEntry {
	email: boolean;
	inApp: boolean;
}

export type NotificationPreferences = Record<NotificationType, NotificationPreferenceEntry>;

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
	liked_gift_reserved: { email: true, inApp: true },
	reserved_gift_edited: { email: true, inApp: true },
	wishlist_archived: { email: true, inApp: true },
	owner_self_promoted: { email: true, inApp: true },
	new_gift_added: { email: false, inApp: true },
	gift_reserved: { email: false, inApp: true },
	moderator_invited: { email: true, inApp: true },
	claim_invited: { email: true, inApp: true },
	recipient_claimed: { email: false, inApp: true },
	reservation_cancelled: { email: true, inApp: true },
} satisfies Record<NotificationType, NotificationPreferenceEntry>;

/**
 * Merges a stored preferences row over the product defaults so every current notification
 * type has an entry. Stored rows are partial: they only hold the types that existed when the
 * user last saved, so rows predating newer types (issue #150) would leave those types
 * `undefined` and crash `preferences[type].inApp` reads. NULL (never customized) yields the
 * plain defaults. Callers must run every read through here before indexing by type.
 */
export function normalizeNotificationPreferences(
	stored: NotificationPreferences | null | undefined,
): NotificationPreferences {
	return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...stored };
}

// ── Preferences Input Validation ────────────────────────────────────────────

const NotificationPreferenceEntrySchema = v.object({
	email: v.boolean(),
	inApp: v.boolean(),
});

// Built from NOTIFICATION_TYPE so the schema stays exhaustive: adding a type to the
// enum forces a matching entry here (and a compile error in DEFAULT_… above).
const notificationPreferencesShape = Object.fromEntries(
	Object.values(NOTIFICATION_TYPE).map((type) => [type, NotificationPreferenceEntrySchema]),
) as Record<NotificationType, typeof NotificationPreferenceEntrySchema>;

export const UpdateNotificationPreferencesInputSchema = v.object({
	preferences: v.object(notificationPreferencesShape),
});

// ── Dispatch Input ──────────────────────────────────────────────────────────

export interface DispatchNotificationInput {
	type: NotificationType;
	targetUserIds?: readonly string[];
	targetEmails?: readonly string[];
	wishlistId?: string;
	giftId?: string;
	/** Gift name for the email body's detail sentence (issue #205) – gift-bearing dispatches
	 *  pass this so the body can name the gift instead of repeating the subject. */
	giftName?: string;
	actorId?: string;
	actorName?: string;
	/** Overrides the email CTA link path (resolved against origin). Defaults to the wishlist URL. Use for links that aren't the plain wishlist page (e.g. an invite-acceptance URL). */
	urlPathOverride?: string;
	/**
	 * Wishlist context for the email body/link. Callers that already hold the
	 * wishlist row pass it here to spare the dispatcher its own lookup
	 * (issue #108). Falls back to a DB read keyed on `wishlistId` when omitted.
	 */
	wishlist?: { title: string; shortId: string };
}
