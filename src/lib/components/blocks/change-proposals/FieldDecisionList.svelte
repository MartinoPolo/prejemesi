<script lang="ts">
	import { tick } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import CheckIcon from '@lucide/svelte/icons/check';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import XIcon from '@lucide/svelte/icons/x';
	import { Button } from '$lib/components/base/button/index.js';
	import { Input } from '$lib/components/base/input/index.js';
	import * as Select from '$lib/components/base/select/index.js';
	import { Textarea } from '$lib/components/base/textarea/index.js';
	import {
		CHANGE_DECISION,
		type ChangeDecision,
		type ChangeField,
	} from '$lib/modules/change_proposals/change_field_decisions.js';
	import { FIELD_REVIEW_STATE } from '$lib/modules/change_proposals/change_review_decisions.js';
	import DescriptionAppend from './DescriptionAppend.svelte';
	import DiffValues from './DiffValues.svelte';
	import type { ChangeReviewActions } from './change_review_rows.js';
	import {
		FIELD_EDITOR_CONTROL,
		type FieldChangeModel,
		type FieldEditor,
	} from './change_row_model.js';

	const PILLS = {
		[FIELD_REVIEW_STATE.accepted]: m.change_review_pill_accepted,
		[FIELD_REVIEW_STATE.edited]: m.change_review_pill_edited,
		[FIELD_REVIEW_STATE.rejected]: m.change_review_pill_rejected,
		[FIELD_REVIEW_STATE.undecided]: null,
	};

	/**
	 * A gift's proposed fields, each accepted, rejected or replaced with the reviewer's value.
	 * ✓ and ✕ toggle, so pressing the active one leaves the field undecided again.
	 */
	let {
		rowId,
		fields,
		originalDescription,
		actions,
		showUnresolved,
	}: {
		rowId: string;
		fields: readonly FieldChangeModel[];
		/** The description an append leaves as it is. */
		originalDescription: string | null;
		/** Absent once the proposal is closed or the row can no longer apply. */
		actions: ChangeReviewActions | undefined;
		/** Outlines undecided fields after Apply was pressed too early. */
		showUnresolved: boolean;
	} = $props();

	const idPrefix = $props.id();
	const editButtons = $state<Partial<Record<ChangeField, HTMLButtonElement>>>({});
	let editingField = $state<ChangeField | null>(null);
	let editorText = $state('');
	let editorInvalid = $state(false);

	function toggle(field: ChangeField, decision: ChangeDecision) {
		if (editingField === field) {
			editingField = null;
		}
		actions?.toggleField(rowId, field, decision);
	}

	async function closeEditor(field: ChangeField) {
		editingField = null;
		await tick();
		editButtons[field]?.focus();
	}

	function toggleEditor(field: FieldChangeModel) {
		if (editingField === field.field || field.editor === null) {
			editingField = null;
			return;
		}
		editingField = field.field;
		editorText = field.editor.text;
		editorInvalid = false;
	}

	function save(field: ChangeField) {
		if (actions?.editField(rowId, field, editorText) === false) {
			editorInvalid = true;
			return;
		}
		void closeEditor(field);
	}

	function onEditorKeydown(event: KeyboardEvent, field: ChangeField) {
		if (event.key === 'Escape') {
			event.preventDefault();
			void closeEditor(field);
		} else if (
			event.key === 'Enter' &&
			(!(event.target instanceof HTMLTextAreaElement) || event.ctrlKey || event.metaKey)
		) {
			event.preventDefault();
			save(field);
		}
	}

	function focusOnMount(node: HTMLElement) {
		node.focus();
	}

	function selectedLabel(editor: FieldEditor): string {
		return editor.options.find((option) => option.value === editorText)?.label ?? '';
	}
</script>

