<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import {
		ALERT_TONES,
		Alert,
		AlertAction,
		AlertDescription,
		AlertTitle,
		type AlertTone,
	} from './index.js';

	const { Story } = defineMeta({
		title: 'Base/Alert',
		component: Alert,
		tags: ['autodocs'],
		argTypes: {
			tone: {
				control: 'select',
				options: [...ALERT_TONES],
			},
		},
	});
</script>

<script lang="ts">
	import type { Component } from 'svelte';
	import type { AlertProps } from './alert_variants.js';
	import InfoIcon from '@lucide/svelte/icons/info';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import CircleAlertIcon from '@lucide/svelte/icons/circle-alert';
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
	import { Button } from '$lib/components/base/button/index.js';

	const toneIcons: Record<AlertTone, Component> = {
		info: InfoIcon,
		success: CircleCheckIcon,
		warning: TriangleAlertIcon,
		danger: CircleAlertIcon,
	};

	const toneSentences: Record<AlertTone, string> = {
		info: 'Changes from other managers wait for your review.',
		success: 'The gift was added to the wishlist.',
		warning: 'Copy the token now. It will not be shown again.',
		danger: 'Categories could not be saved.',
	};
</script>

<Story name="All Tones">
	{#snippet template(args: AlertProps)}
		<div class="flex max-w-lg flex-col gap-3">
			{#each ALERT_TONES as tone (tone)}
				{@const ToneIcon = toneIcons[tone]}
				<Alert {...args} {tone}>
					<ToneIcon aria-hidden="true" />
					<AlertTitle>{tone}</AlertTitle>
					<AlertDescription>{toneSentences[tone]}</AlertDescription>
				</Alert>
			{/each}
		</div>
	{/snippet}
</Story>

<Story name="One Sentence">
	{#snippet template(args: AlertProps)}
		<div class="flex max-w-lg flex-col gap-3">
			{#each ALERT_TONES as tone (tone)}
				{@const ToneIcon = toneIcons[tone]}
				<Alert {...args} {tone}>
					<ToneIcon aria-hidden="true" />
					<AlertDescription>{toneSentences[tone]}</AlertDescription>
				</Alert>
			{/each}
		</div>
	{/snippet}
</Story>

<Story name="Danger With Retry">
	{#snippet template(args: AlertProps)}
		<div class="w-96">
			<Alert {...args} tone="danger">
				<CircleAlertIcon aria-hidden="true" />
				<AlertDescription>{toneSentences.danger}</AlertDescription>
				<AlertAction>
					<Button intent="outline" size="sm">Retry</Button>
				</AlertAction>
			</Alert>
		</div>
	{/snippet}
</Story>

<Story name="Info With Title And Action">
	{#snippet template(args: AlertProps)}
		<div class="w-96">
			<Alert {...args} tone="info">
				<InfoIcon aria-hidden="true" />
				<AlertTitle>Pending changes</AlertTitle>
				<AlertDescription>{toneSentences.info}</AlertDescription>
				<AlertAction>
					<Button intent="secondary" size="sm">Review</Button>
				</AlertAction>
			</Alert>
		</div>
	{/snippet}
</Story>
