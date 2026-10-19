import { createAuthClient } from 'better-auth/svelte';
import { oauthProviderClient } from '@better-auth/oauth-provider/client';

/** The plugin forwards an app's signed authorization query from the page URL on sign-in. */
export const authClient = createAuthClient({ plugins: [oauthProviderClient()] });
