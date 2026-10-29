<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import LoaderIcon from '@lucide/svelte/icons/loader';

	/** Použít's label, shared by the review page and the chat: applying, declining or the count. */
	let {
		pending,
		declines,
		includedCount,
	}: {
		pending: boolean;
		/** Nothing is accepted, so the button declines the whole proposal. */
		declines: boolean;
		includedCount: number;
	} = $props();
</script>

{#if pending}
	<LoaderIcon class="animate-spin" data-icon="inline-start" />{m.change_review_applying()}
{:else if declines}
	{m.change_review_decline_proposal()}
{:else}
	{m.change_review_apply_included({ count: includedCount })}
{/if}
