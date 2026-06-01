<script lang="ts">
	import * as Sheet from '$lib/components/base/sheet/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import MenuIcon from '@lucide/svelte/icons/menu';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import LogoMark from './LogoMark.svelte';
	import { cn } from '$lib/utils.js';
	import * as m from '$lib/paraglide/messages.js';
	import type { NavLink } from './navbar-types.js';
	import { isNavActive } from './navbar-utils.js';

	interface MobileNavProps {
		navLinks: readonly NavLink[];
		oncreate?: () => void;
	}

	let { navLinks, oncreate }: MobileNavProps = $props();
	let open = $state(false);
</script>

<Sheet.Root bind:open>
	<Sheet.Trigger>
		{#snippet child({ props })}
			<Button
				{...props}
				intent="ghost"
				size="icon"
				aria-label={m.nav_open_menu()}
				class="md:hidden"
			>
				<MenuIcon data-icon />
			</Button>
		{/snippet}
	</Sheet.Trigger>
	<Sheet.Content side="left" class="w-72 p-0">
		<Sheet.Header class="border-b border-border px-5 py-4">
			<Sheet.Title>
				<LogoMark />
			</Sheet.Title>
		</Sheet.Header>

		<nav class="flex flex-col gap-1 p-3">
			<Button
				intent="primary"
				class="mb-2 w-full justify-center"
				onclick={() => {
					open = false;
					oncreate?.();
				}}
			>
				<PlusIcon data-icon="inline-start" />
				{m.nav_create()}
			</Button>

			{#each navLinks as link (link.href)}
				<Button
					intent={isNavActive(link.href) ? 'secondary' : 'ghost'}
					href={link.href}
					class={cn(
						'w-full justify-start',
						isNavActive(link.href) && 'font-semibold text-primary',
					)}
					onclick={() => (open = false)}
				>
					{link.label}
				</Button>
			{/each}
		</nav>
	</Sheet.Content>
</Sheet.Root>
