<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { TOAST_TONES, Toast } from './index.js';
	import RefreshIcon from '@lucide/svelte/icons/refresh-cw';
	import CheckIcon from '@lucide/svelte/icons/check';
	import AlertTriangleIcon from '@lucide/svelte/icons/triangle-alert';
	import XIcon from '@lucide/svelte/icons/x';
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

<Story name="All Variants">
	{#snippet template()}
		<div class="flex max-w-135 flex-col gap-3">
			{#each TOAST_TONES as tone (tone)}
				<Toast {tone} title={tone} body={`Toast tone: ${tone}`}>
					{#snippet icon()}
						{#if tone === 'success'}
							<CheckIcon class="size-3.5" />
						{:else if tone === 'warning'}
							<AlertTriangleIcon class="size-3.5" />
						{:else if tone === 'danger'}
							<XIcon class="size-3.5" />
						{:else if tone === 'loading'}
							<RefreshIcon class="size-3.5 animate-spin" />
						{:else}
							<RefreshIcon class="size-3.5" />
						{/if}
					{/snippet}
				</Toast>
			{/each}
		</div>
	{/snippet}
</Story>

<Story name="Info">
	{#snippet template()}
		<div class="max-w-135">
			<Toast
				tone="info"
				title="Syncing grovekeeper…"
				body="Fetching 3 new commits from origin."
			>
				{#snippet icon()}<RefreshIcon class="size-3.5" />{/snippet}
			</Toast>
		</div>
	{/snippet}
</Story>

<Story name="Success">
	{#snippet template()}
		<div class="max-w-135">
			<Toast
				tone="success"
				title="Worktree created"
				body="Branch feat/forest-overlays checked out."
			>
				{#snippet icon()}<CheckIcon class="size-3.5" />{/snippet}
			</Toast>
		</div>
	{/snippet}
</Story>

<Story name="Warning">
	{#snippet template()}
		<div class="max-w-135">
			<Toast
				tone="warning"
				title="Permission required"
				body="Session #128 wants to run a Bash command."
			>
				{#snippet icon()}<AlertTriangleIcon class="size-3.5" />{/snippet}
				{#snippet action()}
					<Button intent="secondary" size="sm">Review</Button>
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
				title="Sync failed"
				body="GitHub returned 401 — check token in Settings."
			>
				{#snippet icon()}<XIcon class="size-3.5" />{/snippet}
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
			<Toast tone="loading" title="Setting up worktree…" body="Creating worktree for #142">
				{#snippet icon()}<RefreshIcon class="size-3.5 animate-spin" />{/snippet}
			</Toast>
		</div>
	{/snippet}
</Story>

<Story name="Stack">
	{#snippet template()}
		<div class="flex max-w-135 flex-col gap-3">
			<Toast
				tone="info"
				title="Syncing grovekeeper…"
				body="Fetching 3 new commits from origin."
			>
				{#snippet icon()}<RefreshIcon class="size-3.5" />{/snippet}
			</Toast>
			<Toast
				tone="success"
				title="Worktree created"
				body="Branch feat/forest-overlays checked out."
			>
				{#snippet icon()}<CheckIcon class="size-3.5" />{/snippet}
			</Toast>
			<Toast
				tone="warning"
				title="Permission required"
				body="Session #128 wants to run a Bash command."
			>
				{#snippet icon()}<AlertTriangleIcon class="size-3.5" />{/snippet}
				{#snippet action()}
					<Button intent="secondary" size="sm">Review</Button>
				{/snippet}
			</Toast>
			<Toast
				tone="danger"
				title="Sync failed"
				body="GitHub returned 401 — check token in Settings."
			>
				{#snippet icon()}<XIcon class="size-3.5" />{/snippet}
				{#snippet action()}
					<Button intent="secondary" size="sm">Retry</Button>
				{/snippet}
			</Toast>
			<Toast tone="loading" title="Setting up worktree…" body="Creating worktree for #142">
				{#snippet icon()}<RefreshIcon class="size-3.5 animate-spin" />{/snippet}
			</Toast>
		</div>
	{/snippet}
</Story>
