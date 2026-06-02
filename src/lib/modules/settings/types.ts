import * as v from 'valibot';
import { BACKGROUND_THEMES, type BackgroundTheme } from '$lib/components/base/theme/types.js';

/** User profile returned to the settings UI. */
export interface UserProfile {
	id: string;
	name: string;
	email: string;
	image: string | null;
	isOAuthUser: boolean;
	appBackgroundTheme: BackgroundTheme;
}

export const UpdateProfileInputSchema = v.object({
	name: v.pipe(v.string(), v.trim(), v.minLength(1)),
	image: v.nullable(v.string()),
});

/** App background theme preference input (REQ-3). */
export const UpdateAppBackgroundThemeInputSchema = v.object({
	appBackgroundTheme: v.picklist(BACKGROUND_THEMES),
});
