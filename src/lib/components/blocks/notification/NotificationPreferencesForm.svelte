<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Switch } from '$lib/components/base/switch/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	import { Separator } from '$lib/components/base/separator/index.js';
	import {
		NOTIFICATION_TYPE,
		NOTIFICATION_MESSAGES,
		DEFAULT_NOTIFICATION_PREFERENCES,
		EMAIL_NOTIFICATION_TYPES,
		type NotificationType,
		type NotificationPreferences,
	} from '$lib/modules/notifications/types.js';

	interface NotificationPreferencesFormProps {
		/** Id of the rendered form element, so an external submit button can target it via the `form` attribute. */
		formId: string;
		initialPreferences?: NotificationPreferences;
		onSave: (preferences: NotificationPreferences) => void;
	}

	let {
		formId,
		initialPreferences = DEFAULT_NOTIFICATION_PREFERENCES,
		onSave,
	}: NotificationPreferencesFormProps = $props();

	// svelte-ignore state_referenced_locally (intentional one-time seed: form edits a local copy; parent remounts per entity)
	let preferences = $state<NotificationPreferences>({ ...initialPreferences });

	const NOTIFICATION_TYPE_ENTRIES = Object.values(NOTIFICATION_TYPE);

	function supportsEmail(type: NotificationType): boolean {
		return EMAIL_NOTIFICATION_TYPES.includes(type);
	}

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		onSave($state.snapshot(preferences));
	}
</script>

<form id={formId} class="flex flex-col gap-4" onsubmit={handleSubmit}>
	<div class="flex flex-col gap-1">
		<h3 class="text-base font-semibold">{m.notification_prefs_title()}</h3>
		<p class="text-sm text-muted-foreground">{m.notification_prefs_description()}</p>
	</div>

	<Separator />

	<!-- Header row -->
	<div class="grid grid-cols-[1fr_auto_auto] items-center gap-x-6 gap-y-0 px-1">
		<span class="text-xs font-medium text-muted-foreground"
			>{m.notification_prefs_type_column()}</span
		>
		<span class="w-16 text-center text-xs font-medium text-muted-foreground"
			>{m.notification_prefs_inapp_column()}</span
		>
		<span class="w-16 text-center text-xs font-medium text-muted-foreground"
			>{m.notification_prefs_email_column()}</span
		>
	</div>

	<Separator />

	<!-- Notification type rows -->
	{#each NOTIFICATION_TYPE_ENTRIES as type (type)}
		<div class="grid grid-cols-[1fr_auto_auto] items-center gap-x-6 gap-y-0 px-1">
			<Label class="cursor-default font-normal">{NOTIFICATION_MESSAGES[type]()}</Label>
			<div class="flex w-16 justify-center">
				<Switch size="sm" bind:checked={preferences[type].inApp} />
			</div>
			<div class="flex w-16 justify-center">
				{#if supportsEmail(type)}
					<Switch size="sm" bind:checked={preferences[type].email} />
				{:else}
					<span class="text-xs text-muted-foreground">-</span>
				{/if}
			</div>
		</div>
	{/each}
</form>
