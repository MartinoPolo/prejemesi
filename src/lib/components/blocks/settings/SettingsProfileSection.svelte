<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import * as Card from '$lib/components/base/card/index.js';
	import { Input } from '$lib/components/base/input/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { Separator } from '$lib/components/base/separator/index.js';
	import ImageUpload from '$lib/components/derived/image-upload/ImageUpload.svelte';
	import { untrack } from 'svelte';
	import UserIcon from '@lucide/svelte/icons/user';
	import type { UploadResult } from '$lib/modules/uploads/types.js';

	interface SettingsProfileSectionProps {
		email: string;
		isOAuthUser: boolean;
		initialName: string;
		initialAvatarUrl: string | null;
		onSave: (params: { name: string; image: string | null }) => Promise<void>;
	}

	let { email, isOAuthUser, initialName, initialAvatarUrl, onSave }: SettingsProfileSectionProps =
		$props();

	// untrack() is intentional: these props seed local editable state once at mount.
	// The local state intentionally diverges from the prop after first render.
	let displayName = $state(untrack(() => initialName));
	let avatarUrl = $state<string | null>(untrack(() => initialAvatarUrl));
	let avatarObjectKey = $state<string | null>(null);
	let saving = $state(false);
	let saved = $state(false);

	function getInitials(name: string): string {
		return name
			.split(' ')
			.map((part) => part[0])
			.join('')
			.toUpperCase()
			.slice(0, 2);
	}

	function handleAvatarUpload(result: UploadResult) {
		avatarUrl = result.publicUrl;
		avatarObjectKey = result.objectKey;
	}

	async function handleSave() {
		saving = true;
		saved = false;
		try {
			await onSave({ name: displayName, image: avatarObjectKey ?? avatarUrl });
			saved = true;
			setTimeout(() => {
				saved = false;
			}, 2000);
		} catch {
			// TODO: toast error
		} finally {
			saving = false;
		}
	}
</script>

<Card.Root>
	<Card.Header>
		<div class="flex items-center gap-2">
			<UserIcon class="size-5 text-muted-foreground" />
			<div>
				<Card.Title>{m.settings_profile_title()}</Card.Title>
				<Card.Description>{m.settings_profile_description()}</Card.Description>
			</div>
		</div>
	</Card.Header>
	<Card.Content>
		<div class="flex flex-col gap-6">
			<!-- Avatar -->
			<div class="flex flex-col gap-2">
				<Label>{m.settings_avatar_label()}</Label>
				<div class="flex items-center gap-4">
					{#if avatarUrl}
						<img
							src={avatarUrl}
							alt={displayName}
							class="size-16 rounded-full object-cover"
						/>
					{:else}
						<span
							class="flex size-16 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary"
						>
							{getInitials(displayName)}
						</span>
					{/if}
					<div class="flex-1">
						<ImageUpload target="avatar" size="small" onUpload={handleAvatarUpload} />
					</div>
				</div>
			</div>

			<Separator />

			<!-- Display name -->
			<div class="flex flex-col gap-2">
				<Label for="settings-display-name">{m.settings_display_name()}</Label>
				<Input
					id="settings-display-name"
					type="text"
					placeholder={m.settings_display_name_placeholder()}
					bind:value={displayName}
				/>
			</div>

			<!-- Email -->
			<div class="flex flex-col gap-2">
				<Label for="settings-email">{m.settings_email_label()}</Label>
				<Input
					id="settings-email"
					type="email"
					value={email}
					disabled={isOAuthUser}
					readonly={isOAuthUser}
				/>
				{#if isOAuthUser}
					<p class="text-xs text-muted-foreground">
						{m.settings_email_readonly_hint()}
					</p>
				{/if}
			</div>
		</div>
	</Card.Content>
	<Card.Footer class="flex justify-end">
		<Button onclick={handleSave} disabled={saving}>
			{#if saving}
				{m.saving()}
			{:else if saved}
				{m.saved()}
			{:else}
				{m.settings_save_profile()}
			{/if}
		</Button>
	</Card.Footer>
</Card.Root>
