<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import * as Card from '$lib/components/base/card/index.js';
	import { NotificationPreferencesForm } from '$lib/components/blocks/notification/index.js';
	import BellIcon from '@lucide/svelte/icons/bell';

	let notificationsSaving = $state(false);

	function handleSaveNotifications() {
		notificationsSaving = true;
		// TODO: save notification preferences to server
		setTimeout(() => {
			notificationsSaving = false;
		}, 500);
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
			onSave={handleSaveNotifications}
			isSaving={notificationsSaving}
		/>
	</Card.Content>
</Card.Root>
