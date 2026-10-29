<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Checkbox } from '$lib/components/base/checkbox/index.js';
	import { HelpText } from '$lib/components/base/help-text/index.js';
	import { SearchField } from '$lib/components/base/search-field/index.js';
	import { Skeleton } from '$lib/components/base/skeleton/index.js';
	import { choiceRowVariants } from '$lib/components/derived/choice-row/index.js';
	import { FieldError } from '$lib/components/derived/field/index.js';
	import { cn } from '$lib/utils.js';
	import {
		getAccessTokenWishlistChoices,
		type AccessTokenWishlistChoices,
	} from '$lib/modules/access_tokens/index.js';

	interface AccessTokenWishlistPickerProps {
		selectedIds: string[];
		search: string;
		/** Set when no list is picked; picking one clears it. */
		missingSelection: boolean;
	}

	/** The picker offers search once scanning the list by eye gets slow. */
	const WISHLIST_SEARCH_THRESHOLD = 8;

	let {
		selectedIds = $bindable(),
		search = $bindable(),
		missingSelection = $bindable(),
	}: AccessTokenWishlistPickerProps = $props();

	const idPrefix = $props.id();

	function toggleWishlist(wishlistId: string, checked: boolean) {
		selectedIds = checked
			? [...selectedIds, wishlistId]
			: selectedIds.filter((selectedId) => selectedId !== wishlistId);
		if (checked) {
			missingSelection = false;
		}
	}

	function normalizeForSearch(text: string): string {
		return text
			.normalize('NFD')
			.replace(/\p{Diacritic}/gu, '')
			.toLocaleLowerCase();
	}

	function wishlistGroups(choices: AccessTokenWishlistChoices) {
		const query = normalizeForSearch(search.trim());
		return [
			{ label: m.nav_my_lists(), showRecipient: false, wishlists: choices.own },
			{ label: m.nav_moderated(), showRecipient: true, wishlists: choices.managed },
			{ label: m.nav_followed(), showRecipient: true, wishlists: choices.followed },
		]
			.map((group) => ({
				...group,
				wishlists: group.wishlists.filter((wishlist) =>
					normalizeForSearch(
						`${wishlist.title} ${wishlist.recipientDisplayName}`,
					).includes(query),
				),
			}))
			.filter((group) => group.wishlists.length > 0);
	}
</script>

{#snippet wishlistGroup(group: ReturnType<typeof wishlistGroups>[number], groupIndex: number)}
	<div role="group" aria-labelledby="{idPrefix}-group-{groupIndex}">
		<p
			id="{idPrefix}-group-{groupIndex}"
			class="px-2.5 pt-2.5 pb-0.5 text-(length:--text-sm) font-semibold text-muted-foreground"
		>
			{group.label}
		</p>
		{#each group.wishlists as wishlist (wishlist.id)}
			{@const checked = selectedIds.includes(wishlist.id)}
			<label
				for="{idPrefix}-wishlist-{wishlist.id}"
				class={cn(
					choiceRowVariants({ selected: checked }),
					'gap-2.5 px-2.5 py-1.5 text-(length:--text-md)',
				)}
			>
				<Checkbox
					id="{idPrefix}-wishlist-{wishlist.id}"
					size="sm"
					{checked}
					onCheckedChange={(value) => toggleWishlist(wishlist.id, value === true)}
				/>
				<span data-slot="choice-row-label">
					{wishlist.title}
					{#if group.showRecipient}
						<span class="font-normal text-muted-foreground">
							· {wishlist.recipientDisplayName}
						</span>
					{/if}
				</span>
			</label>
		{/each}
	</div>
{/snippet}

<div class="picker" data-wishlist-picker>
	{#await getAccessTokenWishlistChoices()}
		<div class="flex flex-col gap-2 p-2.5" aria-busy="true">
			<Skeleton class="h-4 w-1/2" />
			<Skeleton class="h-4 w-2/3" />
		</div>
	{:then choices}
		{@const choiceCount = choices.own.length + choices.managed.length + choices.followed.length}
		{@const groups = wishlistGroups(choices)}
		{#if choiceCount > WISHLIST_SEARCH_THRESHOLD}
			<SearchField
				bind:value={search}
				size="md"
				placeholder={m.access_tokens_lists_search()}
				aria-label={m.access_tokens_lists_search()}
			/>
		{/if}
		{#if choiceCount === 0}
			<HelpText class="m-0 px-2.5 py-2">{m.access_tokens_lists_none()}</HelpText>
		{:else if groups.length === 0}
			<HelpText class="m-0 px-2.5 py-2">{m.access_tokens_lists_no_match()}</HelpText>
		{/if}
		{#each groups as group, groupIndex (group.label)}
			{@render wishlistGroup(group, groupIndex)}
		{/each}
		<p
			class="px-2.5 pt-1.5 pb-1 text-(length:--text-sm) text-muted-foreground"
			aria-live="polite"
		>
			{m.access_tokens_lists_selected({ count: selectedIds.length })}
		</p>
	{:catch}
		<HelpText state="error" class="m-0 px-2.5 py-2">
			{m.access_tokens_lists_load_error()}
		</HelpText>
	{/await}
	{#if missingSelection}
		<FieldError class="px-2.5 pb-1.5">{m.access_tokens_lists_required()}</FieldError>
	{/if}
</div>

<style>
	/* A 12px tray with a 3px inset keeps its rows on the 7px control radius: 12 - 2 - 3. */
	.picker {
		display: flex;
		flex-direction: column;
		gap: 2px;
		margin-top: var(--space-1);
		padding: 3px;
		border: 2px solid var(--border-strong);
		border-radius: var(--radius-badge);
	}
</style>
