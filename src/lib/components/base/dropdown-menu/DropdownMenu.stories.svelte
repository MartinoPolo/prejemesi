<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, userEvent, waitFor } from 'storybook/test';
	import * as DropdownMenu from './index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import UserIcon from '@lucide/svelte/icons/user';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import TrashIcon from '@lucide/svelte/icons/trash';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import ScissorsIcon from '@lucide/svelte/icons/scissors';
	import ClipboardIcon from '@lucide/svelte/icons/clipboard';
	import DeleteIcon from '@lucide/svelte/icons/delete';
	import StoryKeyboardHints from '$lib/storybook/StoryKeyboardHints.svelte';
	import KeyboardHint from '$lib/storybook/KeyboardHint.svelte';
	import DropdownMenuRoot from './dropdown-menu.svelte';

	const { Story } = defineMeta({
		title: 'Base/DropdownMenu',
		component: DropdownMenuRoot,
		tags: ['autodocs'],
	});

	// Headless CI chromium runs the play functions under heavy parallel load, where
	// the default 1000ms waitFor timeout is occasionally exceeded (menu open / focus
	// settle / highlight propagation). Give interaction assertions generous headroom
	// so the suite is deterministic rather than timing-dependent.
	const INTERACTION_TIMEOUT = { timeout: 3000 } as const;

	// A closed menu is either unmounted or present with data-state="closed". Assert
	// the disjunction directly so the check never passes vacuously (requireAssertions)
	// and never races a mid-close unmount.
	function assertMenuClosed(canvasElement: HTMLElement) {
		const menu = canvasElement.querySelector('[role="menu"]') as HTMLElement | null;
		expect(menu === null || menu.dataset.state === 'closed').toBe(true);
	}

	async function waitForStoryReady() {
		await waitFor(() => {
			expect(getComputedStyle(document.body).pointerEvents).not.toBe('none');
		}, INTERACTION_TIMEOUT);
	}

	// Re-send a key until the UI reaches the expected state. Under headless-chromium
	// load a keystroke is occasionally dropped entirely (not merely slow — a 3s wait
	// still missed it), so a single send + wait is non-deterministic. We re-send with
	// a settle window longer than any open/close/highlight transition, so a key that
	// DID register is never double-applied (no highlight overshoot, no Enter-reopen)
	// while a genuinely dropped key is recovered. The final wait surfaces the real
	// assertion error if the state is still wrong after all attempts.
	async function pressUntil(
		key: string,
		assertState: () => void,
		{ sends = 5, settle = 800 }: { sends?: number; settle?: number } = {},
	) {
		for (let attempt = 0; attempt < sends; attempt++) {
			await userEvent.keyboard(key);
			try {
				await waitFor(assertState, { timeout: settle });
				return;
			} catch {
				// Keystroke likely dropped under load — resend on the next iteration.
			}
		}
		await waitFor(assertState, INTERACTION_TIMEOUT);
	}

	function menuItems(canvasElement: HTMLElement): NodeListOf<HTMLElement> {
		return canvasElement.querySelectorAll<HTMLElement>('[role="menuitem"]');
	}

	function findDropdownTrigger(canvasElement: HTMLElement): HTMLElement {
		const trigger = canvasElement.querySelector(
			'[data-dropdown-menu-trigger] [data-slot="button"]',
		) as HTMLElement | null;
		if (trigger) {
			return trigger;
		}
		const slotTrigger = canvasElement.querySelector(
			'[data-slot="dropdown-menu-trigger"]',
		) as HTMLElement | null;
		if (slotTrigger) {
			return slotTrigger;
		}
		throw new Error('DropdownMenu trigger button not found');
	}

	const playOpensOnClick = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		await waitForStoryReady();
		const trigger = findDropdownTrigger(canvasElement);
		trigger.click();
		await waitFor(
			() => expect(canvasElement.querySelector('[role="menu"]')).toBeTruthy(),
			INTERACTION_TIMEOUT,
		);
	};

	const playArrowDownFocusesItems = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		await waitForStoryReady();
		const trigger = findDropdownTrigger(canvasElement);
		// Re-focus until it sticks: a single focus() can be raced by late event-listener
		// attachment under CI load, which would drop the first ArrowDown and never open
		// the menu — the original source of this story's flakiness.
		await waitFor(() => {
			trigger.focus();
			expect(trigger).toHaveFocus();
		}, INTERACTION_TIMEOUT);
		// First ArrowDown opens the menu and highlights item 0.
		await pressUntil('{ArrowDown}', () => {
			expect(canvasElement.querySelector('[role="menu"]')).toBeTruthy();
			expect(menuItems(canvasElement).length).toBeGreaterThanOrEqual(2);
			expect(menuItems(canvasElement)[0]).toHaveAttribute('data-highlighted', '');
		});
		// Second ArrowDown moves the highlight to item 1.
		await pressUntil('{ArrowDown}', () => {
			expect(menuItems(canvasElement)[1]).toHaveAttribute('data-highlighted', '');
		});
	};

	const playEnterSelectsItem = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		await waitForStoryReady();
		const trigger = findDropdownTrigger(canvasElement);
		// Open via keyboard (focus trigger → ArrowDown), not trigger.click(): a mouse
		// open does not reliably move keyboard focus into the menu content under CI
		// load, so a later {Enter} could land on nothing. Keyboard open keeps focus in
		// the menu and matches the stable arrow-down story.
		await waitFor(() => {
			trigger.focus();
			expect(trigger).toHaveFocus();
		}, INTERACTION_TIMEOUT);
		await pressUntil('{ArrowDown}', () => {
			expect(canvasElement.querySelector('[role="menu"]')).toBeTruthy();
			expect(menuItems(canvasElement)[0]).toHaveAttribute('data-highlighted', '');
		});
		// Enter selects the highlighted item and closes the menu. Re-sent only if the
		// menu is still open after the settle window (key dropped); once closed, focus
		// has left the menu so pressUntil stops before any reopen.
		await pressUntil('{Enter}', () => assertMenuClosed(canvasElement));
	};

	const playEscapeClosesMenu = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		await waitForStoryReady();
		const trigger = findDropdownTrigger(canvasElement);
		// Open via keyboard so focus is inside the menu when Escape is sent (a mouse
		// open can leave focus on the trigger, where Escape is a no-op).
		await waitFor(() => {
			trigger.focus();
			expect(trigger).toHaveFocus();
		}, INTERACTION_TIMEOUT);
		await pressUntil('{ArrowDown}', () => {
			expect(canvasElement.querySelector('[role="menu"]')).toBeTruthy();
		});
		// Escape closes the menu; a re-sent Escape after close lands on the trigger and
		// is a harmless no-op.
		await pressUntil('{Escape}', () => assertMenuClosed(canvasElement));
	};
