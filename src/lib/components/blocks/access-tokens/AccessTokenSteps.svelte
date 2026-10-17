<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils.js';
	import CheckIcon from '@lucide/svelte/icons/check';

	interface AccessTokenStepsProps {
		/** Zero-based: basics, permissions, then the revealed token. */
		currentStepIndex: number;
	}

	let { currentStepIndex }: AccessTokenStepsProps = $props();

	const steps = [
		{ label: m.access_tokens_step_basics },
		{ label: m.access_tokens_step_permissions },
		{ label: m.access_tokens_step_token },
	];
</script>

{#snippet stepMarker(index: number)}
	<span
		class={cn(
			'flex size-6 items-center justify-center rounded-full border-2 text-xs font-bold',
			index <= currentStepIndex
				? 'border-ink bg-primary text-primary-foreground'
				: 'border-ink-faint bg-surface text-muted-foreground',
		)}
	>
		{#if index < currentStepIndex}
			<CheckIcon class="size-3.5" aria-hidden="true" />
		{:else}
			{index + 1}
		{/if}
	</span>
{/snippet}

<ol class="flex items-center gap-2" aria-label={m.access_tokens_steps_label()}>
	{#each steps as stepItem, index (index)}
		{@const current = index === currentStepIndex}
		{#if index > 0}
			<li
				class={cn(
					'min-w-3 flex-1 border-t-2',
					index <= currentStepIndex ? 'border-ink' : 'border-dashed border-ink-faint',
				)}
				aria-hidden="true"
			></li>
		{/if}
		<li
			class={cn(
				'flex items-center gap-1.5 whitespace-nowrap text-(length:--text-sm)',
				current ? 'font-bold text-foreground' : 'font-semibold text-muted-foreground',
			)}
			aria-current={current ? 'step' : undefined}
		>
			{@render stepMarker(index)}
			<span class={cn(!current && 'step-label-collapsible')}>{stepItem.label()}</span>
		</li>
	{/each}
</ol>

<style>
	/* Narrow phones keep only the current step's label so the three steps fit on one line. */
	@media (width < 400px) {
		.step-label-collapsible {
			display: none;
		}
	}
</style>