{#snippet editorControl(field: FieldChangeModel, editor: FieldEditor)}
	{@const controlId = `${idPrefix}-${field.field}`}
	<label class="sr-only" for={controlId}>{field.label}</label>
	{#if editor.control === FIELD_EDITOR_CONTROL.select}
		<Select.Root type="single" bind:value={editorText}>
			<Select.Trigger id={controlId} class="field-input" size="md" {@attach focusOnMount}>
				{selectedLabel(editor)}
			</Select.Trigger>
			<Select.Content>
				<Select.Group>
					{#each editor.options as option (option.value)}
						<Select.Item value={option.value} label={option.label}
							>{option.label}</Select.Item
						>
					{/each}
				</Select.Group>
			</Select.Content>
		</Select.Root>
	{:else if editor.control === FIELD_EDITOR_CONTROL.textarea}
		<Textarea
			id={controlId}
			class="field-input"
			rows={3}
			bind:value={editorText}
			state={editorInvalid ? 'error' : 'default'}
			aria-describedby="{controlId}-hint"
			onkeydown={(event) => onEditorKeydown(event, field.field)}
			{@attach focusOnMount}
		/>
		<span class="sr-only" id="{controlId}-hint">{m.change_review_edit_textarea_hint()}</span>
	{:else}
		<Input
			id={controlId}
			class="field-input"
			size="md"
			type={editor.control === FIELD_EDITOR_CONTROL.number ? 'number' : 'text'}
			inputmode={editor.control === FIELD_EDITOR_CONTROL.number ? 'numeric' : undefined}
			min={editor.control === FIELD_EDITOR_CONTROL.number ? 1 : undefined}
			bind:value={editorText}
			state={editorInvalid ? 'error' : 'default'}
			onkeydown={(event) => onEditorKeydown(event, field.field)}
			{@attach focusOnMount}
		/>
	{/if}
{/snippet}

{#snippet fieldValues(field: FieldChangeModel)}
	{#each field.diffs as diff, index (index)}
		<DiffValues {diff} />
	{/each}
	{#each field.appends as append, index (index)}
		<DescriptionAppend text={append} />
	{/each}
	{#if field.appends.length > 0 && originalDescription !== null}
		<p class="note">
			{m.change_review_original_description({ description: originalDescription })}
		</p>
	{/if}
	{#if field.proposed !== null}
		<span class="note">{m.change_review_field_proposed({ value: field.proposed })}</span>
	{/if}
{/snippet}

{#snippet fieldActions(field: FieldChangeModel, editing: boolean)}
	<span
		class={[
			'field-actions',
			showUnresolved && field.state === FIELD_REVIEW_STATE.undecided && 'needs-decision',
		]}
		role="group"
		aria-label={m.change_review_field_decision_label({ field: field.label })}
	>
		<button
			type="button"
			class="field-btn"
			data-field-action="accept"
			aria-pressed={field.state === FIELD_REVIEW_STATE.accepted ||
				field.state === FIELD_REVIEW_STATE.edited}
			aria-label={m.change_review_field_accept_label({ field: field.label })}
			title={m.change_review_accept()}
			onclick={() => toggle(field.field, CHANGE_DECISION.accepted)}
		>
			<CheckIcon aria-hidden="true" />
		</button>
		<button
			type="button"
			class="field-btn"
			data-field-action="reject"
			aria-pressed={field.state === FIELD_REVIEW_STATE.rejected}
			aria-label={m.change_review_field_reject_label({ field: field.label })}
			title={field.required
				? m.change_review_field_required_title()
				: m.change_review_reject()}
			disabled={field.required}
			onclick={() => toggle(field.field, CHANGE_DECISION.rejected)}
		>
			<XIcon aria-hidden="true" />
		</button>
		<button
			bind:this={editButtons[field.field]}
			type="button"
			class="field-btn"
			data-field-action="edit"
			aria-expanded={editing}
			aria-label={m.change_review_field_edit_label({ field: field.label })}
			title={field.editor === null
				? m.change_review_field_edit_unavailable()
				: m.change_review_edit()}
			disabled={field.editor === null}
			onclick={() => toggleEditor(field)}
		>
			<PencilIcon aria-hidden="true" />
		</button>
	</span>
{/snippet}

<ul class="field-list" aria-label={m.change_review_field_list_label()}>
	{#each fields as field (field.field)}
		{@const pill = PILLS[field.state]}
		{@const editing = actions !== undefined && editingField === field.field}
		<li class="field" data-decision={field.state} data-field={field.field}>
			<span class="field-label">{field.label}</span>
			<span class="field-values">{@render fieldValues(field)}</span>
			<span class="field-side">
				{#if pill !== null}
					<span
						class={[
							'pill',
							field.state === FIELD_REVIEW_STATE.rejected ? 'rejected' : 'accepted',
						]}>{pill()}</span
					>
				{/if}
				{#if actions !== undefined}
					{@render fieldActions(field, editing)}
				{/if}
			</span>
			{#if editing && field.editor !== null}
				<div
					class="field-edit"
					role="group"
					aria-label={m.change_review_field_editor_label({ field: field.label })}
				>
					<div class="field-control">
						{@render editorControl(field, field.editor)}
						{#if editorInvalid}
							<p class="field-error" role="alert">{m.change_review_edit_invalid()}</p>
						{/if}
					</div>
					<span class="field-edit-actions">
						<Button
							intent="secondary"
							size="md"
							onclick={() => void closeEditor(field.field)}
						>
							{m.change_review_edit_cancel()}
						</Button>
						<Button size="md" onclick={() => save(field.field)}>
							{m.change_review_edit_save()}
						</Button>
					</span>
				</div>
			{/if}
		</li>
	{/each}
</ul>

<style>
	.field-list {
		display: grid;
		gap: 6px;
	}

	/* The field row carries the decision tint: accepted green, rejected dashed and muted. */
	.field {
		--field-surface: var(--card);
		--diff-old-bg: transparent;
		--diff-new-bg: transparent;
		--diff-value-pad: 0;
		--diff-arrow-color: var(--muted-foreground);

		display: grid;
		grid-template:
			'label values side' auto
			'edit edit edit' auto
			/ 76px minmax(0, 1fr) auto;
		align-items: center;
		column-gap: 10px;
		padding: 5px 6px 5px 10px;
		border: 1.5px solid var(--border-strong);
		border-radius: 10px;
		background: var(--field-surface);
		transition: background-color var(--duration-normal) var(--ease-standard);
	}

	.field[data-decision='accepted'],
	.field[data-decision='edited'] {
		--field-surface: color-mix(in oklab, var(--status-success) 12%, var(--card));

		border-color: color-mix(in oklab, var(--status-success) 55%, var(--ink));
	}

	.field[data-decision='rejected'] {
		--field-surface: var(--muted);
		--diff-new-color: var(--muted-foreground);
		--diff-new-weight: 500;

		border-style: dashed;
	}

	.field-label {
		grid-area: label;
		color: var(--muted-foreground);
		font-size: var(--text-sm);
		font-weight: 600;
	}

	.field-values {
		display: flex;
		grid-area: values;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1) var(--space-2);
		min-width: 0;
		padding-block: var(--space-1);
		font-size: var(--text-md);
	}

	.note {
		flex-basis: 100%;
		color: var(--muted-foreground);
		font-size: var(--text-sm);
	}

	.field-side {
		display: flex;
		grid-area: side;
		align-items: center;
		justify-content: flex-end;
		gap: var(--space-2);
	}

	.pill {
		display: inline-flex;
		align-items: center;
		height: 22px;
		padding: 0 var(--space-2);
		border: 1.5px solid var(--ink);
		border-radius: var(--radius-badge);
		font-size: var(--text-xs);
		font-weight: 700;
		white-space: nowrap;
	}

	.pill.accepted {
		background: color-mix(in oklab, var(--status-success) 18%, var(--card));
		color: var(--status-success-text);
	}

	.pill.rejected {
		border-color: var(--border-strong);
		background: var(--card);
		color: var(--muted-foreground);
	}

	.field-actions {
		display: flex;
		gap: var(--space-1);
		border-radius: var(--radius-btn);
	}

	.field-btn {
		display: grid;
		place-items: center;
		width: var(--size-control-sm);
		height: var(--size-control-sm);
		padding: 0;
		border: 2px solid var(--ink);
		border-radius: var(--radius-btn);
		background: var(--card);
		color: var(--ink);
		cursor: pointer;
	}

	.field-btn:focus-visible {
		outline: 2px solid var(--ring);
		outline-offset: 2px;
	}

	.field-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.field-btn:hover:not(:disabled) {
		background: var(--panel-hover);
	}

	.field-btn[data-field-action='accept'][aria-pressed='true'] {
		border-color: var(--status-success-text);
		background: var(--status-success-text);
		color: var(--card);
	}

	.field-btn[data-field-action='reject'][aria-pressed='true'] {
		background: var(--ink);
		color: var(--card);
	}

	.field-btn[data-field-action='edit'][aria-expanded='true'] {
		background: var(--primary);
		color: var(--primary-foreground);
	}

	.field-btn :global(svg) {
		width: 16px;
		height: 16px;
	}

	.field-edit {
		display: flex;
		grid-area: edit;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: var(--space-2);
		padding: var(--space-1) 0 6px;
	}

	.field-control {
		display: grid;
		flex: 1 1 220px;
		gap: var(--space-1);
		min-width: 0;
	}

	.field-error {
		color: var(--status-danger-text);
		font-size: var(--text-sm);
		font-weight: 600;
	}

	.field-edit-actions {
		display: flex;
		gap: var(--nested-control-gap);
	}

	@media (width < 640px) {
		.field {
			grid-template:
				'label side' auto
				'values values' auto
				'edit edit' auto
				/ minmax(0, 1fr) auto;
			padding: 6px 6px 6px 10px;
		}

		.field-values {
			padding-block: 2px var(--space-1);
		}

		.field-edit-actions {
			flex-basis: 100%;
		}

		.field-edit-actions > :global(*) {
			flex: 1 1 0;
		}
	}
</style>
