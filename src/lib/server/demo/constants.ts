export const DEMO_COOKIE_NAME = 'prejemesi_demo';
export const DEMO_LIFETIME_MS = 24 * 60 * 60 * 1000;
// Outlives the session so a visitor returning after expiry is offered a fresh playground.
export const DEMO_COOKIE_MAX_AGE_SECONDS = (DEMO_LIFETIME_MS / 1000) * 2;
export const DEMO_EDIT_REQUEST_LIMIT = 120;
export const DEMO_RESET_LIMIT = 5;
export const DEMO_CREATIONS_PER_CLIENT_WINDOW = 3;
export const DEMO_CLIENT_WINDOW_MS = DEMO_LIFETIME_MS;
export const DEMO_SESSION_CAPACITY = 500;
export const DEMO_CREATION_ADVISORY_LOCK_KEY = 433;
export const DEMO_CLEANUP_BATCH_SIZE = 5;
export const DEMO_CLEANUP_INTERVAL_MS = 60_000;
export const DEMO_WISHLIST_LIMIT = 16;
export const DEMO_GIFT_LIMIT = 400;

const DEMO_EMAIL_SUFFIX = '@demo.invalid';

export function demoEmailAddress(userId: string): string {
	return `${userId}${DEMO_EMAIL_SUFFIX}`;
}

export function isDemoEmailAddress(normalizedEmail: string): boolean {
	return normalizedEmail.endsWith(DEMO_EMAIL_SUFFIX);
}
