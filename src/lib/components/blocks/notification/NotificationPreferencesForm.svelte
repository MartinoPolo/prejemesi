<script lang="ts">
	import { Switch } from '$lib/components/base/switch/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	import { Button } from '$lib/components/base/button/index.js';
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
		initialPreferences?: NotificationPreferences;
		onSave: (preferences: NotificationPreferences) => void;
		isSaving?: boolean;
	}

	let {
		initialPreferences = DEFAULT_NOTIFICATION_PREFERENCES,
		onSave,
		isSaving = false,
	}: NotificationPreferencesFormProps = $props();

	let preferences = $state<NotificationPreferences>({ ...initialPreferences });

	const NOTIFICATION_TYPE_ENTRIES = Object.values(NOTIFICATION_TYPE);

	function supportsEmail(type: NotificationType): boolean {
		return EMAIL_NOTIFICATION_TYPES.includes(type);
	}

	function handleSave() {
		onSave($state.snapshot(preferences));
	}
</script>

<div class="flex flex-col gap-4">
	<div class="flex flex-col gap-1">
		<h3 class="text-base font-semibold">Nastaveni upozorneni</h3>
		<p class="text-sm text-muted-foreground">Zvolte, jak chcete byt informovani.</p>
	</div>

	<Separator />

	<!-- Header row -->
	<div class="grid grid-cols-[1fr_auto_auto] items-center gap-x-6 gap-y-0 px-1">
		<span class="text-xs font-medium text-muted-foreground">Typ upozorneni</span>
		<span class="w-16 text-center text-xs font-medium text-muted-foreground">V aplikaci</span>
		<span class="w-16 text-center text-xs font-medium text-muted-foreground">E-mail</span>
	</div>

	<Separator />

	<!-- Notification type rows -->
	{#each NOTIFICATION_TYPE_ENTRIES as type (type)}
		<div class="grid grid-cols-[1fr_auto_auto] items-center gap-x-6 gap-y-0 px-1">
			<Label class="cursor-default font-normal">{NOTIFICATION_MESSAGES[type]}</Label>
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

	<Separator />

	<div class="flex justify-end">
		<Button onclick={handleSave} disabled={isSaving}>
			{isSaving ? 'Ukladam...' : 'Ulozit nastaveni'}
		</Button>
	</div>
</div>
