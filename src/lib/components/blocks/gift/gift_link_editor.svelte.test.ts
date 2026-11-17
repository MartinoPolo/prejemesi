import '../../../../app.css';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import * as m from '$lib/paraglide/messages.js';
import { MAX_GIFT_LINKS, type GiftLink } from '$lib/modules/gifts/types.js';
import GiftLinkEditorTestHost from './GiftLinkEditorTestHost.svelte';

// Issue #706 (Links): one line per link with the visible label highlighted inside the address or
// as a chip before it, inline expansion with Adresa / Viditelný popisek / Odebrat, paste-to-add as
// the last row, the 10-link limit with its „První je hlavní · N / 10“ counter, and reordering.

const HUDY = { url: 'https://www.hudy.cz/osprey-talon-22', label: 'Hudy' };
const HEUREKA = { url: 'https://www.heureka.cz/?h[fraze]=osprey' };
const NOVAK = { url: 'https://www.eshop-novak.cz/batohy/osprey', label: 'Obchod u Nováků' };

const hosts: HTMLElement[] = [];

async function renderEditor(initialLinks: GiftLink[], maxLinks?: number) {
	const host = document.createElement('div');
	host.style.width = '640px';
	document.body.append(host);
	hosts.push(host);
	const onlinkschange = vi.fn<(links: GiftLink[]) => void>();
	await render(
		GiftLinkEditorTestHost,
		{ initialLinks, maxLinks, onlinkschange },
		{ baseElement: host },
	);
	return { host, onlinkschange, lastLinks: () => onlinkschange.mock.lastCall?.[0] };
}

function rows(host: HTMLElement): HTMLElement[] {
	return Array.from(host.querySelectorAll<HTMLElement>('[data-gift-link-row]'));
}

function toggleOf(row: HTMLElement): HTMLButtonElement {
	return row.querySelector<HTMLButtonElement>('[data-gift-link-toggle]')!;
}

function pasteInputOf(host: HTMLElement): HTMLInputElement {
	return host.querySelector<HTMLInputElement>('[data-testid="gift-link-paste"]')!;
}

function paste(input: HTMLInputElement, text: string) {
	const clipboardData = new DataTransfer();
	clipboardData.setData('text/plain', text);
	input.focus();
	input.dispatchEvent(
		new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }),
	);
}

function nextFrame() {
	return new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
}

afterEach(async () => {
	for (const host of hosts.splice(0)) {
		host.remove();
	}
	await page.viewport(1280, 720);
});

describe('GiftLinkEditor one-line rows', () => {
	it('heads the list with Odkazy and the primary-link counter', async () => {
		const { host } = await renderEditor([HUDY, HEUREKA, NOVAK]);

		expect(host.textContent).toContain(m.gift_url_label());
		expect(host.textContent).toContain(m.gift_link_counter({ current: 3, max: 10 }));
	});

	it('highlights the visible label inside the muted address', async () => {
		const { host } = await renderEditor([HUDY, HEUREKA]);
		const [hudyRow, heurekaRow] = rows(host);

		const hudyMark = toggleOf(hudyRow!).querySelector('mark');
		expect(hudyMark?.textContent).toBe('hudy');
		expect(toggleOf(hudyRow!).textContent).toContain('www.hudy.cz/osprey-talon-22');
		expect(toggleOf(hudyRow!).textContent).not.toContain('https://');
		// Without a custom label the derived domain is the visible label.
		expect(toggleOf(heurekaRow!).querySelector('mark')?.textContent).toBe('heureka.cz');
	});

	it('shows a custom label missing from the address as a chip before it', async () => {
		const { host } = await renderEditor([NOVAK]);
		const toggle = toggleOf(rows(host)[0]!);

		expect(toggle.querySelector('mark')).toBeNull();
		const chip = Array.from(toggle.querySelectorAll('span')).find(
			(span) => span.textContent === 'Obchod u Nováků',
		);
		expect(chip).toBeDefined();
		expect(toggle.textContent!.indexOf('Obchod u Nováků')).toBeLessThan(
			toggle.textContent!.indexOf('www.eshop-novak.cz'),
		);
	});

	it('uses the 40 px control height on phones and the 32 px one on desktop', async () => {
		await page.viewport(390, 844);
		const { host } = await renderEditor([HUDY]);
		const line = toggleOf(rows(host)[0]!).parentElement!;
		const pasteRow = pasteInputOf(host).parentElement!;
		expect(line.getBoundingClientRect().height).toBe(40);
		expect(pasteRow.getBoundingClientRect().height).toBe(40);

		await page.viewport(1280, 720);
		await expect.poll(() => line.getBoundingClientRect().height).toBe(32);
		expect(pasteRow.getBoundingClientRect().height).toBe(32);
	});
});

