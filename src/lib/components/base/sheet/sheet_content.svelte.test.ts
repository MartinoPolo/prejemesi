import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import SheetContentTestHost from './SheetContentTestHost.svelte';
import type { Side } from './index.js';

const SIDES: readonly Side[] = ['top', 'right', 'bottom', 'left'];

describe('Sheet.Content', () => {
	it.each(SIDES)('does not elevate a %s sheet attached to the viewport edge', async (side) => {
		render(SheetContentTestHost, { side });
		const sheet = page.getByRole('dialog', { name: 'Sheet' });
		await expect.element(sheet).toBeVisible();

		expect(getComputedStyle(sheet.element()).boxShadow).toBe('none');
	});
});
