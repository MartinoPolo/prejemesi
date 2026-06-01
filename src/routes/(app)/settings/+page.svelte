<script lang="ts">
	import { resolve } from '$app/paths';
	import { untrack } from 'svelte';
	import * as Card from '$lib/components/base/card/index.js';
	import * as Dialog from '$lib/components/base/dialog/index.js';
	import { Input } from '$lib/components/base/input/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { Separator } from '$lib/components/base/separator/index.js';
	import { NotificationPreferencesForm } from '$lib/components/blocks/notification/index.js';
	import ImageUpload from '$lib/components/derived/image-upload/ImageUpload.svelte';
	import LanguageToggle from '$lib/components/derived/language-toggle/LanguageToggle.svelte';
	import { authClient } from '$lib/auth_client.js';
	import { updateProfile, deleteAccount } from '$lib/modules/settings/settings.remote.js';
	import { userPrefersMode, setMode } from 'mode-watcher';
	import UserIcon from '@lucide/svelte/icons/user';
	import ShieldIcon from '@lucide/svelte/icons/shield';
	import BellIcon from '@lucide/svelte/icons/bell';
	import PaletteIcon from '@lucide/svelte/icons/palette';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import SunIcon from '@lucide/svelte/icons/sun';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import MonitorIcon from '@lucide/svelte/icons/monitor';
	import EyeIcon from '@lucide/svelte/icons/eye';
	import EyeOffIcon from '@lucide/svelte/icons/eye-off';
	import type { UploadResult } from '$lib/modules/uploads/types.js';

	type Mode = 'light' | 'dark' | 'system';

	// ── Data from server ─────────────────────────────────────────────────────

	let { data } = $props();
	let profile = $derived(data.profile);

	// ── Profile state (initialized from server, then user-editable) ────────

	let displayName = $state(untrack(() => data.profile.name));
	let avatarUrl = $state<string | null>(untrack(() => data.profile.image));
	let profileSaving = $state(false);
	let profileSaved = $state(false);

	// ── Password state ───────────────────────────────────────────────────────

	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let showCurrentPassword = $state(false);
	let showNewPassword = $state(false);
	let passwordSaving = $state(false);
	let passwordError = $state('');
	let passwordSuccess = $state(false);

	// ── Delete account state ─────────────────────────────────────────────────

	let deleteDialogOpen = $state(false);
	let deleting = $state(false);

	// ── Notification state ───────────────────────────────────────────────────

	let notificationsSaving = $state(false);

	// ── Appearance ────────────────────────────────────────────────────────────

	let currentMode = $derived((userPrefersMode.current ?? 'system') as Mode);

	function getInitials(name: string): string {
		return name
			.split(' ')
			.map((part) => part[0])
			.join('')
			.toUpperCase()
			.slice(0, 2);
	}

	// ── Profile handlers ─────────────────────────────────────────────────────

	function handleAvatarUpload(result: UploadResult) {
		avatarUrl = result.publicUrl;
	}

	async function handleSaveProfile() {
		profileSaving = true;
		profileSaved = false;
		try {
			await updateProfile({ name: displayName, image: avatarUrl });
			profileSaved = true;
			setTimeout(() => {
				profileSaved = false;
			}, 2000);
		} catch {
			// TODO: toast error
		} finally {
			profileSaving = false;
		}
	}

	// ── Password handlers ────────────────────────────────────────────────────

	async function handleChangePassword() {
		passwordError = '';
		passwordSuccess = false;

		if (newPassword.length < 8) {
			passwordError = 'Heslo musi mit alespon 8 znaku';
			return;
		}
		if (newPassword !== confirmPassword) {
			passwordError = 'Hesla se neshoduji';
			return;
		}

		passwordSaving = true;
		try {
			const result = await authClient.changePassword({
				currentPassword,
				newPassword,
			});

			if (result.error) {
				passwordError = result.error.message ?? 'Chyba pri zmene hesla';
			} else {
				passwordSuccess = true;
				currentPassword = '';
				newPassword = '';
				confirmPassword = '';
				setTimeout(() => {
					passwordSuccess = false;
				}, 3000);
			}
		} catch {
			passwordError = 'Doslo k chybe. Zkuste to znovu.';
		} finally {
			passwordSaving = false;
		}
	}

	// ── Delete account handler ───────────────────────────────────────────────

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

	// ── Notification save handler ────────────────────────────────────────────

	function handleSaveNotifications() {
		notificationsSaving = true;
		// TODO: save notification preferences to server
		setTimeout(() => {
			notificationsSaving = false;
		}, 500);
	}
