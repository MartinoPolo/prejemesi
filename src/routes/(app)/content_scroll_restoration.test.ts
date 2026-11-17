import { describe, expect, it } from 'vitest';
import type { NavigationTarget, NavigationType } from '@sveltejs/kit';
import {
	contentScrollRestoreTop,
	navigationStartsContentAtTop,
} from './content_scroll_restoration.svelte.js';

const settled = {
	targetTop: 900,
	maximumTop: 3000,
	contentLoading: false,
	contentGrowing: false,
	timedOut: false,
};

describe('content scroll restore offset', () => {
	it('restores the saved offset once the content reaches it', () => {
		expect(contentScrollRestoreTop(settled)).toBe(900);
	});

	it('waits while content above may still change, even when the offset is reachable', () => {
		expect(contentScrollRestoreTop({ ...settled, contentLoading: true })).toBeNull();
	});

	it('waits for gifts still mounting rather than settling at a clamped offset', () => {
		expect(
			contentScrollRestoreTop({ ...settled, maximumTop: 400, contentGrowing: true }),
		).toBeNull();
	});

	it('restores a reachable offset while gifts below it are still mounting', () => {
		expect(contentScrollRestoreTop({ ...settled, contentGrowing: true })).toBe(900);
	});

	it('ends at the bottom when the complete content is now shorter', () => {
		expect(contentScrollRestoreTop({ ...settled, maximumTop: 400 })).toBe(400);
	});

	it('gives up waiting at the closest offset', () => {
		expect(
			contentScrollRestoreTop({
				...settled,
				maximumTop: 400,
				contentLoading: true,
				timedOut: true,
			}),
		).toBe(400);
	});
});

function navigation(type: NavigationType, from: string | null, to: string) {
	const target = (href: string): NavigationTarget => ({
		url: new URL(href, 'http://localhost'),
		params: {},
		route: { id: null },
		scroll: null,
	});
	return { type, from: from === null ? null : target(from), to: target(to) };
}

const noFragmentTarget = () => false;

describe('navigation scroll start', () => {
	it('ignores state changes outside a navigation', () => {
		expect(
			navigationStartsContentAtTop({ type: null, from: null, to: null }, noFragmentTarget),
		).toBe(false);
	});

	it('starts at the top when only the query changes', () => {
		expect(
			navigationStartsContentAtTop(
				navigation('goto', '/w/abc', '/w/abc?gift=1'),
				noFragmentTarget,
			),
		).toBe(true);
	});

	it.each(['link', 'goto', 'form'] as const)(
		'starts a new page at the top after a %s',
		(type) => {
			expect(
				navigationStartsContentAtTop(
					navigation(type, '/my-lists', '/w/abc'),
					noFragmentTarget,
				),
			).toBe(true);
		},
	);

	it('starts back and forward at the top for the snapshot to restore', () => {
		expect(
			navigationStartsContentAtTop(
				navigation('popstate', '/w/abc', '/my-lists'),
				noFragmentTarget,
			),
		).toBe(true);
	});

	it('keeps the position on the first load', () => {
		expect(
			navigationStartsContentAtTop(navigation('enter', null, '/w/abc'), noFragmentTarget),
		).toBe(false);
	});

	it('keeps the position when only the locale changes', () => {
		expect(
			navigationStartsContentAtTop(
				navigation('goto', '/w/abc', '/en/w/abc'),
				noFragmentTarget,
			),
		).toBe(false);
	});

	it('starts at the top when the same route shows other content', () => {
		expect(
			navigationStartsContentAtTop(navigation('link', '/w/abc', '/w/def'), noFragmentTarget),
		).toBe(true);
	});

	it('keeps the position SvelteKit scrolled to a fragment target', () => {
		expect(
			navigationStartsContentAtTop(
				navigation('link', '/my-lists', '/w/abc#gift'),
				() => true,
			),
		).toBe(false);
	});

	it('starts at the top when the fragment names nothing on the page', () => {
		expect(
			navigationStartsContentAtTop(
				navigation('link', '/my-lists', '/w/abc#missing'),
				noFragmentTarget,
			),
		).toBe(true);
	});
});
