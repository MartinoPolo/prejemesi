import type { RequestHandler } from './$types.js';
import { agentApiIdempotentJsonEndpoint } from '$lib/server/agent_access/api.js';
import { uploadAgentImage } from '$lib/server/agent_access/image_upload.js';
import { agentImageStorage } from '$lib/server/storage/r2.js';

export const POST: RequestHandler = agentApiIdempotentJsonEndpoint(
	async ({ token, body }, event) => {
		const bucket = event.platform?.env.R2;
		return {
			body: {
				image: await uploadAgentImage(token, body.parsed, {
					// The global fetch, not SvelteKit's: the image host is never this app.
					fetch: (url, init) => fetch(url, init),
					storage: bucket && agentImageStorage(bucket),
				}),
			},
			status: 201,
		};
	},
);
