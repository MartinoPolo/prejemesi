/**
 * Storybook runs without a SvelteKit server, so the `$env/dynamic/public`
 * virtual module has no payload to read and crashes at import. Stories get an
 * empty env instead – image helpers then use their local-dev fallbacks
 * (original URLs, same-origin upload paths).
 */
export const env: Record<string, string | undefined> = {};
