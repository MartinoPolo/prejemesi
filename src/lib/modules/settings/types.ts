import * as v from 'valibot';
import { SUPPORTED_LOCALES, type SupportedLocale } from '$lib/i18n/locale.js';
import { isPalette, type Palette } from '$lib/theme/palettes.js';

/** User profile returned to the settings UI. */
export interface UserProfile {
	id: string;
	name: string;
	email: string;
	image: string | null;
	isOAuthUser: boolean;
	preferredLocale: SupportedLocale | null;
}

export const UpdateProfileInputSchema = v.object({
	name: v.pipe(v.string(), v.trim(), v.minLength(1)),
	image: v.nullable(v.string()),
});

export const UpdatePreferredLocaleInputSchema = v.object({
	preferredLocale: v.picklist(SUPPORTED_LOCALES),
});

/** App-level palette preference input (Redesign 2026, issue #102). Validated via isPalette(). */
export const SetUserPaletteInputSchema = v.custom<Palette>(isPalette);
