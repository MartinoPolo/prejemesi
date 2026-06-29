import type { RequestHandler } from './$types';
import htmlContent from '../../../docs/deployment-guide.html?raw';

export const GET: RequestHandler = () => {
	return new Response(htmlContent, {
		headers: { 'Content-Type': 'text/html; charset=utf-8' },
	});
};
