<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import * as Dialog from '$lib/components/base/dialog/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { getLocalizedAuthHref } from '$lib/i18n/locale.js';
	import { resolve } from '$app/paths';

	interface LoginPromptDialogProps {
		open: boolean;
		redirectHref: string;
		title?: string;
		description?: string;
	}

	let {
		open = $bindable(false),
		redirectHref,
		title = m.like_auth_prompt_title(),
		description = m.like_auth_prompt_description(),
	}: LoginPromptDialogProps = $props();
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>{title}</Dialog.Title>
			<Dialog.Description>{description}</Dialog.Description>
		</Dialog.Header>
		<div class="flex justify-end gap-2">
			<Button
				intent="outline"
				href={getLocalizedAuthHref(resolve('/register'), redirectHref)}
			>
				{m.reserve_register()}
			</Button>
			<Button href={getLocalizedAuthHref(resolve('/login'), redirectHref)}>
				{m.reserve_login()}
			</Button>
		</div>
	</Dialog.Content>
</Dialog.Root>
