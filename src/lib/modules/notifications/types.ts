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
	liked_gift_reserved: 'Někdo rezervoval dárek, který se vám líbí',
	reserved_gift_edited: 'Dárek, který jste rezervovali, byl upraven',
	wishlist_archived: 'Seznam byl archivován',
	owner_self_promoted: 'Vlastník seznamu nyní vidí rezervace',
	new_gift_added: 'Nový dárek na seznamu',
	gift_reserved: 'Dárek byl rezervován',
	moderator_invited: 'Pozvánka ke správě seznamu',
} as const satisfies Record<NotificationType, string>;

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

// ── Dispatch Input ──────────────────────────────────────────────────────────

export interface DispatchNotificationInput {
	type: NotificationType;
	targetUserIds: string[];
	wishlistId?: string;
	giftId?: string;
	actorId?: string;
	actorName?: string;
}