describe('GiftLinkEditor inline expansion', () => {
	it('expands one row at a time into Adresa, Viditelný popisek and Odebrat', async () => {
		const { host } = await renderEditor([HUDY, HEUREKA]);
		const [hudyRow, heurekaRow] = rows(host);

		await userEvent.click(toggleOf(hudyRow!));
		expect(toggleOf(hudyRow!).getAttribute('aria-expanded')).toBe('true');
		const hudyPanel = hudyRow!.querySelector('[data-testid="gift-link-panel"]')!;
		expect(hudyPanel.textContent).toContain(m.gift_link_address());
		expect(hudyPanel.textContent).toContain(m.gift_link_visible_label());
		expect(hudyPanel.textContent).toContain(m.gift_link_remove());

		await userEvent.click(toggleOf(heurekaRow!));
		expect(toggleOf(heurekaRow!).getAttribute('aria-expanded')).toBe('true');
		expect(toggleOf(hudyRow!).getAttribute('aria-expanded')).toBe('false');
		expect(hudyRow!.querySelector('[data-testid="gift-link-panel"]')).toBeNull();

		await userEvent.click(toggleOf(heurekaRow!));
		expect(toggleOf(heurekaRow!).getAttribute('aria-expanded')).toBe('false');
	});

	it('collapses on Escape and returns focus to the row', async () => {
		const { host } = await renderEditor([HUDY]);
		const row = rows(host)[0]!;
		await userEvent.click(toggleOf(row));
		const addressInput = row.querySelector<HTMLInputElement>('[data-testid="gift-link-url"]')!;
		addressInput.focus();

		const escape = new KeyboardEvent('keydown', {
			key: 'Escape',
			bubbles: true,
			cancelable: true,
		});
		addressInput.dispatchEvent(escape);

		await expect.poll(() => toggleOf(row).getAttribute('aria-expanded')).toBe('false');
		// The dialog around the editor must not also take this Escape as dismissal.
		expect(escape.defaultPrevented).toBe(true);
		expect(document.activeElement).toBe(toggleOf(row));
	});

	it('leaves Escape on the row line to the dialog around the editor', async () => {
		const { host } = await renderEditor([HUDY]);
		const row = rows(host)[0]!;
		await userEvent.click(toggleOf(row));
		expect(toggleOf(row).getAttribute('aria-expanded')).toBe('true');

		const escape = new KeyboardEvent('keydown', {
			key: 'Escape',
			bubbles: true,
			cancelable: true,
		});
		toggleOf(row).dispatchEvent(escape);

		expect(escape.defaultPrevented).toBe(false);
	});

	it('collapses when focus leaves the row', async () => {
		const { host } = await renderEditor([HUDY]);
		const row = rows(host)[0]!;
		await userEvent.click(toggleOf(row));
		row.querySelector<HTMLInputElement>('[data-testid="gift-link-url"]')!.focus();

		pasteInputOf(host).focus();
		await nextFrame();

		await expect.poll(() => toggleOf(row).getAttribute('aria-expanded')).toBe('false');
	});

	it('edits the address and the visible label in place', async () => {
		const { host, lastLinks } = await renderEditor([HUDY]);
		const row = rows(host)[0]!;
		await userEvent.click(toggleOf(row));
		const addressInput = row.querySelector<HTMLInputElement>('[data-testid="gift-link-url"]')!;
		const labelInput = page.getByLabelText(m.gift_link_visible_label());

		await userEvent.fill(addressInput, 'https://www.alza.cz/batoh');
		expect(lastLinks()?.[0]?.url).toBe('https://www.alza.cz/batoh');
		await userEvent.clear(labelInput);
		await expect.element(labelInput).toHaveAttribute('placeholder', 'alza.cz');
		expect(lastLinks()?.[0]?.label).toBeUndefined();
		expect(toggleOf(row).querySelector('mark')?.textContent).toBe('alza.cz');

		await userEvent.fill(labelInput, 'Alza');
		expect(lastLinks()?.[0]).toMatchObject({ url: 'https://www.alza.cz/batoh', label: 'Alza' });
		expect(toggleOf(row).querySelector('mark')?.textContent).toBe('alza');
	});

	it('shows the invalid-address error for the edited link', async () => {
		const { host } = await renderEditor([HUDY]);
		const row = rows(host)[0]!;
		await userEvent.click(toggleOf(row));
		const addressInput = row.querySelector<HTMLInputElement>('[data-testid="gift-link-url"]')!;

		await userEvent.fill(addressInput, 'neni odkaz');

		expect(addressInput.getAttribute('aria-invalid')).toBe('true');
		expect(row.textContent).toContain(m.draft_grid_link_url_invalid());
	});

	it('removes the link with Odebrat', async () => {
		const { host, lastLinks } = await renderEditor([HUDY, HEUREKA]);
		const hudyRow = rows(host)[0]!;
		await userEvent.click(toggleOf(hudyRow));

		await userEvent.click(
			page.getByRole('button', { name: m.gift_link_remove(), exact: true }),
		);

		expect(lastLinks()?.map((link) => link.url)).toEqual([HEUREKA.url]);
		expect(rows(host)).toHaveLength(1);
		expect(host.textContent).toContain(m.gift_link_counter({ current: 1, max: 10 }));
	});
});

