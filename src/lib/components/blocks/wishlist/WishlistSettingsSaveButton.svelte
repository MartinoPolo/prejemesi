<script module lang="ts">
	export const PENDING_INDICATOR_DELAY_MS = 200;
</script>

<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { Spinner } from '$lib/components/base/spinner/index.js';

	interface Props {
		form?: string;
		dirty: boolean;
		saving: boolean;
		testId?: string;
		onclick?: () => void;
	}

	let { form, dirty, saving, testId, onclick }: Props = $props();
	let showPendingIndicator = $state(false);

	$effect(() => {
		showPendingIndicator = false;
		if (!saving) {
			return;
		}
		const timeoutId = setTimeout(() => {
			showPendingIndicator = true;
		}, PENDING_INDICATOR_DELAY_MS);
		return () => clearTimeout(timeoutId);
	});
</script>

<Button
	type={form === undefined ? 'button' : 'submit'}
	{form}
	{onclick}
	data-testid={testId}
	disabled={saving || !dirty}
	aria-busy={saving}
>
	{#if showPendingIndicator}
		<Spinner data-icon="inline-start" data-testid="save-pending-indicator" />
	{/if}
	{m.save()}
</Button>
