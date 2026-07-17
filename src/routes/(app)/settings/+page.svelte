<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import {
		getUserProfile,
		updateProfile,
		refreshGoogleAvatar,
	} from '$lib/modules/settings/settings.remote.js';
	import {
		getNotificationPreferences,
		updateNotificationPreferences,
	} from '$lib/modules/notifications/notifications.remote.js';
	import type { NotificationPreferences } from '$lib/modules/notifications/types.js';
	import {
		SettingsProfileSection,
		SettingsSecuritySection,
		SettingsNotificationsSection,
		SettingsAppearanceSection,
		SettingsDangerSection,
	} from '$lib/components/blocks/settings/index.js';

	const profile = await getUserProfile();
	const notificationPreferences = await getNotificationPreferences();

	async function handleProfileSave(params: { name: string; image: string | null }) {
		await updateProfile(params);
		// Force-refresh the profile query so every surface reading it reflects the
		// change without a full page reload (same pattern as refreshWishlistDashboards).
		await getUserProfile().refresh();
	}

	async function handleFetchGoogleAvatar() {
		const result = await refreshGoogleAvatar();
		// Refresh so the navbar avatar and any other profile-reading surface update too.
		await getUserProfile().refresh();
		return result;
	}
</script>

<svelte:head>
	<title>{m.settings_page_title()}</title>
</svelte:head>

<div class="settings-page">
	<!-- Page header -->
	<div class="mb-8 motion-safe:animate-fade-up">
		<h1 class="font-heading text-[clamp(26px,3.4vw,34px)] font-semibold tracking-tight">
			{m.settings_title()}
		</h1>
		<p class="mt-1 text-ink-soft">{m.settings_subtitle()}</p>
	</div>

	<div class="settings-sections stagger-pop">
		<SettingsProfileSection
			email={profile.email}
			isOAuthUser={profile.isOAuthUser}
			hasGoogleAccount={profile.hasGoogleAccount}
			initialName={profile.name}
			initialAvatarUrl={profile.imageUrl}
			initialImageValue={profile.image}
			onSave={handleProfileSave}
			onFetchGoogleAvatar={handleFetchGoogleAvatar}
		/>

		{#if profile.isOAuthUser !== true}
			<SettingsSecuritySection />
		{/if}

		<SettingsNotificationsSection
			initialPreferences={notificationPreferences}
			onSave={(preferences: NotificationPreferences) =>
				updateNotificationPreferences({ preferences })}
		/>

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
