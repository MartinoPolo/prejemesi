<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import SlidersHorizontalIcon from '@lucide/svelte/icons/sliders-horizontal';
	import { Button } from '$lib/components/base/button/index.js';
	import { HelpText } from '$lib/components/base/help-text/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	import * as Popover from '$lib/components/base/popover/index.js';
	import * as Select from '$lib/components/base/select/index.js';
	import {
		CHAT_RUNNER_EFFORTS,
		CHAT_RUNNER_MODELS,
		isChatRunnerEffort,
		isChatRunnerModel,
		type ChatRunnerEffort,
		type ChatRunnerModel,
	} from '$lib/modules/chat/types.js';

	/** Claude model names, the same in every language. */
	const RUNNER_MODEL_NAMES: Record<ChatRunnerModel, string> = {
		opus: 'Opus',
		sonnet: 'Sonnet',
		haiku: 'Haiku',
	};

	const RUNNER_EFFORT_NAMES: Record<ChatRunnerEffort, () => string> = {
		low: m.chat_effort_low,
		medium: m.chat_effort_medium,
		high: m.chat_effort_high,
		xhigh: m.chat_effort_xhigh,
		max: m.chat_effort_max,
	};

	/**
	 * Pokročilé: the model and reasoning effort Claude Code answers with, for users whose turns go
	 * to the chat runner. Kept behind one quiet header button because it is a testing aid.
	 */
	let {
		model,
		effort,
		onmodel,
		oneffort,
	}: {
		model: ChatRunnerModel;
		effort: ChatRunnerEffort;
		onmodel: (model: ChatRunnerModel) => void;
		oneffort: (effort: ChatRunnerEffort) => void;
	} = $props();

	const idPrefix = $props.id();
</script>

<Popover.Root>
	<Popover.Trigger>
		{#snippet child({ props })}
			<Button
				{...props}
				intent="ghost"
				size="md"
				format="icon"
				aria-label={m.chat_advanced_open()}
				data-testid="assistant-runner-settings"
			>
				<SlidersHorizontalIcon />
			</Button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content
		role="dialog"
		align="start"
		collisionPadding={8}
		aria-labelledby="{idPrefix}-title"
		shadowedTrigger={false}
		class="grid w-72 min-w-0 gap-2 p-2"
	>
		<Popover.Label id="{idPrefix}-title">{m.chat_advanced_title()}</Popover.Label>
		<div class="settings">
			<Label for="{idPrefix}-model">{m.chat_model_label()}</Label>
			<Select.Root
				type="single"
				value={model}
				onValueChange={(selected) => {
					if (isChatRunnerModel(selected)) {
						onmodel(selected);
					}
				}}
			>
				<Select.Trigger
					id="{idPrefix}-model"
					data-testid="assistant-runner-model"
					class="w-full"
				>
					{RUNNER_MODEL_NAMES[model]}
				</Select.Trigger>
				<Select.Content>
					{#each CHAT_RUNNER_MODELS as option (option)}
						<Select.Item value={option} label={RUNNER_MODEL_NAMES[option]}>
							{RUNNER_MODEL_NAMES[option]}
						</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
			<Label for="{idPrefix}-effort">{m.chat_effort_label()}</Label>
			<Select.Root
				type="single"
				value={effort}
				onValueChange={(selected) => {
					if (isChatRunnerEffort(selected)) {
						oneffort(selected);
					}
				}}
			>
				<Select.Trigger
					id="{idPrefix}-effort"
					data-testid="assistant-runner-effort"
					class="w-full"
				>
					{RUNNER_EFFORT_NAMES[effort]()}
				</Select.Trigger>
				<Select.Content>
					{#each CHAT_RUNNER_EFFORTS as option (option)}
						<Select.Item value={option} label={RUNNER_EFFORT_NAMES[option]()}>
							{RUNNER_EFFORT_NAMES[option]()}
						</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
		</div>
		<HelpText class="px-2">{m.chat_advanced_hint()}</HelpText>
	</Popover.Content>
</Popover.Root>

<style>
	.settings {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: var(--space-2) var(--space-3);
		align-items: center;
		padding-inline-start: var(--space-2);
	}
</style>
