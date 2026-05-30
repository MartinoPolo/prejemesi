import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { env } from '$env/dynamic/private';
import { getRequestEvent } from '$app/server';
import { getDb } from './db/index.js';

export const auth = betterAuth({
	baseURL: env.ORIGIN ?? 'http://localhost:5173',
	secret: env.AUTH_SECRET,

	database: drizzleAdapter(getDb(), { provider: 'pg' }),

	emailAndPassword: {
		enabled: true,
		minPasswordLength: 8,
		maxPasswordLength: 128,
		autoSignIn: true,
		requireEmailVerification: false, // set to true in production
		resetPasswordTokenExpiresIn: 3600,
		sendResetPassword: async ({ user, url }) => {
			// TODO: replace with your email service (e.g. Resend, SendGrid, Postmark)
			console.log(`[Auth] Password reset for ${user.email}: ${url}`);
		},
	},

	emailVerification: {
		sendOnSignUp: false, // set to true in production
		autoSignInAfterVerification: true,
		expiresIn: 3600,
		sendVerificationEmail: async ({ user, url }) => {
			// TODO: replace with your email service
			console.log(`[Auth] Verification email for ${user.email}: ${url}`);
		},
	},

	socialProviders:
		env.GOOGLE_CLIENT_ID !== undefined && env.GOOGLE_CLIENT_SECRET !== undefined
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

	plugins: [sveltekitCookies(getRequestEvent)],
});
