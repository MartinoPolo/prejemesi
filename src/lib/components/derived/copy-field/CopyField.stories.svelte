<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, fn, spyOn, userEvent, within } from 'storybook/test';
	import { COPY_FIELD_KINDS, CopyField } from './index.js';

	const { Story } = defineMeta({
		title: 'Derived/CopyField',
		component: CopyField,
		tags: ['autodocs'],
		args: {
			value: 'https://prejemesi.cz/w/k3n9x2',
			displayValue: 'prejemesi.cz/w/k3n9x2',
			label: 'Odkaz na seznam',
			oncopied: fn(),
		},
		argTypes: {
			kind: { control: 'select', options: [...COPY_FIELD_KINDS] },
		},
	});

	const playCopy = async ({
		canvasElement,
		args,
	}: {
		canvasElement: HTMLElement;
		args: { oncopied?: unknown };
	}) => {
		const canvas = within(canvasElement);
		const field = canvas.getByRole('textbox', { name: 'Odkaz na seznam' });
		await userEvent.click(field);
		await expect((field as HTMLInputElement).selectionEnd).toBe(
			(field as HTMLInputElement).value.length,
		);
		const writeText = spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
		try {
			await userEvent.click(canvas.getByRole('button', { name: 'Kopírovat' }));
			await expect(writeText).toHaveBeenCalledWith('https://prejemesi.cz/w/k3n9x2');
			await expect(await canvas.findByRole('button', { name: 'Zkopírováno' })).toBeVisible();
			await expect(canvas.getByRole('status')).toHaveTextContent('Zkopírováno');
			await expect(args.oncopied).toHaveBeenCalledOnce();
		} finally {
			writeText.mockRestore();
		}
	};

	const playClipboardDenied = async ({
		canvasElement,
		args,
	}: {
		canvasElement: HTMLElement;
		args: { oncopied?: unknown };
	}) => {
		const canvas = within(canvasElement);
		const field = canvas.getByRole('textbox', { name: 'Odkaz na seznam' }) as HTMLInputElement;
		const writeText = spyOn(navigator.clipboard, 'writeText').mockRejectedValue(
			new DOMException('Clipboard access denied', 'NotAllowedError'),
		);
		try {
			await userEvent.click(canvas.getByRole('button', { name: 'Kopírovat' }));
			await expect(writeText).toHaveBeenCalledOnce();
			await expect(field.selectionStart).toBe(0);
			await expect(field.selectionEnd).toBe(field.value.length);
			await expect(canvas.getByRole('button', { name: 'Kopírovat' })).toBeVisible();
			await expect(canvas.queryByText('Zkopírováno')).toBeNull();
			await expect(args.oncopied).not.toHaveBeenCalled();
		} finally {
			writeText.mockRestore();
		}
	};
</script>

<Story name="Link" play={playCopy} />

<Story name="Clipboard denied" play={playClipboardDenied} />

<Story
	name="Secret"
	args={{
		kind: 'secret',
		value: 'psk_live_4f8a2c91d0b7e6a35f1c',
		displayValue: undefined,
		label: 'Token',
		size: 'lg',
	}}
/>
