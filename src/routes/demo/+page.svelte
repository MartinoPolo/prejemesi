<script lang="ts">
	import { resolve } from '$app/paths';
	import { localizeInternalHref } from '$lib/i18n/locale.js';
	import { Button } from '$lib/components/base/button/index.js';
	import DemoStartForm from '$lib/components/blocks/demo/DemoStartForm.svelte';
	import * as m from '$lib/paraglide/messages.js';
	let pending = $state(false);
	let error = $state(false);

	async function exit() {
		if (pending) {
			return;
		}
		pending = true;
		error = false;
		try {
			const response = await fetch(localizeInternalHref(resolve('/demo/exit')), {
				method: 'POST',
			});
			if (!response.ok) {
				throw new Error('Exit failed');
			}
			window.location.assign(response.url);
		} catch {
			error = true;
			pending = false;
		}
	}
</script>

<svelte:head><title>{m.demo_new_title()}</title></svelte:head>
<main class="mx-auto flex max-w-xl flex-col items-center gap-4 p-6 text-center">
	<h1 class="text-2xl font-semibold">{m.demo_new_title()}</h1>
	<p class="text-muted-foreground">{m.demo_new_description()}</p>
	<DemoStartForm label={m.demo_start_new} intent="primary" />
	<Button intent="ghost" disabled={pending} onclick={exit}>{m.demo_exit()}</Button>
	{#if error}<p role="alert" class="text-sm text-destructive">{m.demo_exit_error()}</p>{/if}
</main>