</script>

<svelte:head>
	<title>Nastaveni | Darecky</title>
</svelte:head>

<div class="settings-page">
	<!-- Page header -->
	<div class="mb-8">
		<h1 class="text-2xl font-bold">Nastaveni</h1>
		<p class="mt-1 text-muted-foreground">Spravujte svuj profil, zabezpeceni a predvolby</p>
	</div>

	<div class="settings-sections">
		<!-- ═══════════════════════════════════════════════════════════════════ -->
		<!-- Profile Section -->
		<!-- ═══════════════════════════════════════════════════════════════════ -->
		<Card.Root>
			<Card.Header>
				<div class="flex items-center gap-2">
					<UserIcon class="size-5 text-muted-foreground" />
					<div>
						<Card.Title>Profil</Card.Title>
						<Card.Description>Vase zakladni udaje a fotografie</Card.Description>
					</div>
				</div>
			</Card.Header>
			<Card.Content>
				<div class="flex flex-col gap-6">
					<!-- Avatar -->
					<div class="flex flex-col gap-2">
						<Label>Profilova fotografie</Label>
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
								<ImageUpload
									target="avatar"
									size="small"
									onUpload={handleAvatarUpload}
								/>
							</div>
						</div>
					</div>

					<Separator />

					<!-- Display name -->
					<div class="flex flex-col gap-2">
						<Label for="settings-display-name">Zobrazovane jmeno</Label>
						<Input
							id="settings-display-name"
							type="text"
							placeholder="Vase jmeno"
							bind:value={displayName}
						/>
					</div>

					<!-- Email -->
					<div class="flex flex-col gap-2">
						<Label for="settings-email">E-mail</Label>
						<Input
							id="settings-email"
							type="email"
							value={profile.email}
							disabled={profile.isOAuthUser}
							readonly={profile.isOAuthUser}
						/>
						{#if profile.isOAuthUser}
							<p class="text-xs text-muted-foreground">
								E-mail nelze zmenit u uctu prihlaseneho pres Google
							</p>
						{/if}
					</div>
				</div>
			</Card.Content>
			<Card.Footer class="flex justify-end">
				<Button onclick={handleSaveProfile} disabled={profileSaving}>
					{#if profileSaving}
						Ukladam...
					{:else if profileSaved}
						Ulozeno
					{:else}
						Ulozit profil
					{/if}
				</Button>
			</Card.Footer>
		</Card.Root>

		<!-- ═══════════════════════════════════════════════════════════════════ -->
		<!-- Security Section (email/password users only) -->
		<!-- ═══════════════════════════════════════════════════════════════════ -->
		{#if profile.isOAuthUser !== true}
			<Card.Root>
				<Card.Header>
					<div class="flex items-center gap-2">
						<ShieldIcon class="size-5 text-muted-foreground" />
						<div>
							<Card.Title>Zabezpeceni</Card.Title>
							<Card.Description>Zmena hesla a nastaveni prihlasovani</Card.Description
							>
						</div>
					</div>
				</Card.Header>
				<Card.Content>
					<div class="flex flex-col gap-4">
						<!-- Current password -->
						<div class="flex flex-col gap-2">
							<Label for="settings-current-password">Soucasne heslo</Label>
							<div class="relative">
								<Input
									id="settings-current-password"
									type={showCurrentPassword ? 'text' : 'password'}
									autocomplete="current-password"
									bind:value={currentPassword}
									class="pr-11!"
								/>
								<button
									class="password-toggle"
									type="button"
									aria-label={showCurrentPassword
										? 'Skryt heslo'
										: 'Zobrazit heslo'}
									onclick={() => (showCurrentPassword = !showCurrentPassword)}
									tabindex={-1}
								>
									{#if showCurrentPassword}
										<EyeOffIcon class="size-4" />
									{:else}
										<EyeIcon class="size-4" />
									{/if}
								</button>
							</div>
						</div>

						<!-- New password -->
						<div class="flex flex-col gap-2">
							<Label for="settings-new-password">Nove heslo</Label>
							<div class="relative">
								<Input
									id="settings-new-password"
									type={showNewPassword ? 'text' : 'password'}
									autocomplete="new-password"
									bind:value={newPassword}
									class="pr-11!"
								/>
								<button
									class="password-toggle"
									type="button"
									aria-label={showNewPassword ? 'Skryt heslo' : 'Zobrazit heslo'}
									onclick={() => (showNewPassword = !showNewPassword)}
									tabindex={-1}
								>
									{#if showNewPassword}
										<EyeOffIcon class="size-4" />
									{:else}
										<EyeIcon class="size-4" />
									{/if}
								</button>
							</div>
						</div>

						<!-- Confirm password -->
						<div class="flex flex-col gap-2">
							<Label for="settings-confirm-password">Potvrzeni noveho hesla</Label>
							<Input
								id="settings-confirm-password"
								type="password"
								autocomplete="new-password"
								bind:value={confirmPassword}
							/>
						</div>

						{#if passwordError}
							<p class="text-sm text-destructive">{passwordError}</p>
						{/if}
						{#if passwordSuccess}
							<p class="text-sm text-status-success">Heslo bylo zmeneno</p>
						{/if}
					</div>
				</Card.Content>
				<Card.Footer class="flex justify-end">
					<Button
						onclick={handleChangePassword}
						disabled={passwordSaving ||
							!currentPassword ||
							!newPassword ||
							!confirmPassword}
					>
						{passwordSaving ? 'Ukladam...' : 'Zmenit heslo'}
					</Button>
				</Card.Footer>
			</Card.Root>
		{/if}

		<!-- ═══════════════════════════════════════════════════════════════════ -->
		<!-- Notifications Section -->
		<!-- ═══════════════════════════════════════════════════════════════════ -->
		<Card.Root>
			<Card.Header>
				<div class="flex items-center gap-2">
					<BellIcon class="size-5 text-muted-foreground" />
					<div>
						<Card.Title>Upozorneni</Card.Title>
						<Card.Description>Nastavte si, jak chcete byt informovani</Card.Description>
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

		<!-- ═══════════════════════════════════════════════════════════════════ -->
		<!-- Appearance Section -->
		<!-- ═══════════════════════════════════════════════════════════════════ -->
		<Card.Root>
			<Card.Header>
				<div class="flex items-center gap-2">
					<PaletteIcon class="size-5 text-muted-foreground" />
					<div>
						<Card.Title>Vzhled</Card.Title>
						<Card.Description>Motiv a jazyk aplikace</Card.Description>
					</div>
				</div>
			</Card.Header>
			<Card.Content>
				<div class="flex flex-col gap-6">
					<!-- Dark mode -->
					<div class="flex flex-col gap-2">
						<Label>Barevny rezim</Label>
						<div class="mode-selector">
							<button
								class="mode-option"
								class:is-active={currentMode === 'light'}
								type="button"
								onclick={() => setMode('light')}
								aria-label="Svetly"
							>
								<SunIcon class="size-4" />
								<span>Svetly</span>
							</button>
							<button
								class="mode-option"
								class:is-active={currentMode === 'dark'}
								type="button"
								onclick={() => setMode('dark')}
								aria-label="Tmavy"
							>
								<MoonIcon class="size-4" />
								<span>Tmavy</span>
							</button>
							<button
								class="mode-option"
								class:is-active={currentMode === 'system'}
								type="button"
								onclick={() => setMode('system')}
								aria-label="System"
							>
								<MonitorIcon class="size-4" />
								<span>System</span>
							</button>
						</div>
					</div>

					<Separator />

					<!-- Language -->
					<div class="flex flex-col gap-2">
						<Label>Jazyk</Label>
						<LanguageToggle />
					</div>
				</div>
			</Card.Content>
		</Card.Root>

		<!-- ═══════════════════════════════════════════════════════════════════ -->
		<!-- Danger Zone Section -->
		<!-- ═══════════════════════════════════════════════════════════════════ -->
		<Card.Root class="border-destructive/30">
			<Card.Header>
				<div class="flex items-center gap-2">
					<TriangleAlertIcon class="size-5 text-destructive" />
					<div>
						<Card.Title class="text-destructive">Nebezpecna zona</Card.Title>
						<Card.Description>Nevratne akce s vasim uctem</Card.Description>
					</div>
				</div>
			</Card.Header>
			<Card.Content>
				<div class="flex items-center justify-between gap-4">
					<div>
						<p class="text-sm font-medium">Smazat ucet</p>
						<p class="text-xs text-muted-foreground">
							Trvale smazete svuj ucet a vsechna data. Tuto akci nelze vratit.
						</p>
					</div>
					<Button intent="danger" size="sm" onclick={() => (deleteDialogOpen = true)}>
						Smazat ucet
					</Button>
				</div>
			</Card.Content>
		</Card.Root>
	</div>
</div>

<!-- Delete account confirmation dialog -->
<Dialog.Root bind:open={deleteDialogOpen}>
	<Dialog.Content class="max-w-md">
		<Dialog.Header>
			<Dialog.Title>Opravdu chcete smazat ucet?</Dialog.Title>
			<Dialog.Description>
				Tato akce je nevratna. Vsechna vase data, seznamy a prani budou trvale smazana.
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer class="flex gap-2">
			<Button intent="outline" onclick={() => (deleteDialogOpen = false)} disabled={deleting}>
				Zrusit
			</Button>
			<Button intent="danger" onclick={handleDeleteAccount} disabled={deleting}>
				{deleting ? 'Mazani...' : 'Ano, smazat ucet'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<style>
	.settings-page {
		max-width: 48rem;
	}

	.settings-sections {
		display: flex;
		flex-direction: column;
		gap: var(--space-6);
	}

	.mode-selector {
		display: flex;
		gap: 2px;
		background: var(--muted);
		border-radius: var(--radius-lg);
		padding: 2px;
		width: fit-content;
	}

	.mode-option {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 14px;
		border: none;
		background: transparent;
		border-radius: var(--radius-md);
		font-size: var(--text-sm);
		font-weight: var(--weight-medium);
		color: var(--muted-foreground);
		cursor: pointer;
		font-family: var(--font-sans);
		transition:
			background var(--duration-fast),
			color var(--duration-fast),
			box-shadow var(--duration-fast);
		white-space: nowrap;
	}

	.mode-option:hover {
		color: var(--foreground);
	}

	.mode-option.is-active {
		background: var(--background);
		color: var(--foreground);
		box-shadow: var(--shadow-sm);
	}

	.password-toggle {
		position: absolute;
		right: 10px;
		top: 50%;
		transform: translateY(-50%);
		background: none;
		border: none;
		color: var(--muted-foreground);
		cursor: pointer;
		padding: 4px;
		display: flex;
		align-items: center;
		border-radius: var(--radius-sm);
		transition: color var(--duration-fast);
		line-height: 1;
	}

	.password-toggle:hover {
		color: var(--foreground);
	}
</style>
