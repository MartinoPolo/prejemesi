import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/auth.js', () => ({ createAuth: vi.fn() }));

import { createAuth } from '$lib/server/auth.js';
import { actions, load } from './+page.server.js';

const SIGNED_QUERY = 'client_id=client-1&redirect_uri=https%3A%2F%2Fai-app.example%2Fcb&sig=s';

function consentEvent(locals: Record<string, unknown>) {
	const url = new URL(`https://prejemesi.cz/oauth/consent?${SIGNED_QUERY}`);
	const form = new FormData();
	form.set('oauth_query', SIGNED_QUERY);
	form.append('scope', 'gifts:write');
	return {
		locals,
		url,
		request: new Request(url, { method: 'POST', body: form }),
		setHeaders: vi.fn(),
	};
}

type ConsentLoad = (event: ReturnType<typeof consentEvent>) => Promise<unknown>;
type ConsentAction = (event: ReturnType<typeof consentEvent>) => Promise<unknown>;

/** The page reads only what `consentEvent` provides. */
const loadConsent = load as unknown as ConsentLoad;
const acceptConsent = actions.accept as unknown as ConsentAction;
const denyConsent = actions.deny as unknown as ConsentAction;

const DEMO_LOCALS = {
	demoSession: { id: 'demo-session' },
	user: { id: 'demo-viewer', name: 'Demo', email: 'demo-viewer@demo.invalid' },
};

describe('/oauth/consent', () => {
	it('shows a demo visitor the demo state instead of the request', async () => {
		expect(await loadConsent(consentEvent(DEMO_LOCALS))).toEqual({ state: 'demo' });
		expect(createAuth).not.toHaveBeenCalled();
	});

	it.each([
		['a demo visitor', DEMO_LOCALS],
		['a signed-out visitor', {}],
	])('refuses to accept or deny for %s', async (_label, locals) => {
		await expect(acceptConsent(consentEvent(locals))).rejects.toMatchObject({ status: 403 });
		await expect(denyConsent(consentEvent(locals))).rejects.toMatchObject({ status: 403 });
		expect(createAuth).not.toHaveBeenCalled();
	});
});
