<script lang="ts">
	import { enhance } from '$app/forms';
	import { deserialize } from '$app/forms';
	import type { ActionResult } from '@sveltejs/kit';
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { Separator } from '$lib/components/base/separator/index.js';
	import AuthFormCard from '$lib/components/blocks/auth/AuthFormCard.svelte';
	import { NotificationPreferencesForm } from '$lib/components/blocks/notification/index.js';
	import type { NotificationPreferences } from '$lib/modules/notifications/types.js';
	import type { ActionData, PageProps } from './$types';

	const PREFERENCES_FORM_ID = 'unsubscribe-preferences-form';

	let { data, form }: PageProps = $props();

	let saving = $state(false);
	let saveMessage = $state<string | null>(null);
	let saveMessageIsError = $state(false);

	// svelte-ignore state_referenced_locally (one-time seed: mirrors form's own initial-preferences pattern)
	let latestPreferences = $state<NotificationPreferences | null>(data.preferences);
	// NotificationPreferencesForm seeds its internal toggle state once from `initialPreferences`
	// and never re-reads it, so a server-driven change (unsubscribe-all) needs a remount – bumped
	// via the `{#key}` block below – to actually show the new state.
	let formVersion = $state(0);

	function isUnsubscribeAllSuccess(
		value: ActionData,
	): value is { action: 'unsubscribeAll'; success: true; preferences: NotificationPreferences } {
		return value?.action === 'unsubscribeAll' && value.success === true;
	}

	$effect(() => {
		if (isUnsubscribeAllSuccess(form)) {
			latestPreferences = form.preferences;
			formVersion += 1;
		}
	});

	async function handleSavePreferences(preferences: NotificationPreferences) {
		if (data.token === null) {
			return;
		}

		saving = true;
		saveMessage = null;
		saveMessageIsError = false;
		try {
			const body = new FormData();
			body.set('token', data.token);
			body.set('preferences', JSON.stringify(preferences));

			const response = await fetch('?/save', { method: 'POST', body });
			const result: ActionResult = deserialize(await response.text());

			if (result.type === 'success') {
				latestPreferences = preferences;
				saveMessage = m.unsubscribe_save_success();
			} else {
				saveMessageIsError = true;
				saveMessage = m.error_generic();
			}
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>{m.unsubscribe_page_title()} – {m.app_name()}</title>
	<meta name="robots" content="noindex, nofollow, noarchive" />
</svelte:head>

<AuthFormCard title={m.unsubscribe_page_heading()} subtitle={m.unsubscribe_page_description()}>
	{#if !data.valid || latestPreferences === null}
		<p class="text-sm text-muted-foreground">
			{m.unsubscribe_invalid_heading()}
		</p>
		<p class="text-sm text-muted-foreground">
			{m.unsubscribe_invalid_description()}
		</p>
	{:else}
		{#key formVersion}
			<NotificationPreferencesForm
				formId={PREFERENCES_FORM_ID}
				initialPreferences={latestPreferences}
				onSave={handleSavePreferences}
			/>
		{/key}

		<div class="flex flex-wrap items-center justify-between gap-3 pt-4">
			<Button type="submit" form={PREFERENCES_FORM_ID} disabled={saving}>
				{saving ? m.saving() : m.notification_prefs_save()}
			</Button>
			{#if saveMessage !== null}
				<p
					class={saveMessageIsError
						? 'text-sm text-status-danger'
						: 'text-sm text-status-success'}
				>
					{saveMessage}
				</p>
			{/if}
		</div>

		<Separator class="my-6" />

		<div class="flex flex-col gap-3">
			<p class="text-sm text-muted-foreground">{m.unsubscribe_all_description()}</p>
			<form method="POST" action="?/unsubscribeAll" use:enhance>
				<input type="hidden" name="token" value={data.token} />
				<Button type="submit" intent="danger">{m.unsubscribe_all_button()}</Button>
			</form>
			{#if isUnsubscribeAllSuccess(form)}
				<p class="text-sm text-status-success">{m.unsubscribe_all_success()}</p>
			{:else if form?.action === 'unsubscribeAll'}
				<p class="text-sm text-status-danger">{m.unsubscribe_all_error()}</p>
			{/if}
		</div>
	{/if}
</AuthFormCard>
