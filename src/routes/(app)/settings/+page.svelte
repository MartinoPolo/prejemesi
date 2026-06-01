<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { getUserProfile, updateProfile } from '$lib/modules/settings/settings.remote.js';
	import {
		SettingsProfileSection,
		SettingsSecuritySection,
		SettingsNotificationsSection,
		SettingsAppearanceSection,
		SettingsDangerSection,
	} from '$lib/components/blocks/settings/index.js';

	const profile = await getUserProfile();
</script>

<svelte:head>
	<title>{m.settings_page_title()}</title>
</svelte:head>

<div class="settings-page">
	<!-- Page header -->
	<div class="mb-8">
		<h1 class="text-2xl font-bold">{m.settings_title()}</h1>
		<p class="mt-1 text-muted-foreground">{m.settings_subtitle()}</p>
	</div>

	<div class="settings-sections">
		<SettingsProfileSection
			email={profile.email}
			isOAuthUser={profile.isOAuthUser}
			initialName={profile.name}
			initialAvatarUrl={profile.image}
			onSave={updateProfile}
		/>

		{#if profile.isOAuthUser !== true}
			<SettingsSecuritySection />
		{/if}

		<SettingsNotificationsSection />

		<SettingsAppearanceSection />

		<SettingsDangerSection />
	</div>
</div>

<style>
	.settings-page {
		max-width: 48rem;
	}

	.settings-sections {
		display: flex;
		flex-direction: column;
		gap: var(--space-6);
	}
</style>
