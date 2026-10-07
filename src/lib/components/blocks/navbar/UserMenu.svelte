<script lang="ts">
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import * as DropdownMenu from '$lib/components/base/dropdown-menu/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import type { ControlSize } from '$lib/components/base/control_sizing.js';
	import {
		ANCHORED_CIRCULAR_STICKER_OWNER_CLASSES,
		CIRCULAR_STICKER_SURFACE_CLASSES,
	} from '$lib/components/base/button/button_variants.js';
	import { Avatar } from '$lib/components/derived/avatar/index.js';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import { authClient } from '$lib/auth_client.js';
	import { localizeInternalHref } from '$lib/i18n/locale.js';
	import * as m from '$lib/paraglide/messages.js';

	interface UserMenuProps {
		userName: string;
		userEmail: string;
		demo?: boolean;
		userInitials: string;
		userImage?: string | null;
		size?: ControlSize;
	}

	let demoExitPending = $state(false);
	let demoExitFailed = $state(false);

	let {
		userName,
		userEmail,
		userInitials,
		userImage = null,
		size,
		demo = false,
	}: UserMenuProps = $props();

	async function handleSignOut() {
		if (demo) {
			if (demoExitPending) {
				return;
			}
			demoExitPending = true;
			demoExitFailed = false;
			try {
				const response = await fetch(resolve('/demo/exit'), { method: 'POST' });
				if (!response.ok) {
					throw new Error('Exit failed');
				}
				window.location.assign(response.url);
			} catch {
				demoExitFailed = true;
				demoExitPending = false;
			}
			return;
		}
		try {
			await authClient.signOut();
		} finally {
			window.location.href = localizeInternalHref(resolve('/'));
		}
	}
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<Button
				{...props}
				intent="ghost"
				{size}
				format="icon"
				class={`rounded-full ${ANCHORED_CIRCULAR_STICKER_OWNER_CLASSES}`}
				surfaceClass={`border-[2.5px] border-ink bg-card group-hover:bg-card ${CIRCULAR_STICKER_SURFACE_CLASSES}`}
				aria-label={m.nav_user_menu({ name: userName })}
			>
				<Avatar
					src={userImage}
					alt=""
					initials={userInitials}
					shape="circle"
					class="size-full"
				/>
			</Button>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content align="end" class="w-52">
		<DropdownMenu.Label class="flex flex-col gap-0.5 font-normal">
			<span class="text-sm font-semibold">{userName}</span>
			<span class="text-xs text-muted-foreground"
				>{demo ? m.demo_user_label() : userEmail}</span
			>
		</DropdownMenu.Label>
		<DropdownMenu.Separator />
		<DropdownMenu.Group>
			<DropdownMenu.Item onSelect={() => goto(localizeInternalHref(resolve('/settings')))}>
				<SettingsIcon data-icon="inline-start" />
				{m.nav_settings()}
			</DropdownMenu.Item>
		</DropdownMenu.Group>
		<DropdownMenu.Separator />
		<DropdownMenu.Group>
			<DropdownMenu.Item
				variant="destructive"
				onclick={handleSignOut}
				disabled={demoExitPending}
			>
				<LogOutIcon data-icon="inline-start" />
				{demo ? m.demo_exit_menu() : m.nav_logout()}
			</DropdownMenu.Item>
		</DropdownMenu.Group>
		{#if demoExitFailed}<p role="alert" class="p-2 text-sm text-destructive">
				{m.demo_exit_error()}
			</p>{/if}
	</DropdownMenu.Content>
</DropdownMenu.Root>