</script>

<Story name="Basic [play: opens on click]" play={playOpensOnClick}>
	{#snippet template()}
		<div class="flex h-48 items-start justify-center pt-4">
			<DropdownMenu.Root>
				<DropdownMenu.Trigger>
					{#snippet child({ props })}
						<Button intent="secondary" {...props}>Open Menu</Button>
					{/snippet}
				</DropdownMenu.Trigger>
				<DropdownMenu.Content portalProps={{ disabled: true }}>
					<DropdownMenu.Item>Profile</DropdownMenu.Item>
					<DropdownMenu.Item>Settings</DropdownMenu.Item>
					<DropdownMenu.Item>Billing</DropdownMenu.Item>
					<DropdownMenu.Item>Sign out</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		</div>
	{/snippet}
</Story>

<Story name="With Separators [play: arrow down focuses]" play={playArrowDownFocusesItems}>
	{#snippet template()}
		<div class="flex h-48 items-start justify-center pt-4">
			<DropdownMenu.Root>
				<DropdownMenu.Trigger>
					{#snippet child({ props })}
						<Button intent="secondary" {...props}>Open Menu</Button>
					{/snippet}
				</DropdownMenu.Trigger>
				<DropdownMenu.Content portalProps={{ disabled: true }}>
					<DropdownMenu.Group>
						<DropdownMenu.Label>My Account</DropdownMenu.Label>
						<DropdownMenu.Item>Profile</DropdownMenu.Item>
						<DropdownMenu.Item>Settings</DropdownMenu.Item>
					</DropdownMenu.Group>
					<DropdownMenu.Separator />
					<DropdownMenu.Group>
						<DropdownMenu.Label>Workspace</DropdownMenu.Label>
						<DropdownMenu.Item>Invite members</DropdownMenu.Item>
						<DropdownMenu.Item>Manage team</DropdownMenu.Item>
					</DropdownMenu.Group>
					<DropdownMenu.Separator />
					<DropdownMenu.Item>Sign out</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		</div>
	{/snippet}
</Story>

<Story name="With Icons [play: enter selects item]" play={playEnterSelectsItem}>
	{#snippet template()}
		<div class="flex h-48 items-start justify-center pt-4">
			<DropdownMenu.Root>
				<DropdownMenu.Trigger>
					{#snippet child({ props })}
						<Button intent="secondary" {...props}>Open Menu</Button>
					{/snippet}
				</DropdownMenu.Trigger>
				<DropdownMenu.Content portalProps={{ disabled: true }}>
					<DropdownMenu.Item>
						<UserIcon />
						Profile
					</DropdownMenu.Item>
					<DropdownMenu.Item>
						<SettingsIcon />
						Settings
					</DropdownMenu.Item>
					<DropdownMenu.Separator />
					<DropdownMenu.Item variant="destructive">
						<LogOutIcon />
						Sign out
					</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		</div>
	{/snippet}
</Story>

<Story name="With Keyboard Shortcuts [play: escape closes menu]" play={playEscapeClosesMenu}>
	{#snippet template()}
		<div class="flex h-64 flex-col items-center gap-4 pt-4">
			<StoryKeyboardHints>
				<KeyboardHint keys="↓ / ↑" action="Navigate menu items" />
				<KeyboardHint keys="Enter" action="Select item" />
				<KeyboardHint keys="Esc" action="Close menu" />
			</StoryKeyboardHints>
			<DropdownMenu.Root>
				<DropdownMenu.Trigger>
					{#snippet child({ props })}
						<Button intent="secondary" {...props}>Edit</Button>
					{/snippet}
				</DropdownMenu.Trigger>
				<DropdownMenu.Content portalProps={{ disabled: true }}>
					<DropdownMenu.Item>
						<CopyIcon />
						Copy
						<DropdownMenu.Shortcut>Ctrl+C</DropdownMenu.Shortcut>
					</DropdownMenu.Item>
					<DropdownMenu.Item>
						<ScissorsIcon />
						Cut
						<DropdownMenu.Shortcut>Ctrl+X</DropdownMenu.Shortcut>
					</DropdownMenu.Item>
					<DropdownMenu.Item>
						<ClipboardIcon />
						Paste
						<DropdownMenu.Shortcut>Ctrl+V</DropdownMenu.Shortcut>
					</DropdownMenu.Item>
					<DropdownMenu.Separator />
					<DropdownMenu.Item variant="destructive">
						<TrashIcon />
						Delete
						<DropdownMenu.Shortcut><DeleteIcon /></DropdownMenu.Shortcut>
					</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		</div>
	{/snippet}
</Story>

<Story name="With Sub-Menu">
	{#snippet template()}
		<div class="flex h-48 items-start justify-center pt-4">
			<DropdownMenu.Root>
				<DropdownMenu.Trigger>
					{#snippet child({ props })}
						<Button intent="secondary" {...props}>Open Menu</Button>
					{/snippet}
				</DropdownMenu.Trigger>
				<DropdownMenu.Content portalProps={{ disabled: true }}>
					<DropdownMenu.Item>Profile</DropdownMenu.Item>
					<DropdownMenu.Item>Settings</DropdownMenu.Item>
					<DropdownMenu.Separator />
					<DropdownMenu.Sub>
						<DropdownMenu.SubTrigger>More options</DropdownMenu.SubTrigger>
						<DropdownMenu.SubContent>
							<DropdownMenu.Item>Export data</DropdownMenu.Item>
							<DropdownMenu.Item>Import data</DropdownMenu.Item>
							<DropdownMenu.Item>Archive workspace</DropdownMenu.Item>
						</DropdownMenu.SubContent>
					</DropdownMenu.Sub>
					<DropdownMenu.Separator />
					<DropdownMenu.Item>Sign out</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		</div>
	{/snippet}
</Story>

<Story name="With Disabled Items">
	{#snippet template()}
		<div class="flex h-48 items-start justify-center pt-4">
			<DropdownMenu.Root>
				<DropdownMenu.Trigger>
					{#snippet child({ props })}
						<Button intent="secondary" {...props}>Open Menu</Button>
					{/snippet}
				</DropdownMenu.Trigger>
				<DropdownMenu.Content class="min-w-55" portalProps={{ disabled: true }}>
					<DropdownMenu.Item>
						<UserIcon />
						Profile
					</DropdownMenu.Item>
					<DropdownMenu.Item disabled>
						<SettingsIcon />
						Settings
						<DropdownMenu.Shortcut>Ctrl+,</DropdownMenu.Shortcut>
					</DropdownMenu.Item>
					<DropdownMenu.Separator />
					<DropdownMenu.Item disabled>
						<CopyIcon />
						Duplicate workspace
					</DropdownMenu.Item>
					<DropdownMenu.Item variant="destructive">
						<LogOutIcon />
						Sign out
					</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		</div>
	{/snippet}
</Story>

<Story name="All Variants">
	{#snippet template()}
		<div class="flex h-64 flex-wrap items-start gap-6 px-4 pt-4">
			<DropdownMenu.Root>
				<DropdownMenu.Trigger>
					{#snippet child({ props })}
						<Button intent="secondary" {...props}>Account</Button>
					{/snippet}
				</DropdownMenu.Trigger>
				<DropdownMenu.Content class="min-w-52" portalProps={{ disabled: true }}>
					<DropdownMenu.Group>
						<DropdownMenu.Label>My Account</DropdownMenu.Label>
						<DropdownMenu.Item>
							<UserIcon />
							Profile
						</DropdownMenu.Item>
						<DropdownMenu.Item>
							<SettingsIcon />
							Settings
						</DropdownMenu.Item>
					</DropdownMenu.Group>
					<DropdownMenu.Separator />
					<DropdownMenu.Item variant="destructive">
						<LogOutIcon />
						Sign out
					</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Root>

			<DropdownMenu.Root>
				<DropdownMenu.Trigger>
					{#snippet child({ props })}
						<Button intent="secondary" {...props}>Workspace</Button>
					{/snippet}
				</DropdownMenu.Trigger>
				<DropdownMenu.Content class="min-w-55" portalProps={{ disabled: true }}>
					<DropdownMenu.Item>
						<UserIcon />
						Profile
					</DropdownMenu.Item>
					<DropdownMenu.Item disabled>
						<SettingsIcon />
						Settings
						<DropdownMenu.Shortcut>Ctrl+,</DropdownMenu.Shortcut>
					</DropdownMenu.Item>
					<DropdownMenu.Separator />
					<DropdownMenu.Item disabled>
						<CopyIcon />
						Duplicate workspace
					</DropdownMenu.Item>
					<DropdownMenu.Item variant="destructive">
						<LogOutIcon />
						Sign out
					</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Root>

			<DropdownMenu.Root>
				<DropdownMenu.Trigger>
					{#snippet child({ props })}
						<Button intent="secondary" {...props}>Edit</Button>
					{/snippet}
				</DropdownMenu.Trigger>
				<DropdownMenu.Content class="min-w-48" portalProps={{ disabled: true }}>
					<DropdownMenu.Item>
						<CopyIcon />
						Copy
						<DropdownMenu.Shortcut>Ctrl+C</DropdownMenu.Shortcut>
					</DropdownMenu.Item>
					<DropdownMenu.Item>
						<ScissorsIcon />
						Cut
						<DropdownMenu.Shortcut>Ctrl+X</DropdownMenu.Shortcut>
					</DropdownMenu.Item>
					<DropdownMenu.Item>
						<ClipboardIcon />
						Paste
						<DropdownMenu.Shortcut>Ctrl+V</DropdownMenu.Shortcut>
					</DropdownMenu.Item>
					<DropdownMenu.Separator />
					<DropdownMenu.Item variant="destructive">
						<TrashIcon />
						Delete
						<DropdownMenu.Shortcut><DeleteIcon /></DropdownMenu.Shortcut>
					</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		</div>
	{/snippet}
</Story>
