import {
	boolean,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from 'drizzle-orm/pg-core';
import {
	appBackgroundThemeEnum,
	depthStyleEnum,
	paletteEnum,
	preferredLocaleEnum,
} from './enums.js';
import type { NotificationPreferences } from '../../modules/notifications/types.js';

export const user = pgTable('user', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	emailVerified: boolean('email_verified').notNull().default(false),
	image: text('image'),
	// Fictional identities are never BetterAuth accounts and cannot authenticate.
	demoSessionId: text('demo_session_id').references(() => demoSession.id, {
		onDelete: 'cascade',
	}),
	// Superseded by `palette`; kept for rollback safety, no reader remains.
	appBackgroundTheme: appBackgroundThemeEnum('app_background_theme').notNull().default('default'),
	preferredLocale: preferredLocaleEnum('preferred_locale'),
	// Redesign 2026 viewer palette (mirrored in the `app-palette` cookie for SSR).
	palette: paletteEnum('palette').notNull().default('sky'),
	// Viewer sticker depth (mirrored in the `app-depth` cookie for SSR).
	depthStyle: depthStyleEnum('depth_style').notNull().default('soft'),
	// Per-user in-app/email notification toggles. Nullable: NULL = "never customized",
	// interpreted as DEFAULT_NOTIFICATION_PREFERENCES by readers (dispatcher + settings).
	notificationPreferences: jsonb('notification_preferences').$type<NotificationPreferences>(),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const demoSession = pgTable('demo_session', {
	id: text('id').primaryKey(),
	tokenHash: text('token_hash').notNull().unique(),
	viewerUserId: text('viewer_user_id').notNull(),
	clientHash: text('client_hash').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
	editRequests: integer('edit_requests').notNull().default(0),
	resets: integer('resets').notNull().default(0),
});

export const demoClientThrottle = pgTable('demo_client_throttle', {
	clientHash: text('client_hash').primaryKey(),
	windowStartedAt: timestamp('window_started_at', { withTimezone: true }).notNull(),
	creations: integer('creations').notNull().default(0),
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

// OAuth authorization server for MCP clients: the tables of the BetterAuth `jwt` plugin and of
// `@better-auth/mcp` (built on `@better-auth/oauth-provider`), generated with the `auth` CLI
// against a throwaway config and merged by hand. The plugins address tables by these export keys
// and columns by these property names. They store tokens and client secrets hashed and encrypt
// JWKS private keys.

export const jwks = pgTable('jwks', {
	id: text('id').primaryKey(),
	publicKey: text('public_key').notNull(),
	privateKey: text('private_key').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
	expiresAt: timestamp('expires_at', { withTimezone: true }),
	alg: text('alg'),
	crv: text('crv'),
});

export const oauthClient = pgTable(
	'oauth_client',
	{
		id: text('id').primaryKey(),
		clientId: text('client_id').notNull().unique(),
		clientSecret: text('client_secret'),
		clientDiscoveryId: text('client_discovery_id'),
		disabled: boolean('disabled').default(false),
		skipConsent: boolean('skip_consent'),
		enableEndSession: boolean('enable_end_session'),
		subjectType: text('subject_type'),
		scopes: text('scopes').array(),
		clientCredentialsScopes: text('client_credentials_scopes').array().default([]),
		userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
		createdAt: timestamp('created_at', { withTimezone: true }),
		updatedAt: timestamp('updated_at', { withTimezone: true }),
		name: text('name'),
		uri: text('uri'),
		icon: text('icon'),
		contacts: text('contacts').array(),
		tos: text('tos'),
		policy: text('policy'),
		softwareId: text('software_id'),
		softwareVersion: text('software_version'),
		softwareStatement: text('software_statement'),
		redirectUris: text('redirect_uris').array().notNull(),
		postLogoutRedirectUris: text('post_logout_redirect_uris').array(),
		backchannelLogoutUri: text('backchannel_logout_uri'),
		backchannelLogoutSessionRequired: boolean('backchannel_logout_session_required'),
		tokenEndpointAuthMethod: text('token_endpoint_auth_method'),
		applicationType: text('application_type'),
		jwks: text('jwks'),
		jwksUri: text('jwks_uri'),
		grantTypes: text('grant_types').array(),
		responseTypes: text('response_types').array(),
		requirePKCE: boolean('require_pkce'),
		dpopBoundAccessTokens: boolean('dpop_bound_access_tokens').default(false),
		referenceId: text('reference_id'),
		metadata: jsonb('metadata'),
	},
	(table) => ({
		userIdx: index('oauth_client_user_idx').on(table.userId),
	}),
);

export const oauthResource = pgTable('oauth_resource', {
	id: text('id').primaryKey(),
	identifier: text('identifier').notNull().unique(),
	name: text('name').notNull(),
	accessTokenTtl: integer('access_token_ttl'),
	refreshTokenTtl: integer('refresh_token_ttl'),
	signingAlgorithm: text('signing_algorithm'),
	signingKeyId: text('signing_key_id'),
	allowedScopes: text('allowed_scopes').array(),
	customClaims: jsonb('custom_claims'),
	dpopBoundAccessTokensRequired: boolean('dpop_bound_access_tokens_required').default(false),
	disabled: boolean('disabled').default(false),
	createdAt: timestamp('created_at', { withTimezone: true }),
	updatedAt: timestamp('updated_at', { withTimezone: true }),
	policyVersion: integer('policy_version').default(1),
	metadata: jsonb('metadata'),
});

export const oauthClientResource = pgTable(
	'oauth_client_resource',
	{
		id: text('id').primaryKey(),
		clientId: text('client_id')
			.notNull()
			.references(() => oauthClient.clientId, { onDelete: 'cascade' }),
		resourceId: text('resource_id')
			.notNull()
			.references(() => oauthResource.identifier, { onDelete: 'cascade' }),
		metadata: jsonb('metadata'),
		createdAt: timestamp('created_at', { withTimezone: true }),
	},
	(table) => ({
		clientResourceUnique: uniqueIndex('oauth_client_resource_client_resource_unique').on(
			table.clientId,
			table.resourceId,
		),
		resourceIdx: index('oauth_client_resource_resource_idx').on(table.resourceId),
	}),
);

export const oauthRefreshToken = pgTable(
	'oauth_refresh_token',
	{
		id: text('id').primaryKey(),
		token: text('token').notNull().unique(),
		clientId: text('client_id')
			.notNull()
			.references(() => oauthClient.clientId, { onDelete: 'cascade' }),
		sessionId: text('session_id').references(() => session.id, { onDelete: 'set null' }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		referenceId: text('reference_id'),
		authorizationCodeId: text('authorization_code_id'),
		resources: text('resources').array(),
		requestedUserInfoClaims: text('requested_user_info_claims').array(),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
		revoked: timestamp('revoked', { withTimezone: true }),
		rotatedAt: timestamp('rotated_at', { withTimezone: true }),
		rotationReplayResponse: text('rotation_replay_response'),
		rotationReplayExpiresAt: timestamp('rotation_replay_expires_at', { withTimezone: true }),
		authTime: timestamp('auth_time', { withTimezone: true }),
		confirmation: jsonb('confirmation'),
		scopes: text('scopes').array().notNull(),
	},
	(table) => ({
		clientIdx: index('oauth_refresh_token_client_idx').on(table.clientId),
		sessionIdx: index('oauth_refresh_token_session_idx').on(table.sessionId),
		userIdx: index('oauth_refresh_token_user_idx').on(table.userId),
		authorizationCodeIdx: index('oauth_refresh_token_authorization_code_idx').on(
			table.authorizationCodeId,
		),
	}),
);

export const oauthAccessToken = pgTable(
	'oauth_access_token',
	{
		id: text('id').primaryKey(),
		token: text('token').notNull().unique(),
		clientId: text('client_id')
			.notNull()
			.references(() => oauthClient.clientId, { onDelete: 'cascade' }),
		sessionId: text('session_id').references(() => session.id, { onDelete: 'set null' }),
		userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
		referenceId: text('reference_id'),
		authorizationCodeId: text('authorization_code_id'),
		resources: text('resources').array(),
		requestedUserInfoClaims: text('requested_user_info_claims').array(),
		refreshId: text('refresh_id').references(() => oauthRefreshToken.id, {
			onDelete: 'cascade',
		}),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
		revoked: timestamp('revoked', { withTimezone: true }),
		confirmation: jsonb('confirmation'),
		scopes: text('scopes').array().notNull(),
	},
	(table) => ({
		clientIdx: index('oauth_access_token_client_idx').on(table.clientId),
		sessionIdx: index('oauth_access_token_session_idx').on(table.sessionId),
		userIdx: index('oauth_access_token_user_idx').on(table.userId),
		authorizationCodeIdx: index('oauth_access_token_authorization_code_idx').on(
			table.authorizationCodeId,
		),
		refreshIdx: index('oauth_access_token_refresh_idx').on(table.refreshId),
	}),
);

export const oauthConsent = pgTable(
	'oauth_consent',
	{
		id: text('id').primaryKey(),
		clientId: text('client_id')
			.notNull()
			.references(() => oauthClient.clientId, { onDelete: 'cascade' }),
		userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
		referenceId: text('reference_id'),
		resources: text('resources').array(),
		requestedUserInfoClaims: text('requested_user_info_claims').array(),
		scopes: text('scopes').array().notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
	},
	(table) => ({
		clientIdx: index('oauth_consent_client_idx').on(table.clientId),
		userIdx: index('oauth_consent_user_idx').on(table.userId),
	}),
);

/** Used `private_key_jwt` client assertion ids, kept until they expire so a replay is refused. */
export const oauthClientAssertion = pgTable('oauth_client_assertion', {
	id: text('id').primaryKey(),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});
