<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import * as InputGroup from './index.js';
	import InputGroupRoot from './input-group.svelte';
	import SearchIcon from '@lucide/svelte/icons/search';
	import MailIcon from '@lucide/svelte/icons/mail';
	import LinkIcon from '@lucide/svelte/icons/link';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import EyeIcon from '@lucide/svelte/icons/eye';
	import SendIcon from '@lucide/svelte/icons/send';

	const { Story } = defineMeta({
		title: 'Base/InputGroup',
		component: InputGroupRoot,
		tags: ['autodocs'],
	});
</script>

<Story name="With Icon Prefix">
	<div class="w-80">
		<InputGroup.Root>
			<InputGroup.Addon align="inline-start">
				<SearchIcon />
			</InputGroup.Addon>
			<InputGroup.Input placeholder="Search..." />
		</InputGroup.Root>
	</div>
</Story>

<Story name="With Icon Suffix">
	<div class="w-80">
		<InputGroup.Root>
			<InputGroup.Input placeholder="Enter URL" />
			<InputGroup.Addon align="inline-end">
				<LinkIcon />
			</InputGroup.Addon>
		</InputGroup.Root>
	</div>
</Story>

<Story name="With Text Prefix">
	<div class="w-80">
		<InputGroup.Root>
			<InputGroup.Addon align="inline-start">
				<InputGroup.Text>https://</InputGroup.Text>
			</InputGroup.Addon>
			<InputGroup.Input placeholder="example.com" />
		</InputGroup.Root>
	</div>
</Story>

<Story name="With Button Suffix">
	<div class="w-80">
		<InputGroup.Root>
			<InputGroup.Addon align="inline-start">
				<MailIcon />
			</InputGroup.Addon>
			<InputGroup.Input placeholder="Enter email" type="email" />
			<InputGroup.Addon align="inline-end">
				<InputGroup.Button intent="primary" size="xs">Subscribe</InputGroup.Button>
			</InputGroup.Addon>
		</InputGroup.Root>
	</div>
</Story>

<Story name="With Icon Button">
	<div class="w-80">
		<InputGroup.Root>
			<InputGroup.Input placeholder="Copy this text" value="https://example.com/path" />
			<InputGroup.Addon align="inline-end">
				<InputGroup.Button intent="ghost" size="icon-xs" aria-label="Copy">
					<CopyIcon />
				</InputGroup.Button>
			</InputGroup.Addon>
		</InputGroup.Root>
	</div>
</Story>

<Story name="With Both Addons">
	<div class="w-80">
		<InputGroup.Root>
			<InputGroup.Addon align="inline-start">
				<EyeIcon />
			</InputGroup.Addon>
			<InputGroup.Input placeholder="Password" type="password" />
			<InputGroup.Addon align="inline-end">
				<InputGroup.Button intent="ghost" size="icon-xs" aria-label="Toggle visibility">
					<EyeIcon />
				</InputGroup.Button>
			</InputGroup.Addon>
		</InputGroup.Root>
	</div>
</Story>

<Story name="With Textarea">
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
</Story>

<Story name="Block Start Addon">
	<div class="w-80">
		<InputGroup.Root>
			<InputGroup.Addon align="block-start">
				<InputGroup.Text>Label above</InputGroup.Text>
			</InputGroup.Addon>
			<InputGroup.Input placeholder="Input with block-start addon" />
		</InputGroup.Root>
	</div>
</Story>

<Story name="Block End Addon">
	<div class="w-80">
		<InputGroup.Root>
			<InputGroup.Input placeholder="Input with block-end addon" />
			<InputGroup.Addon align="block-end">
				<InputGroup.Text>Helper text below</InputGroup.Text>
			</InputGroup.Addon>
		</InputGroup.Root>
	</div>
</Story>

<Story name="All Variants">
	<div class="flex flex-col gap-6 w-96">
		<div>
			<p class="mb-2 text-sm font-medium text-muted-foreground">Icon prefix</p>
			<InputGroup.Root>
				<InputGroup.Addon align="inline-start">
					<SearchIcon />
				</InputGroup.Addon>
				<InputGroup.Input placeholder="Search..." />
			</InputGroup.Root>
		</div>

		<div>
			<p class="mb-2 text-sm font-medium text-muted-foreground">
				Text prefix + button suffix
			</p>
			<InputGroup.Root>
				<InputGroup.Addon align="inline-start">
					<InputGroup.Text>https://</InputGroup.Text>
				</InputGroup.Addon>
				<InputGroup.Input placeholder="example.com" />
				<InputGroup.Addon align="inline-end">
					<InputGroup.Button intent="primary" size="xs">Go</InputGroup.Button>
				</InputGroup.Addon>
			</InputGroup.Root>
		</div>

		<div>
			<p class="mb-2 text-sm font-medium text-muted-foreground">
				Icon prefix + icon button suffix
			</p>
			<InputGroup.Root>
				<InputGroup.Addon align="inline-start">
					<MailIcon />
				</InputGroup.Addon>
				<InputGroup.Input placeholder="Email address" />
				<InputGroup.Addon align="inline-end">
					<InputGroup.Button intent="ghost" size="icon-xs" aria-label="Send">
						<SendIcon />
					</InputGroup.Button>
				</InputGroup.Addon>
			</InputGroup.Root>
		</div>

		<div>
			<p class="mb-2 text-sm font-medium text-muted-foreground">With textarea</p>
			<InputGroup.Root>
				<InputGroup.Textarea placeholder="Write a message..." />
				<InputGroup.Addon align="inline-end">
					<InputGroup.Button intent="primary" size="icon-xs" aria-label="Send">
						<SendIcon />
					</InputGroup.Button>
				</InputGroup.Addon>
			</InputGroup.Root>
		</div>

		<div>
			<p class="mb-2 text-sm font-medium text-muted-foreground">Block addons</p>
			<InputGroup.Root>
				<InputGroup.Addon align="block-start">
					<InputGroup.Text>Title</InputGroup.Text>
				</InputGroup.Addon>
				<InputGroup.Input placeholder="Enter value" />
				<InputGroup.Addon align="block-end">
					<InputGroup.Text>Description text below</InputGroup.Text>
				</InputGroup.Addon>
			</InputGroup.Root>
		</div>
	</div>
</Story>
