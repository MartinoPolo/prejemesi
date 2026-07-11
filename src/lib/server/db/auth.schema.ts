import { boolean, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { appBackgroundThemeEnum, paletteEnum, preferredLocaleEnum } from './enums.js';
import type { NotificationPreferences } from '../../modules/notifications/types.js';

export const user = pgTable('user', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	emailVerified: boolean('email_verified').notNull().default(false),
	image: text('image'),
	// Superseded by `palette`; kept for rollback safety, no reader remains.
	appBackgroundTheme: appBackgroundThemeEnum('app_background_theme').notNull().default('default'),
	preferredLocale: preferredLocaleEnum('preferred_locale'),
	// Redesign 2026 viewer palette (mirrored in the `app-palette` cookie for SSR).
	palette: paletteEnum('palette').notNull().default('sky'),
	// Per-user in-app/email notification toggles. Nullable: NULL = "never customized",
	// interpreted as DEFAULT_NOTIFICATION_PREFERENCES by readers (dispatcher + settings).
	notificationPreferences: jsonb('notification_preferences').$type<NotificationPreferences>(),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable('session', {
	id: text('id').primaryKey(),
	token: text('token').notNull().unique(),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	ipAddress: text('ip_address'),
	userAgent: text('user_agent'),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
});

export const account = pgTable('account', {
	id: text('id').primaryKey(),
	accountId: text('account_id').notNull(),
	providerId: text('provider_id').notNull(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	accessToken: text('access_token'),
	refreshToken: text('refresh_token'),
	idToken: text('id_token'),
	accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
	refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
	scope: text('scope'),
	password: text('password'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const verification = pgTable('verification', {
	id: text('id').primaryKey(),
	identifier: text('identifier').notNull(),
	value: text('value').notNull(),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }),
	updatedAt: timestamp('updated_at', { withTimezone: true }),
});
