<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, within } from 'storybook/test';
	import * as Card from '$lib/components/base/card/index.js';
	import BellIcon from '@lucide/svelte/icons/bell';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import SettingsSectionHeader from './SettingsSectionHeader.svelte';
	import { SETTINGS_SECTION_TONES } from './settings_section_variants.js';

	const { Story } = defineMeta({
		title: 'Blocks/Settings/SettingsSectionHeader',
		component: SettingsSectionHeader,
		tags: ['autodocs'],
		args: {
			icon: BellIcon,
			title: 'Oznámení',
			description: 'Vyberte, o čem vám máme posílat e-maily.',
		},
		argTypes: {
			tone: { control: 'select', options: [...SETTINGS_SECTION_TONES] },
		},
	});
</script>

<Story
	name="Default"
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText('Oznámení')).toBeVisible();
		await expect(canvas.getByText('Vyberte, o čem vám máme posílat e-maily.')).toBeVisible();
	}}
>
	{#snippet template(args)}
		<Card.Root class="max-w-lg">
			<SettingsSectionHeader {...args} />
		</Card.Root>
	{/snippet}
</Story>

<Story
	name="Danger"
	args={{
		icon: TriangleAlertIcon,
		title: 'Nebezpečná zóna',
		description: 'Nevratné akce s vaším účtem.',
		tone: 'danger',
	}}
>
	{#snippet template(args)}
		<Card.Root class="max-w-lg">
			<SettingsSectionHeader {...args} />
		</Card.Root>
	{/snippet}
</Story>
