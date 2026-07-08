import { dev } from '$app/environment';
import { error } from '@sveltejs/kit';
import { ROBOTS_NOINDEX_CONTENT } from '$lib/seo/robots.js';
import type { RequestHandler } from './$types';
import htmlContent from '../../../docs/deployment-guide.html?raw';

export const GET: RequestHandler = () => {
	if (!dev) {
		error(404, 'Not found');
	}

	return new Response(htmlContent, {
		headers: {
			'Content-Type': 'text/html; charset=utf-8',
			'X-Robots-Tag': ROBOTS_NOINDEX_CONTENT,
		},
	});
};
