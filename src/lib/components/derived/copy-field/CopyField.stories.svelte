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

	const playFieldWidths = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const canvas = within(canvasElement);
		for (const [fieldName, labelShown] of [
			['Úzké pole', false],
			['Široké pole', true],
		] as const) {
			const group = canvas
				.getByRole('textbox', { name: fieldName })
				.closest('[role="group"]');
			if (!(group instanceof HTMLElement)) {
				throw new Error('Copy field group not found');
			}
			const field = within(group).getByRole('textbox');
			const button = within(group).getByRole('button', { name: 'Kopírovat' });
			const labelWidth = within(button).getByText('Kopírovat').getBoundingClientRect().width;
			await expect(getComputedStyle(field).textOverflow).toBe('ellipsis');
			if (labelShown) {
				await expect(labelWidth).toBeGreaterThan(1);
			} else {
				await expect(labelWidth).toBeLessThanOrEqual(1);
				await expect(button.getBoundingClientRect().width).toBeLessThan(
					group.getBoundingClientRect().width / 4,
				);
			}
		}
	};

	/** A dialog step that autofocuses the field must not show the link as selected. */
	const playFocusKeepsLinkUnselected = async ({
		canvasElement,
	}: {
		canvasElement: HTMLElement;
	}) => {
		const canvas = within(canvasElement);
		const field = canvas.getByRole('textbox', { name: 'Odkaz na seznam' }) as HTMLInputElement;
		field.focus();
		await expect(field).toHaveFocus();
		await expect(field.selectionStart).toBe(field.selectionEnd);
	};
</script>

<Story name="Link" play={playCopy} />

<Story name="Focused" play={playFocusKeepsLinkUnselected} />

<Story name="Clipboard denied" play={playClipboardDenied} />

<!-- Below 22rem the copy segment is icon-only, so the value keeps room and ends with an ellipsis. -->
<Story name="Narrow And Wide" play={playFieldWidths}>
	{#snippet template(args)}
		<div class="flex flex-col gap-4">
			<div class="w-72">
				<CopyField {...args} label="Úzké pole" />
			</div>
			<div class="w-md">
				<CopyField {...args} label="Široké pole" />
			</div>
		</div>
	{/snippet}
</Story>

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
