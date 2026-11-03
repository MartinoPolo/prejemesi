<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import * as Card from '$lib/components/base/card/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { ConfirmDialog } from '$lib/components/derived/confirm-dialog/index.js';
	import { authClient } from '$lib/auth_client.js';
	import { deleteAccount } from '$lib/modules/settings/settings.remote.js';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';

	let deleteDialogOpen = $state(false);
	let deleting = $state(false);

	async function handleDeleteAccount() {
		deleting = true;
		try {
			await deleteAccount();
			await authClient.signOut();
			window.location.href = resolve('/');
		} catch {
			deleting = false;
		}
	}
</script>

<Card.Root class="border-destructive/30">
	<Card.Header>
		<div class="flex items-center gap-2">
			<TriangleAlertIcon class="size-5 text-status-danger-text" />
			<div>
				<Card.Title class="text-status-danger-text">{m.settings_danger_title()}</Card.Title>
				<Card.Description>{m.settings_danger_description()}</Card.Description>
			</div>
		</div>
	</Card.Header>
	<Card.Content>
		<div class="flex items-center justify-between gap-4">
			<div>
				<p class="text-sm font-medium">{m.settings_delete_account()}</p>
				<p class="text-xs text-muted-foreground">
					{m.settings_delete_account_description()}
				</p>
			</div>
			<Button intent="danger" size="sm" onclick={() => (deleteDialogOpen = true)}>
				{m.settings_delete_account()}
			</Button>
		</div>
	</Card.Content>
</Card.Root>

<ConfirmDialog
	bind:open={deleteDialogOpen}
	title={m.settings_delete_confirm_title()}
	description={m.settings_delete_confirm_description()}
	confirmLabel={m.settings_delete_confirm_button()}
	pendingLabel={m.deleting()}
	confirmIntent="primary-destructive"
	pending={deleting}
	onconfirm={handleDeleteAccount}
/>
