<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import { localizeInternalHref } from '$lib/i18n/locale.js';
	import { Button } from '$lib/components/base/button/index.js';
	import AuthFormCard from '$lib/components/blocks/auth/AuthFormCard.svelte';

	const isNotFound = $derived(page.status === 404);
	const heading = $derived(
		isNotFound ? m.error_page_not_found_heading() : m.error_page_failed_heading(),
	);
	const description = $derived(
		isNotFound ? m.error_page_not_found_description() : m.error_page_failed_description(),
	);

	function reloadPage(): void {
		window.location.reload();
	}
</script>

<svelte:head>
	<title>{heading} – {m.app_name()}</title>
	<meta name="robots" content="noindex, nofollow, noarchive" />
</svelte:head>

<AuthFormCard title={heading} subtitle={description}>
	<div class="flex flex-wrap gap-(--nested-control-gap)">
		{#if !isNotFound}
			<Button onclick={reloadPage}>{m.error_page_retry()}</Button>
		{/if}
		<Button
			intent={isNotFound ? 'primary' : 'secondary'}
			href={localizeInternalHref(resolve('/'))}
		>
			{m.error_page_home()}
		</Button>
	</div>
</AuthFormCard>
