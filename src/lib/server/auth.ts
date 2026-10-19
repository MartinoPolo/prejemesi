import { betterAuth } from 'better-auth/minimal';
import { createAuthMiddleware, APIError } from 'better-auth/api';
import { eq } from 'drizzle-orm';
import { user as userTable } from './db/auth.schema.js';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { captcha, jwt } from 'better-auth/plugins';
import { mcp } from '@better-auth/mcp';
import { cimd } from '@better-auth/cimd';
import { env } from '$env/dynamic/private';
import { getRequestEvent } from '$app/server';
import { getDb } from './db/index.js';
import { sendEmail, renderActionEmailParts } from './email.js';
import { getTurnstileSecretKey } from './turnstile.js';
import { isDemoEmailAddress } from './demo/constants.js';
import type { RequestEvent } from '@sveltejs/kit';
import { AUTH_CAPTCHA_ENDPOINTS, AUTH_IP_ADDRESS_HEADERS, authRateLimit } from './auth_security.js';
import { resolveApplicationOrigin, resolveAuthOrigins } from '$lib/config/runtime_environment.js';
import { deLocalizeUrl } from '$lib/paraglide/runtime';
import { AGENT_SCOPE } from '$lib/modules/access_tokens/scopes.js';
import {
	OAUTH_CONSENT_PATH,
	OFFLINE_ACCESS_SCOPE,
	needsOauthProvider,
	oauthEndpoints,
} from './agent_access/oauth_endpoints.js';
import {
	createClientMetadataFetch,
	isClientMetadataUrlAllowed,
} from './agent_access/oauth_client_metadata_fetch.js';

// Local dev has no deliverable inbox (the Resend sandbox sender only emails the
// account owner), so verification links never arrive. Skip the verification gate
// in dev – sign-up then auto-signs-in – while production still requires it.
const requireEmailVerification = !import.meta.env.DEV;

export function isReservedDemoEmail(value: unknown): boolean {
	if (typeof value !== 'string') {
		return false;
	}
	const normalized = value.normalize('NFKC').trim().toLowerCase();
	return isDemoEmailAddress(normalized);
}

const OAUTH_ACCESS_TOKEN_SECONDS = 10 * 60;
const OAUTH_REFRESH_TOKEN_SECONDS = 365 * 24 * 60 * 60;

/**
 * The OAuth 2.1 provider MCP apps sign in through, with tokens bound to `/mcp`. Apps register by
 * client metadata URL, or by dynamic registration for clients that predate it; nobody manages
 * clients through the provider's own endpoints. Access tokens stay short because only the grant
 * row, read on every MCP call, revokes them.
 */
function oauthProviderPlugins(applicationOrigin: string) {
	const { resource } = oauthEndpoints(applicationOrigin);
	return [
		jwt({ disableSettingJwtHeader: true }),
		mcp({
			resource,
			loginPage: '/login',
			consentPage: OAUTH_CONSENT_PATH,
			scopes: [...Object.values(AGENT_SCOPE), OFFLINE_ACCESS_SCOPE],
			// Apps start with `read` and step up through 403 `insufficient_scope` challenges.
			advertisedMetadata: { scopes_supported: [AGENT_SCOPE.read, OFFLINE_ACCESS_SCOPE] },
			grantTypes: ['authorization_code', 'refresh_token'],
			accessTokenExpiresIn: OAUTH_ACCESS_TOKEN_SECONDS,
			refreshTokenExpiresIn: OAUTH_REFRESH_TOKEN_SECONDS,
			allowDynamicClientRegistration: true,
			allowUnauthenticatedClientRegistration: true,
			clientPrivileges: () => false,
			resourcePrivileges: () => false,
		}),
		cimd({
			fetchClientMetadataResource: createClientMetadataFetch(applicationOrigin),
			metadataProfile: 'mcp-2026-07-28',
			isMetadataDocumentUrlAllowed: (clientIdUrl) =>
				isClientMetadataUrlAllowed(clientIdUrl, applicationOrigin),
		}),
	];
}

