import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { magicLink } from 'better-auth/plugins/magic-link';
import { env } from '$env/dynamic/private';
import { getRequestEvent } from '$app/server';
import { getDb } from './db/index.js';
import { sendEmail, renderActionEmail } from './email.js';
import type { RequestEvent } from '@sveltejs/kit';

// Dev: Vite picks the next free port (5174, 5175, ...) when 5173 is taken.
// better-auth rejects sign-in when the request Origin doesn't match baseURL,
// so trust the default port plus the next 10 fallbacks during development.
const devTrustedOrigins = import.meta.env.DEV
	? Array.from({ length: 11 }, (_, i) => `http://localhost:${5173 + i}`)
	: [];

export function createAuth(event?: RequestEvent) {
	return betterAuth({
		baseURL: env.ORIGIN ?? 'http://localhost:5173',
		secret: env.AUTH_SECRET,
		trustedOrigins: devTrustedOrigins,

		database: drizzleAdapter(getDb(event), { provider: 'pg' }),

		emailAndPassword: {
			enabled: true,
			minPasswordLength: 8,
			maxPasswordLength: 128,
			autoSignIn: true,
			requireEmailVerification: true,
			resetPasswordTokenExpiresIn: 3600,
			sendResetPassword: async ({ user, url }) => {
				await sendEmail({
					to: user.email,
					subject: 'Reset your Přejeme si password',
					html: renderActionEmail({
						heading: 'Reset your password',
						body: 'We received a request to reset your password. This link expires in 1 hour.',
						buttonLabel: 'Reset password',
						url,
					}),
				});
			},
		},

		emailVerification: {
			sendOnSignUp: true,
			autoSignInAfterVerification: true,
			expiresIn: 3600,
			sendVerificationEmail: async ({ user, url }) => {
				await sendEmail({
					to: user.email,
					subject: 'Verify your Přejeme si email',
					html: renderActionEmail({
						heading: 'Confirm your email',
						body: 'Please confirm your email address to finish setting up your account. This link expires in 1 hour.',
						buttonLabel: 'Verify email',
						url,
					}),
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
			sveltekitCookies(getRequestEvent),
			magicLink({
				sendMagicLink: async ({ email, url }) => {
					await sendEmail({
						to: email,
						subject: 'Your Přejeme si sign-in link',
						html: renderActionEmail({
							heading: 'Sign in to Přejeme si',
							body: 'Click the button below to sign in. This link expires shortly and can only be used once.',
							buttonLabel: 'Sign in',
							url,
						}),
					});
				},
			}),
		],
	});
}
