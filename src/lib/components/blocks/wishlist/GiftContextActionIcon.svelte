<script lang="ts">
	import type { Component } from 'svelte';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import CheckIcon from '@lucide/svelte/icons/check';
	import Undo2Icon from '@lucide/svelte/icons/undo-2';
	import ListChecksIcon from '@lucide/svelte/icons/list-checks';
	import BookmarkIcon from '@lucide/svelte/icons/bookmark';
	import BookmarkXIcon from '@lucide/svelte/icons/bookmark-x';
	import ShoppingBagIcon from '@lucide/svelte/icons/shopping-bag';
	import StarIcon from '@lucide/svelte/icons/star';
	import TagIcon from '@lucide/svelte/icons/tag';
	import KeyRoundIcon from '@lucide/svelte/icons/key-round';
	import type { GiftContextAction } from '$lib/modules/gifts/gift_context_actions.js';

	const ACTION_ICONS: Record<GiftContextAction, Component> = {
		open: ExternalLinkIcon,
		copy: CopyIcon,
		edit: PencilIcon,
		received: CheckIcon,
		multiselect: ListChecksIcon,
		reserve: BookmarkIcon,
		'cancel-reservation': BookmarkXIcon,
		purchased: ShoppingBagIcon,
		priority: StarIcon,
		category: TagIcon,
		'release-reservation': KeyRoundIcon,
	};

	interface Props {
		action: GiftContextAction;
		/** Shows the undo icon for a command that reverts the gift's current state. */
		undo?: boolean;
	}
	let { action, undo = false }: Props = $props();
	const Icon = $derived(undo ? Undo2Icon : ACTION_ICONS[action]);
</script>

<Icon />
