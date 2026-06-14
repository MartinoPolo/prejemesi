import * as v from 'valibot';
import * as m from '$lib/paraglide/messages.js';
import type { notification } from '$lib/server/db/notification.schema.js';

// ── Notification Types ──────────────────────────────────────────────────────

export const NOTIFICATION_TYPE = {
	LIKED_GIFT_RESERVED: 'liked_gift_reserved',
	RESERVED_GIFT_EDITED: 'reserved_gift_edited',
	WISHLIST_ARCHIVED: 'wishlist_archived',
	OWNER_SELF_PROMOTED: 'owner_self_promoted',
	NEW_GIFT_ADDED: 'new_gift_added',
	GIFT_RESERVED: 'gift_reserved',
	MODERATOR_INVITED: 'moderator_invited',
} as const;

export type NotificationType = (typeof NOTIFICATION_TYPE)[keyof typeof NOTIFICATION_TYPE];

/** Types that trigger email notifications (critical) */
export const EMAIL_NOTIFICATION_TYPES: readonly NotificationType[] = [
	NOTIFICATION_TYPE.LIKED_GIFT_RESERVED,
	NOTIFICATION_TYPE.RESERVED_GIFT_EDITED,
	NOTIFICATION_TYPE.WISHLIST_ARCHIVED,
	NOTIFICATION_TYPE.OWNER_SELF_PROMOTED,
	NOTIFICATION_TYPE.MODERATOR_INVITED,
] as const;

/** Types that are in-app only (non-critical) */
export const IN_APP_ONLY_NOTIFICATION_TYPES: readonly NotificationType[] = [
	NOTIFICATION_TYPE.NEW_GIFT_ADDED,
	NOTIFICATION_TYPE.GIFT_RESERVED,
] as const;

// ── Notification Messages (Czech) ───────────────────────────────────────────

export const NOTIFICATION_MESSAGES = {
	liked_gift_reserved: () => m.notification_type_liked_reserved(),
	reserved_gift_edited: () => m.notification_type_reserved_edited(),
	wishlist_archived: () => m.notification_type_archived(),
	owner_self_promoted: () => m.notification_type_owner_promoted(),
	new_gift_added: () => m.notification_type_new_gift(),
	gift_reserved: () => m.notification_type_reserved(),
	moderator_invited: () => m.notification_type_moderator_invited(),
} satisfies Record<NotificationType, () => string>;

// ── DB Row Type ─────────────────────────────────────────────────────────────

export type NotificationRow = typeof notification.$inferSelect;

// ── Client-facing Notification ──────────────────────────────────────────────

export interface Notification {
	id: string;
	type: NotificationType;
	message: string;
	wishlistId: string | null;
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
} satisfies Record<NotificationType, NotificationPreferenceEntry>;

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
	actorId?: string;
	actorName?: string;
	/** Overrides the email CTA link path (resolved against origin). Defaults to the wishlist URL. Use for links that aren't the plain wishlist page (e.g. an invite-acceptance URL). */
	urlPathOverride?: string;
}
