<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import CircleAlertIcon from '@lucide/svelte/icons/circle-alert';
	import * as Alert from '$lib/components/base/alert/index.js';
	import { Button } from '$lib/components/base/button/index.js';

	/** A failed or cut-off answer: whether anything changed, and Zkusit znovu when it can retry. */
	let {
		proposed,
		onretry,
	}: {
		/** The answer got as far as a proposal, so something may have changed. */
		proposed: boolean;
		/** Absent while the turn cannot be retried. */
		onretry?: () => void;
	} = $props();
</script>

<Alert.Root tone="danger" aria-labelledby="assistant-turn-error">
	<CircleAlertIcon aria-hidden="true" />
	<Alert.Title id="assistant-turn-error">{m.chat_error_title()}</Alert.Title>
	{#if !proposed}
		<Alert.Description>{m.chat_error_nothing_changed()}</Alert.Description>
	{/if}
	{#if onretry !== undefined}
		<Alert.Action>
			<Button intent="outline" size="sm" data-testid="assistant-retry" onclick={onretry}>
				<RefreshCwIcon data-icon="inline-start" />{m.chat_retry()}
			</Button>
		</Alert.Action>
	{/if}
</Alert.Root>
