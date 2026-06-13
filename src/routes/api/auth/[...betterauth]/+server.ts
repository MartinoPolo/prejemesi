import { createAuth } from '$lib/server/auth.js';
import { toSvelteKitHandler } from 'better-auth/svelte-kit';
import type { RequestHandler } from './$types';

// toSvelteKitHandler unwraps the SvelteKit RequestEvent and forwards
// event.request to better-auth. Passing the event directly makes better-auth
// see no request method/headers and 404 every auth route.
const handler: RequestHandler = (event) => toSvelteKitHandler(createAuth(event))(event);

export const GET = handler;
export const POST = handler;
