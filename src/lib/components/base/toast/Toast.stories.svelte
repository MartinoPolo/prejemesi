<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { TOAST_TONES, Toast } from './index.js';
	import RefreshIcon from '@lucide/svelte/icons/refresh-cw';
	import { Button } from '$lib/components/base/button/index.js';

	const { Story } = defineMeta({
		title: 'Base/Toast',
		component: Toast,
		tags: ['autodocs'],
		argTypes: {
			tone: {
				control: 'select',
				options: [...TOAST_TONES],
			},
			title: { control: 'text' },
			body: { control: 'text' },
		},
	});
</script>

<!-- Each tone ships a default icon + tinted background; no icon snippet needed. -->
<Story name="All Variants">
	{#snippet template()}
		<div class="flex max-w-135 flex-col gap-3">
			{#each TOAST_TONES as tone (tone)}
				<Toast {tone} title={tone} body={`Toast tone: ${tone}`} />
			{/each}
		</div>
	{/snippet}
</Story>

<Story name="Info">
	{#snippet template()}
		<div class="max-w-135">
			<Toast tone="info" title="Syncing wishlist…" body="Fetching 3 new items from source." />
		</div>
	{/snippet}
</Story>

<Story name="Success">
	{#snippet template()}
		<div class="max-w-135">
			<Toast tone="success" title="Item reserved" body="Gift marked as reserved for you." />
		</div>
	{/snippet}
</Story>

<Story name="Warning">
	{#snippet template()}
		<div class="max-w-135">
			<Toast
				tone="warning"
				title="Invite expiring"
				body="Your moderator invite expires in 2 hours."
			>
				{#snippet action()}
					<Button intent="secondary" size="sm">Accept now</Button>
				{/snippet}
			</Toast>
		</div>
	{/snippet}
</Story>

<Story name="Danger">
	{#snippet template()}
		<div class="max-w-135">
			<Toast
				tone="danger"
				title="Reserve failed"
				body="Someone else already reserved this item."
			>
				{#snippet action()}
					<Button intent="secondary" size="sm">Retry</Button>
				{/snippet}
			</Toast>
		</div>
	{/snippet}
</Story>

<Story name="Loading">
	{#snippet template()}
		<div class="max-w-135">
			<Toast tone="loading" title="Generating invite…" body="Creating shareable link." />
		</div>
	{/snippet}
</Story>

<!-- Passing an icon snippet overrides the default per-tone icon. -->
<Story name="Custom Icon">
	{#snippet template()}
		<div class="max-w-135">
			<Toast tone="info" title="Re-syncing…" body="Custom icon replaces the tone default.">
				{#snippet icon()}<RefreshIcon class="size-4 animate-spin" />{/snippet}
			</Toast>
		</div>
	{/snippet}
</Story>

<Story name="With Dismiss">
	{#snippet template()}
		<div class="max-w-135">
			<Toast
				tone="success"
				title="Link copied"
				body="Shareable link has been copied to clipboard."
				onDismiss={() => {}}
			/>
		</div>
	{/snippet}
</Story>

<Story name="Stack">
	{#snippet template()}
		<div class="flex max-w-135 flex-col gap-3">
			<Toast tone="info" title="Syncing wishlist…" body="Fetching 3 new items from source." />
			<Toast tone="success" title="Item reserved" body="Gift marked as reserved for you." />
			<Toast
				tone="warning"
				title="Invite expiring"
				body="Your moderator invite expires in 2 hours."
			>
				{#snippet action()}
					<Button intent="secondary" size="sm">Accept now</Button>
				{/snippet}
			</Toast>
			<Toast
				tone="danger"
				title="Reserve failed"
				body="Someone else already reserved this item."
				onDismiss={() => {}}
			>
				{#snippet action()}
					<Button intent="secondary" size="sm">Retry</Button>
				{/snippet}
			</Toast>
			<Toast tone="loading" title="Generating invite…" body="Creating shareable link." />
		</div>
	{/snippet}
</Story>
