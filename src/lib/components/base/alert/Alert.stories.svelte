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
		parameters: {
			docs: {
				description: {
					component:
						'The tone sets the default role: `danger` is an `alert`, `success` a `status`, and `info` and `warning` a static `note`. Pass `role="alert"` to a non-danger callout that appears in response to an action.',
				},
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
	import ArchiveIcon from '@lucide/svelte/icons/archive';
	import { Button } from '$lib/components/base/button/index.js';

	const toneIcons: Record<AlertTone, Component> = {
		info: InfoIcon,
		success: CircleCheckIcon,
		warning: TriangleAlertIcon,
		danger: CircleAlertIcon,
		palette: ArchiveIcon,
	};

	const toneSentences: Record<AlertTone, string> = {
		info: 'Changes from other managers wait for your review.',
		success: 'The gift was added to the wishlist.',
		warning: 'Copy the token now. It will not be shown again.',
		danger: 'Categories could not be saved.',
		palette: 'Archived: the list is closed. New reservations are not possible.',
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

<Story name="Wrapped Text Keeps Icon On First Line">
	{#snippet template(args: AlertProps)}
		<div class="w-72">
			<Alert {...args} tone="danger">
				<CircleAlertIcon aria-hidden="true" />
				<AlertDescription
					>Categories could not be saved. Check your connection and try again.</AlertDescription
				>
				<AlertAction>
					<Button intent="outline" size="sm">Retry</Button>
				</AlertAction>
			</Alert>
		</div>
	{/snippet}
</Story>

<Story name="Warning With Action Below">
	{#snippet template(args: AlertProps)}
		<div class="w-96">
			<Alert {...args} tone="warning">
				<TriangleAlertIcon aria-hidden="true" />
				<AlertTitle>See reservations?</AlertTitle>
				<AlertDescription>
					Visitors will be told that you see which gifts are reserved. This cannot be
					undone.
				</AlertDescription>
				<AlertAction placement="below">
					<Button intent="outline" size="sm">Show reservations</Button>
				</AlertAction>
			</Alert>
		</div>
	{/snippet}
</Story>
