<script lang="ts">
	import * as ContextMenu from '$lib/components/base/context-menu/index.js';
	import * as DropdownMenu from '$lib/components/base/dropdown-menu/index.js';
	import GiftContextActionIcon from './GiftContextActionIcon.svelte';
	import type { GiftContextMenuGroup, GiftContextSubmenuEntry } from './gift_context_menu.js';

	interface Props {
		kind: 'context' | 'dropdown';
		groups: readonly GiftContextMenuGroup[];
	}
	let { kind, groups }: Props = $props();
	const Item = $derived(kind === 'dropdown' ? DropdownMenu.Item : ContextMenu.Item);
	const Separator = $derived(
		kind === 'dropdown' ? DropdownMenu.Separator : ContextMenu.Separator,
	);
	const Sub = $derived(kind === 'dropdown' ? DropdownMenu.Sub : ContextMenu.Sub);
	const SubTrigger = $derived(
		kind === 'dropdown' ? DropdownMenu.SubTrigger : ContextMenu.SubTrigger,
	);
	const SubContent = $derived(
		kind === 'dropdown' ? DropdownMenu.SubContent : ContextMenu.SubContent,
	);
	const RadioGroup = $derived(
		kind === 'dropdown' ? DropdownMenu.RadioGroup : ContextMenu.RadioGroup,
	);
	const RadioItem = $derived(
		kind === 'dropdown' ? DropdownMenu.RadioItem : ContextMenu.RadioItem,
	);
</script>

{#snippet submenu(entry: GiftContextSubmenuEntry)}
	<Sub
		><SubTrigger disabled={entry.disabled}
			><GiftContextActionIcon action={entry.action} />{entry.label}</SubTrigger
		>
		<SubContent
			><RadioGroup
				value={entry.menu.selectedId ?? ''}
				onValueChange={(id) => entry.menu.choose(id === '' ? null : id)}
			>
				{#each entry.menu.options as option (option.id)}<RadioItem value={option.id ?? ''}
						>{option.label}</RadioItem
					>{/each}
			</RadioGroup></SubContent
		>
	</Sub>
{/snippet}

{#each groups as group, groupIndex (group.name)}
	{#if groupIndex > 0}<Separator />{/if}
	{#each group.entries as entry (entry.action)}
		{#if entry.kind === 'submenu'}{@render submenu(entry)}{:else}<Item
				disabled={entry.disabled}
				class={entry.reversal === true ? 'text-status-danger-text' : undefined}
				onSelect={entry.select}
				><GiftContextActionIcon
					action={entry.action}
					undo={entry.undo}
				/>{entry.label}</Item
			>{/if}
	{/each}
{/each}
