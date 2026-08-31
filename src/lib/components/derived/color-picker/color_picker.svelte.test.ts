import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import ColorPicker from './ColorPicker.svelte';

const label = 'Sport color';

function nativeFallback(): HTMLInputElement {
	return document.querySelector<HTMLInputElement>('input[type="color"]')!;
}

describe('ColorPicker', () => {
	it('renders only a styled rounded-square trigger while closed', async () => {
		const screen = render(ColorPicker, { value: '#0369A1', label });
		const trigger = screen.getByRole('button', { name: label });

		await expect.element(trigger).toBeVisible();
		expect(trigger.element().className).toContain('rounded-btn');
		expect(getComputedStyle(trigger.element()).backgroundColor).toBe('rgb(3, 105, 161)');
		expect(nativeFallback().className).toContain('sr-only');
		await expect.element(page.getByRole('dialog', { name: label })).not.toBeInTheDocument();
	});

	it('opens from the keyboard and Escape closes and restores trigger focus', async () => {
		const screen = render(ColorPicker, { value: '#0369A1', label });
		const trigger = screen.getByRole('button', { name: label });
		trigger.element().focus();

		await userEvent.keyboard('{Enter}');
		await expect.element(page.getByRole('dialog', { name: label })).toBeVisible();
		await userEvent.keyboard('{Escape}');
		await expect.element(page.getByRole('dialog', { name: label })).not.toBeInTheDocument();
		expect(document.activeElement).toBe(trigger.element());
	});

	it('can be reached with Tab and opened with Space', async () => {
		const screen = render(ColorPicker, { value: '#0369A1', label });
		const trigger = screen.getByRole('button', { name: label });

		await userEvent.tab();
		expect(document.activeElement).toBe(trigger.element());
		await userEvent.keyboard(' ');
		await expect.element(page.getByRole('dialog', { name: label })).toBeVisible();
	});

	it('does not open while disabled', async () => {
		const screen = render(ColorPicker, { value: '#0369A1', label, disabled: true });
		const trigger = screen.getByRole('button', { name: label });

		await expect.element(trigger).toBeDisabled();
		await trigger.click({ force: true });
		await expect.element(page.getByRole('dialog', { name: label })).not.toBeInTheDocument();
	});

	it('renders 20 keyboard-operable presets and exposes selection', async () => {
		const screen = render(ColorPicker, { value: '#000000', label });
		await screen.getByRole('button', { name: label }).click();
		const group = page.getByRole('group', { name: m.color_picker_presets() });
		const swatches = group.element().querySelectorAll('button');

		expect(swatches).toHaveLength(20);
		(swatches.item(17) as HTMLButtonElement).focus();
		await userEvent.tab();
		expect(document.activeElement).toBe(
			group.getByRole('button', { name: '#000000' }).element(),
		);
		await userEvent.tab();
		expect(document.activeElement).toBe(
			group.getByRole('button', { name: '#FFFFFF' }).element(),
		);
		await expect
			.element(group.getByRole('button', { name: '#000000' }))
			.toHaveAttribute('aria-pressed', 'true');
	});

	it('commits a preset six-digit color and updates the trigger', async () => {
		const onValueChange = vi.fn();
		const screen = render(ColorPicker, { value: '#0369A1', label, onValueChange });
		const trigger = screen.getByRole('button', { name: label });
		await trigger.click();
		const dialog = page.getByRole('dialog', { name: label });
		const initialSwatch = dialog.getByRole('button', { name: '#0369A1' });
		const chosenSwatch = dialog.getByRole('button', { name: '#B91C1C' });

		await expect.element(initialSwatch).toHaveAttribute('aria-pressed', 'true');
		await chosenSwatch.click();
		expect(onValueChange).toHaveBeenCalledWith('#B91C1C');
		await expect.element(initialSwatch).toHaveAttribute('aria-pressed', 'false');
		await expect.element(chosenSwatch).toHaveAttribute('aria-pressed', 'true');
		expect(getComputedStyle(trigger.element()).backgroundColor).toBe('rgb(185, 28, 28)');
	});

	it('closes without changing value when disabled while open', async () => {
		const onValueChange = vi.fn();
		const screen = render(ColorPicker, { value: '#0369A1', label, onValueChange });
		const trigger = screen.getByRole('button', { name: label });
		await trigger.click();
		await expect.element(page.getByRole('dialog', { name: label })).toBeVisible();

		await screen.rerender({ value: '#0369A1', label, disabled: true, onValueChange });

		await expect.element(page.getByRole('dialog', { name: label })).not.toBeInTheDocument();
		await expect.element(trigger).toBeDisabled();
		expect(onValueChange).not.toHaveBeenCalled();
	});

	it('commits valid custom hex but keeps the committed color for invalid text', async () => {
		const onValueChange = vi.fn();
		const screen = render(ColorPicker, { value: '#0369A1', label, onValueChange });
		const trigger = screen.getByRole('button', { name: label });
		await trigger.click();
		const dialog = page.getByRole('dialog', { name: label });
		const hex = dialog.getByRole('textbox', { name: m.color_picker_hex_label() });

		await hex.fill('#12');
		expect(onValueChange).not.toHaveBeenCalled();
		expect(getComputedStyle(trigger.element()).backgroundColor).toBe('rgb(3, 105, 161)');
		await hex.fill('#AABBCC');
		expect(onValueChange).toHaveBeenLastCalledWith('#AABBCC');
		expect(getComputedStyle(trigger.element()).backgroundColor).toBe('rgb(170, 187, 204)');
	});

	it('opens the native fallback from the visible translated action', async () => {
		const screen = render(ColorPicker, { value: '#0369A1', label });
		const fallbackClick = vi.spyOn(nativeFallback(), 'click');
		await screen.getByRole('button', { name: label }).click();
		const dialog = page.getByRole('dialog', { name: label });

		await dialog.getByRole('button', { name: m.color_picker_native_action() }).click();

		expect(fallbackClick).toHaveBeenCalledOnce();
	});

	it('commits valid arbitrary colors emitted by the visually hidden native boundary', async () => {
		const onValueChange = vi.fn();
		render(ColorPicker, { value: '#0369A1', label, onValueChange });
		const fallback = nativeFallback();

		fallback.value = '#7c3aed';
		fallback.dispatchEvent(new Event('input', { bubbles: true }));
		expect(onValueChange).toHaveBeenCalledWith('#7c3aed');
	});
});
