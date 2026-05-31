<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import * as Sheet from '$lib/components/base/sheet/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import MenuIcon from '@lucide/svelte/icons/menu';
	import GiftIcon from '@lucide/svelte/icons/gift';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { cn } from '$lib/utils.js';

	interface NavLink {
		label: string;
		href: string;
	}

	interface MobileNavProps {
		navLinks: NavLink[];
	}

	let { navLinks }: MobileNavProps = $props();
	let open = $state(false);

	function isActive(href: string): boolean {
		return page.url.pathname.startsWith(href);
	}
</script>

<Sheet.Root bind:open>
	<Sheet.Trigger>
		{#snippet child({ props })}
			<Button
				{...props}
				intent="ghost"
				size="icon"
				aria-label="Otevreni menu"
				class="md:hidden"
			>
				<MenuIcon />
			</Button>
		{/snippet}
	</Sheet.Trigger>
	<Sheet.Content side="left" class="w-72 p-0">
		<Sheet.Header class="border-b border-border px-5 py-4">
			<Sheet.Title class="flex items-center gap-2">
				<span
					class="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary"
				>
					<GiftIcon class="size-[18px]" />
				</span>
				<span class="font-heading text-xl font-bold text-primary">
					darecky<span class="ml-0.5 text-lg font-medium opacity-42">.cz</span>
				</span>
			</Sheet.Title>
		</Sheet.Header>

		<nav class="flex flex-col gap-1 p-3">
			<Button
				intent="primary"
				href={resolve('/')}
				class="mb-2 w-full justify-center"
				onclick={() => (open = false)}
			>
				<PlusIcon data-icon="inline-start" />
				Vytvorit
			</Button>

			{#each navLinks as link (link.href)}
				<Button
					intent={isActive(link.href) ? 'secondary' : 'ghost'}
					href={link.href}
					class={cn(
						'w-full justify-start',
						isActive(link.href) && 'font-semibold text-primary',
					)}
					onclick={() => (open = false)}
				>
					{link.label}
				</Button>
			{/each}
		</nav>
	</Sheet.Content>
</Sheet.Root>
