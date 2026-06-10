<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import * as InputGroup from './index.js';
	import InputGroupRoot from './input-group.svelte';
	import SearchIcon from '@lucide/svelte/icons/search';
	import MailIcon from '@lucide/svelte/icons/mail';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import EyeIcon from '@lucide/svelte/icons/eye';
	import SendIcon from '@lucide/svelte/icons/send';
	import LockIcon from '@lucide/svelte/icons/lock';

	const { Story } = defineMeta({
		title: 'Base/InputGroup',
		component: InputGroupRoot,
		tags: ['autodocs'],
	});
</script>

<Story name="All Variants">
	{#snippet template()}
		<div class="flex w-96 flex-col gap-6">
			<div class="flex flex-col gap-2">
				<p class="text-muted-foreground text-sm">Search bar</p>
				<InputGroup.Root>
					<InputGroup.Addon align="inline-start">
						<SearchIcon />
					</InputGroup.Addon>
					<InputGroup.Input placeholder="Search wishlists..." />
				</InputGroup.Root>
			</div>

			<div class="flex flex-col gap-2">
				<p class="text-muted-foreground text-sm">Copy-to-clipboard URL</p>
				<InputGroup.Root>
					<InputGroup.Input value="https://prejemesi.cz/w/birthday" readonly />
					<InputGroup.Addon align="inline-end">
						<InputGroup.Button intent="ghost" size="icon-xs" aria-label="Copy">
							<CopyIcon />
						</InputGroup.Button>
					</InputGroup.Addon>
				</InputGroup.Root>
			</div>

			<div class="flex flex-col gap-2">
				<p class="text-muted-foreground text-sm">Email subscribe</p>
				<InputGroup.Root>
					<InputGroup.Addon align="inline-start">
						<MailIcon />
					</InputGroup.Addon>
					<InputGroup.Input type="email" placeholder="you@example.com" />
					<InputGroup.Addon align="inline-end">
						<InputGroup.Button intent="primary" size="xs">Subscribe</InputGroup.Button>
					</InputGroup.Addon>
				</InputGroup.Root>
			</div>

			<div class="flex flex-col gap-2">
				<p class="text-muted-foreground text-sm">Password with visibility toggle</p>
				<InputGroup.Root>
					<InputGroup.Addon align="inline-start">
						<LockIcon />
					</InputGroup.Addon>
					<InputGroup.Input type="password" value="hunter2" />
					<InputGroup.Addon align="inline-end">
						<InputGroup.Button
							intent="ghost"
							size="icon-xs"
							aria-label="Toggle visibility"
						>
							<EyeIcon />
						</InputGroup.Button>
					</InputGroup.Addon>
				</InputGroup.Root>
			</div>

			<div class="flex flex-col gap-2">
				<p class="text-muted-foreground text-sm">Chat composer</p>
				<InputGroup.Root>
					<InputGroup.Textarea placeholder="Write a message..." />
					<InputGroup.Addon align="inline-end">
						<InputGroup.Button intent="primary" size="icon-xs" aria-label="Send">
							<SendIcon />
						</InputGroup.Button>
					</InputGroup.Addon>
				</InputGroup.Root>
			</div>
		</div>
	{/snippet}
</Story>

<Story name="Search Field">
	{#snippet template()}
		<div class="w-80">
			<InputGroup.Root>
				<InputGroup.Addon align="inline-start">
					<SearchIcon />
				</InputGroup.Addon>
				<InputGroup.Input placeholder="Search wishlists..." />
			</InputGroup.Root>
		</div>
	{/snippet}
</Story>

<Story name="URL With Copy Button">
	{#snippet template()}
		<div class="w-80">
			<InputGroup.Root>
				<InputGroup.Input value="https://prejemesi.cz/w/birthday" readonly />
				<InputGroup.Addon align="inline-end">
					<InputGroup.Button intent="ghost" size="icon-xs" aria-label="Copy">
						<CopyIcon />
					</InputGroup.Button>
				</InputGroup.Addon>
			</InputGroup.Root>
		</div>
	{/snippet}
</Story>

<Story name="Email Subscribe">
	{#snippet template()}
		<div class="w-80">
			<InputGroup.Root>
				<InputGroup.Addon align="inline-start">
					<MailIcon />
				</InputGroup.Addon>
				<InputGroup.Input type="email" placeholder="you@example.com" />
				<InputGroup.Addon align="inline-end">
					<InputGroup.Button intent="primary" size="xs">Subscribe</InputGroup.Button>
				</InputGroup.Addon>
			</InputGroup.Root>
		</div>
	{/snippet}
</Story>

<Story name="Password With Visibility Toggle">
	{#snippet template()}
		<div class="w-80">
			<InputGroup.Root>
				<InputGroup.Addon align="inline-start">
					<LockIcon />
				</InputGroup.Addon>
				<InputGroup.Input type="password" value="hunter2" />
				<InputGroup.Addon align="inline-end">
					<InputGroup.Button intent="ghost" size="icon-xs" aria-label="Toggle visibility">
						<EyeIcon />
					</InputGroup.Button>
				</InputGroup.Addon>
			</InputGroup.Root>
		</div>
	{/snippet}
</Story>

<Story name="Amount With Currency">
	{#snippet template()}
		<div class="w-80">
			<InputGroup.Root>
				<InputGroup.Addon align="inline-start">
					<InputGroup.Text>$</InputGroup.Text>
				</InputGroup.Addon>
				<InputGroup.Input placeholder="0.00" inputmode="decimal" />
				<InputGroup.Addon align="inline-end">
					<InputGroup.Text>USD</InputGroup.Text>
				</InputGroup.Addon>
			</InputGroup.Root>
		</div>
	{/snippet}
</Story>

<Story name="Chat Composer">
	{#snippet template()}
		<div class="w-80">
			<InputGroup.Root>
				<InputGroup.Textarea placeholder="Write a message..." />
				<InputGroup.Addon align="inline-end">
					<InputGroup.Button intent="primary" size="icon-xs" aria-label="Send">
						<SendIcon />
					</InputGroup.Button>
				</InputGroup.Addon>
			</InputGroup.Root>
		</div>
	{/snippet}
</Story>

<Story name="URL Prefix">
	{#snippet template()}
		<div class="w-80">
			<InputGroup.Root>
				<InputGroup.Addon align="inline-start">
					<InputGroup.Text>https://</InputGroup.Text>
				</InputGroup.Addon>
				<InputGroup.Input value="example.com" />
			</InputGroup.Root>
		</div>
	{/snippet}
</Story>