describe('GiftLinkEditor paste field', () => {
	it('adds a pasted link as the whole add flow', async () => {
		const { host, lastLinks } = await renderEditor([HUDY]);
		const pasteInput = pasteInputOf(host);
		expect(pasteInput.placeholder).toBe(m.gift_link_paste_placeholder());

		paste(pasteInput, '  https://www.alza.cz/batoh ');

		await expect.poll(() => rows(host)).toHaveLength(2);
		expect(lastLinks()?.map((link) => link.url)).toEqual([
			HUDY.url,
			'https://www.alza.cz/batoh',
		]);
		expect(pasteInput.value).toBe('');
		await expect.poll(() => host.textContent).toContain(m.gift_link_added());
	});

	it('adds a typed link on Enter and explains an invalid or duplicate one', async () => {
		const { host, lastLinks } = await renderEditor([HUDY]);
		const pasteInput = pasteInputOf(host);

		await userEvent.fill(pasteInput, 'neni odkaz');
		await userEvent.keyboard('{Enter}');
		expect(host.textContent).toContain(m.gift_link_invalid_url());
		expect(rows(host)).toHaveLength(1);

		await userEvent.fill(pasteInput, 'hudy.cz/osprey-talon-22');
		await userEvent.keyboard('{Enter}');
		expect(host.textContent).toContain(m.gift_link_duplicate_url());
		expect(rows(host)).toHaveLength(1);

		await userEvent.fill(pasteInput, 'alza.cz/batoh');
		await userEvent.keyboard('{Enter}');
		expect(lastLinks()?.at(-1)?.url).toBe('alza.cz/batoh');
		expect(rows(host)).toHaveLength(2);
	});

	it('disables the paste field at the link limit', async () => {
		const almostFull = Array.from({ length: MAX_GIFT_LINKS - 1 }, (_, index) => ({
			url: `https://shop${index}.example.cz/item`,
		}));
		const { host } = await renderEditor(almostFull);
		const pasteInput = pasteInputOf(host);
		expect(pasteInput.disabled).toBe(false);

		paste(pasteInput, 'https://www.alza.cz/batoh');

		await expect.poll(() => pasteInput.disabled).toBe(true);
		expect(rows(host)).toHaveLength(MAX_GIFT_LINKS);
		expect(pasteInput.placeholder).toBe(m.gift_link_max_reached());
		expect(host.textContent).toContain(m.gift_link_counter({ current: 10, max: 10 }));
	});
});

describe('GiftLinkEditor reorder', () => {
	it('moves a link with the arrow keys on its grip and keeps the grip focused', async () => {
		const { host, lastLinks } = await renderEditor([HUDY, HEUREKA, NOVAK]);
		const heurekaGrip = rows(host)[1]!.querySelector<HTMLElement>('[data-gift-link-grip]')!;
		expect(heurekaGrip.getAttribute('aria-label')).toBe(
			m.gift_link_move_label({ position: 2 }),
		);

		heurekaGrip.focus();
		await userEvent.keyboard('{ArrowUp}');

		expect(lastLinks()?.map((link) => link.url)).toEqual([HEUREKA.url, HUDY.url, NOVAK.url]);
		await expect
			.poll(() => document.activeElement?.closest('[data-gift-link-row]'))
			.toBe(rows(host)[0]);
		await expect
			.poll(() => host.textContent)
			.toContain(m.gift_link_moved_primary({ count: 3 }));

		await userEvent.keyboard('{ArrowDown}');
		await userEvent.keyboard('{ArrowDown}');
		expect(lastLinks()?.map((link) => link.url)).toEqual([HUDY.url, NOVAK.url, HEUREKA.url]);
		await expect
			.poll(() => host.textContent)
			.toContain(m.gift_link_moved({ position: 3, count: 3 }));
	});

	it('offers no grip for a single link', async () => {
		const { host } = await renderEditor([HUDY]);
		expect(host.querySelector('[data-gift-link-grip]')).toBeNull();
	});
});
