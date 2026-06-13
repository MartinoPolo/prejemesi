import type { Reroute, Transport } from '@sveltejs/kit';
import { deLocalizeUrl } from '$lib/paraglide/runtime';

export const transport: Transport = {};

export const reroute: Reroute = (request) => {
	return deLocalizeUrl(request.url).pathname;
};
