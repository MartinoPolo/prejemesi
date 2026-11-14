import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { describe, expect, it, vi } from 'vitest';
import { tick } from 'svelte';
import { createPixelAssertions } from '../../../../../tests/helpers/pixel-assertions.mjs';
import ActiveFilterPillsTestHost from './ActiveFilterPillsTestHost.svelte';
import FilterMenu from './FilterMenu.svelte';
import type { FilterDefinition, FilterFacetGroup } from './filter_menu_types.js';

const { expectPixelsNear, expectPixelsAtLeast, expectPixelsAtMost } = createPixelAssertions(expect);
vi.mock('$env/dynamic/public', () => ({ env: {} }));

function baseProps() {
	return {
		triggerLabel: 'Filtr',
		menuHeading: 'Filtr',
		clearAllLabel: 'Vymazat',
		onclearall: () => {},
		removeFilterLabel: (label: string) => `Odebrat ${label}`,
		activeCountLabel: (count: number) => `${count} aktivních`,
	};
}

describe('FilterMenu facets', () => {
	it('exposes headings separately from selectable filter options', async () => {
		const definitions: FilterDefinition[] = [
			{ id: 'available', menuLabel: 'Dostupné', checked: false, onchange: () => {} },
		];
		const facets: FilterFacetGroup[] = [
			{
				id: 'category',
				label: 'Kategorie',
				options: [
					{ value: 'books', label: 'Knihy', checked: false, onchange: () => {} },
					{ value: 'toys', label: 'Hračky', checked: true, onchange: () => {} },
				],
			},
		];
		const host = document.createElement('div');
		document.body.appendChild(host);
		const screen = await render(
			FilterMenu,
			{ ...baseProps(), definitions, facets },
			{ baseElement: host },
		);

		await screen.getByRole('button', { name: 'Filtr' }).click();

		const headings = document.querySelectorAll<HTMLElement>('[data-filter-group-heading]');
		expect(headings).toHaveLength(2);
		expect([...headings].map((heading) => heading.textContent?.trim())).toEqual([
			'Filtr',
			'Kategorie',
		]);
		const options = document.querySelectorAll<HTMLElement>('[data-filter-option]');
		expect(options).toHaveLength(3);
		expect([...options].map((option) => option.getAttribute('role'))).toEqual([
			'menuitemcheckbox',
			'menuitemcheckbox',
			'menuitemcheckbox',
		]);
		expect(options[1]).toHaveAttribute('aria-checked', 'false');
		expect(options[2]).toHaveAttribute('aria-checked', 'true');
	});

	it('inherits viewport-only containment from shared dropdown content', async () => {
		const definitions: FilterDefinition[] = [
			{ id: 'available', menuLabel: 'Dostupné', checked: false, onchange: () => {} },
		];
		const host = document.createElement('div');
		document.body.appendChild(host);
		const screen = await render(
			FilterMenu,
			{ ...baseProps(), definitions },
			{ baseElement: host },
		);

		await screen.getByRole('button', { name: 'Filtr' }).click();
		const content = document.querySelector<HTMLElement>('[data-slot="dropdown-menu-content"]');
		expect(content).not.toBeNull();
		expect(getComputedStyle(content!).maxHeight).toBe(`${window.innerHeight - 16}px`);
		expect(getComputedStyle(content!).overflowY).toBe('auto');
	});

	it('keeps a full-height constrained menu inside the viewport', async () => {
		const definitions: FilterDefinition[] = Array.from({ length: 12 }, (_, index) => ({
			id: `option-${index}`,
			menuLabel: `Možnost ${index}`,
			checked: false,
			onchange: () => {},
		}));
		const host = document.createElement('div');
		document.body.appendChild(host);
		const screen = await render(
			FilterMenu,
			{ ...baseProps(), definitions },
			{ baseElement: host },
		);
		const trigger = screen.getByRole('button', { name: 'Filtr' }).element();
		trigger.style.position = 'fixed';
		trigger.style.top = '50vh';
		trigger.style.left = '50vw';
		trigger.style.width = 'max-content';

		await screen.getByRole('button', { name: 'Filtr' }).click();
		const content = document.querySelector<HTMLElement>('[data-slot="dropdown-menu-content"]');
		expect(content).not.toBeNull();
		const rect = content!.getBoundingClientRect();
		expectPixelsAtLeast(rect.top, 7);
		expectPixelsAtMost(rect.bottom, window.innerHeight - 7);
		expectPixelsNear(content!.clientHeight, content!.scrollHeight);
	});

	it('counts each selected facet value as one active filter and renders a pill', async () => {
		const definitions: FilterDefinition[] = [
			{ id: 'available', menuLabel: 'Dostupné', checked: true, onchange: () => {} },
		];
		const facets: FilterFacetGroup[] = [
			{
				id: 'category',
				label: 'Kategorie',
				options: [
					{ value: 'books', label: 'Knihy', checked: true, onchange: () => {} },
					{ value: 'toys', label: 'Hračky', checked: false, onchange: () => {} },
				],
			},
		];

		const host = document.createElement('div');
		document.body.appendChild(host);
		await render(FilterMenu, { ...baseProps(), definitions, facets }, { baseElement: host });
		await tick();

		const trigger = document.querySelector('button') as HTMLElement;
		expect(trigger.textContent).toContain('2');

		const pills = document.querySelector('[data-filter-pills]') as HTMLElement;
		expect(pills.textContent).toContain('Dostupné');
		expect(pills.textContent).toContain('Knihy');
		expect(pills.textContent).not.toContain('Hračky');
	});

	it('removes a filter reactively, hides its pill, and moves focus to the next pill', async () => {
		const host = document.createElement('div');
		document.body.appendChild(host);
		const screen = await render(ActiveFilterPillsTestHost, {}, { baseElement: host });

		await screen.getByRole('button', { name: 'Odebrat První' }).click();

		await expect
			.element(screen.getByRole('button', { name: 'Odebrat První' }))
			.not.toBeInTheDocument();
		expect(document.activeElement).toBe(
			screen.getByRole('button', { name: 'Odebrat Druhý' }).element(),
		);
	});

	it('moves focus to the previous pill when removing the final active pill', async () => {
		const host = document.createElement('div');
		document.body.appendChild(host);
		const screen = await render(ActiveFilterPillsTestHost, {}, { baseElement: host });

		await screen.getByRole('button', { name: 'Odebrat Druhý' }).click();

		await expect
			.element(screen.getByRole('button', { name: 'Odebrat Druhý' }))
			.not.toBeInTheDocument();
		expect(document.activeElement).toBe(
			screen.getByRole('button', { name: 'Odebrat První' }).element(),
		);
	});

	it('restores trigger focus when removing the sole active pill', async () => {
		const host = document.createElement('div');
		document.body.appendChild(host);
		const screen = await render(
			ActiveFilterPillsTestHost,
			{ initialActiveIds: ['first'] },
			{ baseElement: host },
		);

		await screen.getByRole('button', { name: 'Odebrat První' }).click();

		await expect
			.element(screen.getByRole('button', { name: 'Odebrat První' }))
			.not.toBeInTheDocument();
		expect(document.activeElement).toBe(
			screen.getByRole('button', { name: 'Filtr' }).element(),
		);
	});

	it('clears filters reactively, hides all pills, and restores trigger focus', async () => {
		const host = document.createElement('div');
		document.body.appendChild(host);
		const screen = await render(ActiveFilterPillsTestHost, {}, { baseElement: host });

		await screen.getByRole('button', { name: 'Vymazat' }).click();

		await expect
			.element(screen.getByRole('button', { name: 'Odebrat První' }))
			.not.toBeInTheDocument();
		await expect
			.element(screen.getByRole('button', { name: 'Odebrat Druhý' }))
			.not.toBeInTheDocument();
		expect(document.activeElement).toBe(
			screen.getByRole('button', { name: 'Filtr' }).element(),
		);
	});

	it('keeps the default layout wrapping with compact remove buttons', async () => {
		const host = document.createElement('div');
		host.style.width = '160px';
		document.body.appendChild(host);
		const screen = await render(
			ActiveFilterPillsTestHost,
			{ initialActiveIds: ['first', 'second', 'third', 'fourth'] },
			{ baseElement: host },
		);

		const pillFaceTops = Array.from(
			host.querySelectorAll<HTMLElement>('[data-active-filter-pill]'),
			(pillFace) => pillFace.getBoundingClientRect().top,
		);
		expect(pillFaceTops.at(-1)!).toBeGreaterThan(pillFaceTops[0]!);
		const remove = screen.getByRole('button', { name: 'Odebrat První' }).element();
		expectPixelsNear(remove.getBoundingClientRect().height, 24);
		expectPixelsNear(remove.getBoundingClientRect().width, 24);
		host.remove();
	});

	it('keeps the scroll layout on one horizontally scrolling row of 40 px pill targets', async () => {
		const host = document.createElement('div');
		host.style.width = '240px';
		document.body.appendChild(host);
		const screen = await render(
			ActiveFilterPillsTestHost,
			{ initialActiveIds: ['first', 'second', 'third', 'fourth'], layout: 'scroll' },
			{ baseElement: host },
		);

		const row = host.querySelector<HTMLElement>('[data-filter-pills]')!;
		expect(row.scrollWidth).toBeGreaterThan(row.clientWidth);

		const targets = [
			...[
				'První',
				'Druhý',
				'Třetí obchod s dlouhým názvem',
				'Čtvrtý obchod s dlouhým názvem',
			].map((label) => screen.getByRole('button', { name: `Odebrat ${label}` }).element()),
			screen.getByRole('button', { name: 'Vymazat' }).element(),
		];
		const firstTop = targets[0]!.getBoundingClientRect().top;
		for (const target of targets) {
			const bounds = target.getBoundingClientRect();
			expectPixelsAtLeast(bounds.height, 40);
			expectPixelsNear(bounds.top, firstTop);
		}
		await expect
			.element(screen.getByRole('button', { name: 'Odebrat Třetí obchod s dlouhým názvem' }))
			.toHaveAttribute('title', 'Třetí obchod s dlouhým názvem');
		host.remove();
	});

	it('removes a whole scroll-layout pill and moves focus like the wrapping layout', async () => {
		const host = document.createElement('div');
		document.body.appendChild(host);
		const screen = await render(
			ActiveFilterPillsTestHost,
			{ layout: 'scroll' },
			{ baseElement: host },
		);

		await screen.getByText('První').click();
		await expect
			.element(screen.getByRole('button', { name: 'Odebrat První' }))
			.not.toBeInTheDocument();
		expect(document.activeElement).toBe(
			screen.getByRole('button', { name: 'Odebrat Druhý' }).element(),
		);

		await screen.getByRole('button', { name: 'Odebrat Druhý' }).click();
		await expect
			.element(screen.getByRole('button', { name: 'Odebrat Druhý' }))
			.not.toBeInTheDocument();
		expect(document.activeElement).toBe(
			screen.getByRole('button', { name: 'Filtr' }).element(),
		);
		host.remove();
	});

	it('disables every scroll-layout pill and the clear action together', async () => {
		const host = document.createElement('div');
		document.body.appendChild(host);
		const screen = await render(
			ActiveFilterPillsTestHost,
			{ layout: 'scroll', disabled: true },
			{ baseElement: host },
		);

		await expect.element(screen.getByRole('button', { name: 'Odebrat První' })).toBeDisabled();
		await expect.element(screen.getByRole('button', { name: 'Odebrat Druhý' })).toBeDisabled();
		await expect.element(screen.getByRole('button', { name: 'Vymazat' })).toBeDisabled();
		host.remove();
	});

	it('renders no facet group when the prop is omitted', async () => {
		const definitions: FilterDefinition[] = [
			{ id: 'available', menuLabel: 'Dostupné', checked: false, onchange: () => {} },
		];
		const host = document.createElement('div');
		document.body.appendChild(host);
		await render(FilterMenu, { ...baseProps(), definitions }, { baseElement: host });
		await tick();

		expect(document.body.textContent).not.toContain('Kategorie');
	});
});
