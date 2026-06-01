<script lang="ts">
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import * as DropdownMenu from '$lib/components/base/dropdown-menu/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import UserIcon from '@lucide/svelte/icons/user';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import { authClient } from '$lib/auth_client.js';
	import * as m from '$lib/paraglide/messages.js';

	interface UserMenuProps {
		userName: string;
		userEmail: string;
		userInitials: string;
		userImage?: string | null;
	}

	let { userName, userEmail, userInitials, userImage = null }: UserMenuProps = $props();

	const settingsHref = resolve('/(app)/settings');

	async function handleSignOut() {
		await authClient.signOut();
		window.location.href = resolve('/');
	}
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<Button
				{...props}
				intent="ghost"
				size="icon"
				class="rounded-full"
				aria-label={m.nav_user_menu({ name: userName })}
			>
				{#if userImage}
					<img src={userImage} alt={userName} class="size-8 rounded-full object-cover" />
				{:else}
					<span
						class="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
					>
						{userInitials}
					</span>
				{/if}
			</Button>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content align="end" class="w-52">
		<DropdownMenu.Label class="flex flex-col gap-0.5 font-normal">
			<span class="text-sm font-semibold">{userName}</span>
			<span class="text-xs text-muted-foreground">{userEmail}</span>
		</DropdownMenu.Label>
		<DropdownMenu.Separator />
		<DropdownMenu.Group>
			<DropdownMenu.Item onSelect={() => goto(settingsHref)}>
				<UserIcon data-icon="inline-start" />
				{m.profile()}
			</DropdownMenu.Item>
			<DropdownMenu.Item onSelect={() => goto(settingsHref)}>
				<SettingsIcon data-icon="inline-start" />
				{m.nav_settings()}
			</DropdownMenu.Item>
		</DropdownMenu.Group>
		<DropdownMenu.Separator />
		<DropdownMenu.Group>
			<DropdownMenu.Item variant="destructive" onclick={handleSignOut}>
				<LogOutIcon data-icon="inline-start" />
				{m.nav_logout()}
			</DropdownMenu.Item>
		</DropdownMenu.Group>
	</DropdownMenu.Content>
</DropdownMenu.Root>
