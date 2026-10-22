import { describe, expect, it } from 'vitest';
import { SHARE_PLATFORM_INFO, SHARE_PLATFORM_ORDER } from './types.js';

const SHARE_URL = 'https://prejemesi.cz/w/abc123';
const MESSAGE = 'Ahoj! Tady je můj seznam přání: Vánoce & dárky';

function shareUrlFor(platform: keyof typeof SHARE_PLATFORM_INFO): URL {
	return new URL(SHARE_PLATFORM_INFO[platform].buildUrl(SHARE_URL, MESSAGE));
}

describe('share methods (issue #528)', () => {
	it('offers only methods with a standard prefilled intent, without Messenger', () => {
		expect(SHARE_PLATFORM_ORDER).toEqual(['whatsapp', 'email', 'telegram', 'sms']);
		expect(Object.keys(SHARE_PLATFORM_INFO)).not.toContain('messenger');
	});

	it('prefills WhatsApp with the message and link', () => {
		const url = shareUrlFor('whatsapp');

		expect(url.origin).toBe('https://wa.me');
		expect(url.pathname).toBe('/');
		expect(url.searchParams.get('text')).toBe(`${MESSAGE} ${SHARE_URL}`);
	});

	it('prefills Telegram with separate link and message', () => {
		const url = shareUrlFor('telegram');

		expect(`${url.origin}${url.pathname}`).toBe('https://t.me/share/url');
		expect(url.searchParams.get('url')).toBe(SHARE_URL);
		expect(url.searchParams.get('text')).toBe(MESSAGE);
	});

	it('prefills an e-mail subject and a body with the link, encoding spaces as %20', () => {
		const href = SHARE_PLATFORM_INFO.email.buildUrl(SHARE_URL, MESSAGE);
		const url = new URL(href);

		expect(url.protocol).toBe('mailto:');
		expect(url.searchParams.get('subject')).toBe('Můj seznam přání');
		expect(url.searchParams.get('body')).toBe(`${MESSAGE} ${SHARE_URL}`);
		expect(href).not.toContain('+');
	});

	it('prefills an SMS body in the form iOS and Android both accept', () => {
		const href = SHARE_PLATFORM_INFO.sms.buildUrl(SHARE_URL, MESSAGE);

		expect(href.startsWith('sms:?&body=')).toBe(true);
		expect(decodeURIComponent(href.slice('sms:?&body='.length))).toBe(
			`${MESSAGE} ${SHARE_URL}`,
		);
	});

	it('opens web intents in a new tab and app handoffs in place', () => {
		expect(SHARE_PLATFORM_INFO.whatsapp.opensInNewTab).toBe(true);
		expect(SHARE_PLATFORM_INFO.telegram.opensInNewTab).toBe(true);
		expect(SHARE_PLATFORM_INFO.email.opensInNewTab).toBe(false);
		expect(SHARE_PLATFORM_INFO.sms.opensInNewTab).toBe(false);
	});
});
