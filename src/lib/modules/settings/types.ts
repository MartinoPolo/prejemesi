import * as v from 'valibot';
import { SUPPORTED_LOCALES, type SupportedLocale } from '$lib/i18n/locale.js';

/**
 * App background theme preference values (REQ-3). Domain-owned so the persistence
 * layer (DB enum, validation) does not depend on a UI component; `base/theme`
 * re-exports these for component-side consumers.
 */
export const BACKGROUND_THEMES = ['default', 'golden-hour', 'twilight'] as const;
export type BackgroundTheme = (typeof BACKGROUND_THEMES)[number];

export function isBackgroundTheme(value: unknown): value is BackgroundTheme {
	return typeof value === 'string' && (BACKGROUND_THEMES as readonly string[]).includes(value);
}

/** User profile returned to the settings UI. */
export interface UserProfile {
	id: string;
	name: string;
	email: string;
	image: string | null;
	isOAuthUser: boolean;
	appBackgroundTheme: BackgroundTheme;
	preferredLocale: SupportedLocale | null;
}

export const UpdateProfileInputSchema = v.object({
	name: v.pipe(v.string(), v.trim(), v.minLength(1)),
	image: v.nullable(v.string()),
});

/** App background theme preference input (REQ-3). */
export const UpdateAppBackgroundThemeInputSchema = v.object({
	appBackgroundTheme: v.picklist(BACKGROUND_THEMES),
});

export const UpdatePreferredLocaleInputSchema = v.object({
	preferredLocale: v.picklist(SUPPORTED_LOCALES),
});
