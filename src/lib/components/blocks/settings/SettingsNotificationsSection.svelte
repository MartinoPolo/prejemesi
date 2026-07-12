<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import * as Card from '$lib/components/base/card/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { NotificationPreferencesForm } from '$lib/components/blocks/notification/index.js';
	import type { NotificationPreferences } from '$lib/modules/notifications/types.js';
	import BellIcon from '@lucide/svelte/icons/bell';

	interface Props {
		initialPreferences: NotificationPreferences;
		onSave: (preferences: NotificationPreferences) => Promise<void>;
	}

	const NOTIFICATION_PREFERENCES_FORM_ID = 'notification-preferences-form';

	let { initialPreferences, onSave }: Props = $props();

	let notificationsSaving = $state(false);

	async function handleSaveNotifications(preferences: NotificationPreferences) {
		notificationsSaving = true;
		try {
			await onSave(preferences);
		} finally {
			notificationsSaving = false;
		}
	}
</script>

<Card.Root>
	<Card.Header>
		<div class="flex items-center gap-2">
			<BellIcon class="size-5 text-muted-foreground" />
			<div>
				<Card.Title>{m.settings_notifications_title()}</Card.Title>
				<Card.Description>{m.settings_notifications_description()}</Card.Description>
			</div>
		</div>
	</Card.Header>
	<Card.Content>
		<NotificationPreferencesForm
			formId={NOTIFICATION_PREFERENCES_FORM_ID}
			{initialPreferences}
			onSave={handleSaveNotifications}
		/>
	</Card.Content>
	<Card.Footer class="flex justify-end">
		<Button
			type="submit"
			form={NOTIFICATION_PREFERENCES_FORM_ID}
			disabled={notificationsSaving}
		>
			{notificationsSaving ? m.saving() : m.notification_prefs_save()}
		</Button>
	</Card.Footer>
</Card.Root>
