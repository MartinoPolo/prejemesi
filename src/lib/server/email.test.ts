import { describe, expect, it } from 'vitest';
import { renderActionEmail, renderActionEmailText } from './email.js';

describe('action email rendering', () => {
	it('escapes user-controlled HTML in the HTML body', () => {
		expect.assertions(3);

		const html = renderActionEmail({
			heading: 'Gift reserved',
			body: 'Wishlist: <img src=x onerror=alert(1)>',
			buttonLabel: 'Open wishlist',
			url: 'https://prejemesi.cz/w/test?x="bad"',
		});

		expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
		expect(html).toContain('https://prejemesi.cz/w/test?x=&quot;bad&quot;');
		expect(html).not.toContain('<img src=x onerror=alert(1)>');
	});

	it('renders a plain-text alternative', () => {
		expect.assertions(1);

		const text = renderActionEmailText({
			heading: 'Sign in',
			body: 'Use this one-time link.',
			buttonLabel: 'Sign in',
			url: 'https://prejemesi.cz/magic',
		});

		expect(text).toContain('Sign in: https://prejemesi.cz/magic');
	});
});
