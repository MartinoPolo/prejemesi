<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import * as Card from '$lib/components/base/card/index.js';
	import { NotificationPreferencesForm } from '$lib/components/blocks/notification/index.js';
	import type { NotificationPreferences } from '$lib/modules/notifications/types.js';
	import BellIcon from '@lucide/svelte/icons/bell';

	interface Props {
		initialPreferences: NotificationPreferences;
		onSave: (preferences: NotificationPreferences) => Promise<void>;
	}

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
			{initialPreferences}
			onSave={handleSaveNotifications}
			isSaving={notificationsSaving}
		/>
	</Card.Content>
</Card.Root>
