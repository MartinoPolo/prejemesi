<script module lang="ts">
	export const PENDING_INDICATOR_DELAY_MS = 200;
</script>

<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/base/button/index.js';
	import LoaderIcon from '@lucide/svelte/icons/loader';

	interface Props {
		form?: string;
		dirty: boolean;
		saving: boolean;
		testId?: string;
	}

	let { form, dirty, saving, testId }: Props = $props();
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

<Button type="submit" {form} data-testid={testId} disabled={saving || !dirty} aria-busy={saving}>
	{#if showPendingIndicator}
		<LoaderIcon
			class="animate-spin"
			data-icon="inline-start"
			data-testid="save-pending-indicator"
		/>
	{/if}
	{m.save()}
</Button>
