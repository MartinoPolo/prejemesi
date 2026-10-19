import type { Actions, PageServerLoad, RequestEvent } from './$types';
import { error, fail, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { getActiveLocaleForUrl, localizeInternalHref } from '$lib/i18n/locale.js';
import { createAuth } from '$lib/server/auth.js';
import {
	acceptOauthConsent,
	acceptedScopes,
	loadOauthConsent,
	redirectSourceOf,
	readOauthConsentRequest,
	type OauthConsentRequest,
} from '$lib/server/agent_access/oauth_consent.js';
import { WISHLIST_RESTRICTION } from '$lib/components/blocks/access-tokens/access_token_form.js';
import {
	CONTENT_SECURITY_POLICY_HEADER,
	contentSecurityPolicy,
} from '$lib/server/content_security_policy.js';

const CONSENT_FAILED = 'consent_failed';

async function signedRequest(
	event: RequestEvent,
	searchParams: URLSearchParams,
): Promise<OauthConsentRequest | null> {
	const { secret } = await createAuth(event).$context;
	return readOauthConsentRequest(searchParams, secret);
}

/** The signed-in user who decides; demo visitors never connect apps. */
function deciderOf({ locals }: RequestEvent) {
	if (locals.demoSession !== undefined || locals.user === undefined) {
		error(403, 'Only a signed-in account can connect an app');
	}
	return locals.user;
}

/** Where the provider answered the decision, as a URL the browser follows to the app. */
function redirectUrlOf(answer: unknown): string {
	if (
		typeof answer === 'object' &&
		answer !== null &&
		'url' in answer &&
		typeof answer.url === 'string'
	) {
		return answer.url;
	}
	throw new Error('The OAuth consent answered without a redirect URL');
}

async function postedRequest(event: RequestEvent, form: FormData) {
	const oauthQuery = form.get('oauth_query');
	return typeof oauthQuery === 'string'
		? signedRequest(event, new URLSearchParams(oauthQuery))
		: null;
}

export const load: PageServerLoad = async (event) => {
	const { locals, url } = event;
	if (locals.demoSession !== undefined) {
		return { state: 'demo' as const };
	}
	if (locals.user === undefined) {
		// Signing in forwards the signed query, so the authorization continues afterwards.
		redirect(
			303,
			`${localizeInternalHref(resolve('/login'), getActiveLocaleForUrl(url))}${url.search}`,
		);
	}
	const request = await signedRequest(event, url.searchParams);
	const consent = request === null ? null : await loadOauthConsent(locals.user.id, request);
	if (request === null || consent === null) {
		return { state: 'invalid' as const };
	}
	const redirectSource = redirectSourceOf(request);
	event.setHeaders({
		[CONTENT_SECURITY_POLICY_HEADER]: contentSecurityPolicy(
			redirectSource === null ? [] : [redirectSource],
		),
	});
	return {
		state: 'ready' as const,
		consent,
		oauthQuery: request.oauthQuery,
		account: { name: locals.user.name, email: locals.user.email },
	};
};

export const actions: Actions = {
	accept: async (event) => {
		const user = deciderOf(event);
		const form = await event.request.formData();
		const request = await postedRequest(event, form);
		if (request === null) {
			return fail(400, { error: CONSENT_FAILED });
		}
		const restricted = form.get('restriction') === WISHLIST_RESTRICTION.some;
		let location: string;
		try {
			location = await acceptOauthConsent({
				userId: user.id,
				request,
				scopes: acceptedScopes(request, form.getAll('scope').map(String)),
				wishlistIds: restricted ? form.getAll('wishlistId').map(String) : null,
				consent: async (scope) =>
					redirectUrlOf(
						await createAuth(event).api.oauth2Consent({
							body: { accept: true, scope, oauth_query: request.oauthQuery },
							headers: event.request.headers,
							request: event.request,
							asResponse: false,
						}),
					),
			});
		} catch (thrown) {
			console.error('[oauth] consent failed', thrown);
			return fail(400, { error: CONSENT_FAILED });
		}
		redirect(303, location);
	},
	deny: async (event) => {
		deciderOf(event);
		const request = await postedRequest(event, await event.request.formData());
		if (request === null) {
			return fail(400, { error: CONSENT_FAILED });
		}
		const answer = await createAuth(event).api.oauth2Consent({
			body: { accept: false, oauth_query: request.oauthQuery },
			headers: event.request.headers,
			request: event.request,
			asResponse: false,
		});
		redirect(303, redirectUrlOf(answer));
	},
};