export function createAuth(event?: RequestEvent) {
	const authOrigins = resolveAuthOrigins(env, import.meta.env.DEV);
	const applicationOrigin = resolveApplicationOrigin(env, import.meta.env.DEV, event?.url.href);
	return betterAuth({
		baseURL: authOrigins.baseURL,
		secret: env.AUTH_SECRET,
		trustedOrigins: authOrigins.trustedOrigins,
		logger: { disabled: !import.meta.env.DEV },
		rateLimit: authRateLimit(import.meta.env.PROD),
		advanced: {
			trustedProxyHeaders: authOrigins.trustedProxyHeaders,
			ipAddress: {
				ipAddressHeaders: [...AUTH_IP_ADDRESS_HEADERS],
			},
		},

		database: drizzleAdapter(getDb(event), { provider: 'pg' }),
		hooks: {
			before: createAuthMiddleware(async (context) => {
				if (
					typeof context.body === 'object' &&
					context.body !== null &&
					'email' in context.body &&
					isReservedDemoEmail(context.body.email)
				) {
					throw new APIError('FORBIDDEN', {
						message: 'Demo identities cannot authenticate',
					});
				}
			}),
		},
		databaseHooks: {
			user: {
				create: {
					before: async (account) => {
						if (isReservedDemoEmail(account.email)) {
							throw new APIError('FORBIDDEN', {
								message: 'Demo identities cannot authenticate',
							});
						}
					},
				},
			},
			session: {
				create: {
					before: async (newSession) => {
						const [identity] = await getDb(event)
							.select({ demoSessionId: userTable.demoSessionId })
							.from(userTable)
							.where(eq(userTable.id, newSession.userId))
							.limit(1);
						if (identity === undefined || identity.demoSessionId !== null) {
							throw new APIError('FORBIDDEN', {
								message: 'Demo identities cannot authenticate',
							});
						}
					},
				},
			},
		},

		emailAndPassword: {
			enabled: true,
			minPasswordLength: 8,
			maxPasswordLength: 128,
			autoSignIn: true,
			requireEmailVerification,
			resetPasswordTokenExpiresIn: 3600,
			sendResetPassword: async ({ user, url }) => {
				await sendEmail({
					to: user.email,
					subject: 'Reset your Přejeme si password',
					...renderActionEmailParts({
						heading: 'Reset your password',
						body: 'We received a request to reset your password. This link expires in 1 hour.',
						buttonLabel: 'Reset password',
						url,
					}),
					actionUrl: url,
				});
			},
		},

		emailVerification: {
			sendOnSignUp: requireEmailVerification,
			autoSignInAfterVerification: true,
			expiresIn: 3600,
			sendVerificationEmail: async ({ user, url }) => {
				await sendEmail({
					to: user.email,
					subject: 'Verify your Přejeme si email',
					...renderActionEmailParts({
						heading: 'Confirm your email',
						body: 'Please confirm your email address to finish setting up your account. This link expires in 1 hour.',
						buttonLabel: 'Verify email',
						url,
					}),
					actionUrl: url,
				});
			},
		},

		socialProviders:
			env.GOOGLE_CLIENT_ID !== undefined &&
			env.GOOGLE_CLIENT_ID !== '' &&
			env.GOOGLE_CLIENT_SECRET !== undefined &&
			env.GOOGLE_CLIENT_SECRET !== ''
				? {
						google: {
							clientId: env.GOOGLE_CLIENT_ID,
							clientSecret: env.GOOGLE_CLIENT_SECRET,
						},
					}
				: {},

		session: {
			cookieCache: {
				enabled: true,
				maxAge: 5 * 60,
			},
		},

		plugins: [
			captcha({
				provider: 'cloudflare-turnstile',
				secretKey: getTurnstileSecretKey(),
				endpoints: [...AUTH_CAPTCHA_ENDPOINTS],
			}),
			...(event === undefined || needsOauthProvider(deLocalizeUrl(event.url).pathname)
				? oauthProviderPlugins(applicationOrigin)
				: []),
			sveltekitCookies(getRequestEvent),
		],
	});
}
