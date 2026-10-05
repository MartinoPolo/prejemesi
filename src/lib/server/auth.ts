import { betterAuth } from 'better-auth/minimal';
import { createAuthMiddleware, APIError } from 'better-auth/api';
import { eq } from 'drizzle-orm';
import { user as userTable } from './db/auth.schema.js';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { captcha } from 'better-auth/plugins';
import { env } from '$env/dynamic/private';
import { getRequestEvent } from '$app/server';
import { getDb } from './db/index.js';
import { sendEmail, renderActionEmailParts } from './email.js';
import { getTurnstileSecretKey } from './turnstile.js';
import { isDemoEmailAddress } from './demo/constants.js';
import type { RequestEvent } from '@sveltejs/kit';
import { AUTH_CAPTCHA_ENDPOINTS, AUTH_IP_ADDRESS_HEADERS, authRateLimit } from './auth_security.js';
import { resolveAuthOrigins } from '$lib/config/runtime_environment.js';

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

export function createAuth(event?: RequestEvent) {
	const authOrigins = resolveAuthOrigins(env, import.meta.env.DEV);
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
			sveltekitCookies(getRequestEvent),
		],
	});
}
