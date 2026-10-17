<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Checkbox } from '$lib/components/base/checkbox/index.js';
	import { choiceRowVariants } from '$lib/components/derived/choice-row/index.js';
	import { cn } from '$lib/utils.js';
	import {
		ACCESS_TOKEN_SCOPE_COPY,
		ACCESS_TOKEN_SCOPES,
	} from '$lib/modules/access_tokens/access_token_display.js';
	import { AGENT_SCOPE, type AgentScope } from '$lib/modules/access_tokens/index.js';
	import LockIcon from '@lucide/svelte/icons/lock';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';

	interface ScopePickerProps {
		/** The optional scopes picked; reading is always granted and never listed here. */
		selected: AgentScope[];
		disabled?: boolean;
	}

	let { selected = $bindable([]), disabled = false }: ScopePickerProps = $props();

	const idPrefix = $props.id();

	function toggle(scope: AgentScope, checked: boolean) {
		selected = checked
			? ACCESS_TOKEN_SCOPES.filter(
					(candidate) => candidate === scope || selected.includes(candidate),
				)
			: selected.filter((candidate) => candidate !== scope);
	}
</script>

<div class="flex flex-col gap-1.5">
	<span id="{idPrefix}-label" class="text-(length:--text-sm) font-semibold">
		{m.access_tokens_scopes_label()}
	</span>
	<div class="flex flex-col gap-0.5" role="group" aria-labelledby="{idPrefix}-label">
		{#each ACCESS_TOKEN_SCOPES as scope (scope)}
			{@const copy = ACCESS_TOKEN_SCOPE_COPY[scope]}
			{@const locked = scope === AGENT_SCOPE.read}
			{@const checked = locked || selected.includes(scope)}
			{@const checkboxId = `${idPrefix}-${scope}`}
			<label
				for={checkboxId}
				class={cn(
					choiceRowVariants({ selected: checked }),
					'items-start gap-2.5 px-2.5 py-2 font-normal',
					locked && 'cursor-default',
				)}
			>
				<Checkbox
					id={checkboxId}
					size="sm"
					{checked}
					disabled={locked || disabled}
					aria-describedby="{checkboxId}-description"
					onCheckedChange={(value) => toggle(scope, value === true)}
				/>
				<span class="flex min-w-0 flex-1 flex-col gap-0.5">
					<span
						class="flex flex-wrap items-center gap-x-2 gap-y-1 text-(length:--text-md) font-semibold"
					>
						{copy.label()}
						<code class="text-(length:--text-xs) font-medium text-muted-foreground"
							>{scope}</code
						>
						{#if locked}
							<span
								class="inline-flex items-center gap-0.75 text-(length:--text-xs) font-semibold text-muted-foreground"
							>
								<LockIcon class="size-3" aria-hidden="true" />
								{m.access_tokens_scope_locked()}
							</span>
						{/if}
					</span>
					<span id="{checkboxId}-description" class="flex flex-col gap-0.5">
						<span class="text-muted-foreground">{copy.description()}</span>
						{#if 'warning' in copy}
							<span
								class="mt-0.5 flex items-start gap-1.5 font-semibold text-status-warning-text"
							>
								<TriangleAlertIcon
									class="mt-px size-3.5 shrink-0"
									aria-hidden="true"
								/>
								<span>{copy.warning()}</span>
							</span>
						{/if}
					</span>
				</span>
			</label>
		{/each}
	</div>
</div>
