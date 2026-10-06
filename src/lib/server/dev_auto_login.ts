import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import type { createAuth } from './auth.js';
import { SEED_PASSWORD } from './db/seed_credentials.js';

export const DEV_AUTO_LOGIN_OPT_OUT_COOKIE_NAME = 'dev-auto-login-opt-out';

/** Seeded account a signed-out development browser is signed in as; never active outside dev. */
export function getDevAutoLoginEmail(): string | undefined {
	const email = env.DEV_AUTO_LOGIN_EMAIL?.trim();
	return dev && email ? email : undefined;
}

/**
 * Signing out pauses auto-login so signed-out states stay reachable; any sign-in resumes it, so a
 * later lost session (for example after `pnpm db:seed`) is restored again.
 */
export function devAutoLoginOptOutChange(
	pathname: string,
): { value: string; maxAge?: number } | undefined {
	if (pathname === '/api/auth/sign-out') {
		return { value: '1' };
	}
	if (pathname.startsWith('/api/auth/sign-in/')) {
		return { value: '', maxAge: 0 };
	}
	return undefined;
}

/** Signs in through the server API, which skips the browser-only CAPTCHA request hook. */
export async function signInForDevelopment(
	auth: ReturnType<typeof createAuth>,
	email: string,
	headers: Headers,
): Promise<boolean> {
	try {
		await auth.api.signInEmail({ body: { email, password: SEED_PASSWORD }, headers });
		return true;
	} catch (failure) {
		console.warn(`[devAutoLogin] sign-in as ${email} failed; is the database seeded?`, failure);
		return false;
	}
}
