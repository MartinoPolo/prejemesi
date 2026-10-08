<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/base/button/index.js';
	import { modeStorageKey } from 'mode-watcher';
	import { getLocale } from '$lib/paraglide/runtime.js';
	import * as m from '$lib/paraglide/messages.js';

	let {
		label = m.demo_start,
		intent = 'secondary',
	}: {
		label?: () => string;
		intent?: 'secondary' | 'primary';
	} = $props();
	let pending = $state(false);
	let error = $state(false);

	async function start(event: SubmitEvent) {
		event.preventDefault();
		if (pending) {
			return;
		}
		pending = true;
		error = false;
		if (localStorage.getItem('prejemesi-mode-before-demo') === null) {
			localStorage.setItem(
				'prejemesi-mode-before-demo',
				JSON.stringify(localStorage.getItem(modeStorageKey.current)),
			);
		}
		try {
			const response = await fetch(resolve('/demo/start'), {
				method: 'POST',
				body: new URLSearchParams({ locale: getLocale() === 'en' ? 'en' : 'cs' }),
			});
			if (!response.ok) {
				throw new Error('Demo start failed');
			}
			window.location.assign(response.url);
		} catch {
			error = true;
			pending = false;
		}
	}
</script>

<form method="POST" action={resolve('/demo/start')} onsubmit={start} class="flex flex-col gap-2">
	<input type="hidden" name="locale" value={getLocale() === 'en' ? 'en' : 'cs'} />
	<Button {intent} size="xl" type="submit" disabled={pending} aria-busy={pending}>
		{pending ? m.demo_start_pending() : label()}
	</Button>
	{#if error}<p role="alert" class="text-sm text-destructive">{m.demo_start_error()}</p>{/if}
</form>
