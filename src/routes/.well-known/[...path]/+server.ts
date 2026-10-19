import type { RequestHandler } from './$types';
import { createAuth } from '$lib/server/auth.js';

// OAuth discovery lives at the origin root, outside BetterAuth's base path; the provider plugins
// answer the authorization-server and protected-resource metadata, and anything else is a 404.
const handler: RequestHandler = (event) => createAuth(event).handler(event.request);

export const GET = handler;
export const HEAD = handler;
