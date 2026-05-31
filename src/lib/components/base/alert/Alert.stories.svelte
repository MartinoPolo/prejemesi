<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { ALERT_TONES, Alert, AlertAction, AlertDescription, AlertTitle } from './index.js';

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
	import type { AlertProps } from './alert_variants.js';
	import InfoIcon from '@lucide/svelte/icons/info';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import TerminalIcon from '@lucide/svelte/icons/terminal';
	import { Button } from '$lib/components/base/button/index.js';
</script>

<Story name="All Variants">
	{#snippet template(args: AlertProps)}
		<div class="flex max-w-lg flex-col gap-3">
			{#each ALERT_TONES as tone (tone)}
				<Alert {...args} {tone}>
					{#if tone === 'destructive'}
						<TriangleAlertIcon />
					{:else}
						<InfoIcon />
					{/if}
					<AlertTitle>{tone}</AlertTitle>
					<AlertDescription>Alert tone: {tone}.</AlertDescription>
				</Alert>
			{/each}
			<Alert>
				<TriangleAlertIcon />
				<AlertTitle>Update available</AlertTitle>
				<AlertDescription
					>A new version is available. Restart to apply the update.</AlertDescription
				>
				<AlertAction>
					<Button intent="secondary" size="sm">Restart now</Button>
				</AlertAction>
			</Alert>
			<Alert>
				<InfoIcon />
				<AlertDescription>Your changes have been saved successfully.</AlertDescription>
			</Alert>
		</div>
	{/snippet}
</Story>

<Story name="Default">
	{#snippet template(args)}
		<div class="w-96">
			<Alert {...args}>
				<AlertTitle>Heads up!</AlertTitle>
				<AlertDescription
					>You can add components to your app using the CLI.</AlertDescription
				>
			</Alert>
		</div>
	{/snippet}
</Story>

<Story name="Destructive">
	{#snippet template(args)}
		<div class="w-96">
			<Alert tone="destructive" {...args}>
				<AlertTitle>Error</AlertTitle>
				<AlertDescription>Your session has expired. Please log in again.</AlertDescription>
			</Alert>
		</div>
	{/snippet}
</Story>

<Story name="With Icon">
	{#snippet template(args)}
		<div class="w-96">
			<Alert {...args}>
				<TerminalIcon />
				<AlertTitle>Terminal</AlertTitle>
				<AlertDescription>You can use the terminal to run commands.</AlertDescription>
			</Alert>
		</div>
	{/snippet}
</Story>

<Story name="Without Title">
	{#snippet template(args)}
		<div class="w-96">
			<Alert {...args}>
				<InfoIcon />
				<AlertDescription>Your changes have been saved successfully.</AlertDescription>
			</Alert>
		</div>
	{/snippet}
</Story>

<Story name="With Action Button">
	{#snippet template(args)}
		<div class="w-96">
			<Alert {...args}>
				<TriangleAlertIcon />
				<AlertTitle>Update available</AlertTitle>
				<AlertDescription
					>A new version is available. Restart to apply the update.</AlertDescription
				>
				<AlertAction>
					<Button intent="secondary" size="sm">Restart now</Button>
				</AlertAction>
			</Alert>
		</div>
	{/snippet}
</Story>
