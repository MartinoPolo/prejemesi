<script lang="ts">
	import * as Select from '$lib/components/base/select/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils.js';
	import type { DetectedColumn, ColumnRole } from '$lib/modules/import/detect_columns.js';
	import { COLUMN_ROLE } from '$lib/modules/import/detect_columns.js';
	import { MAPPING_FIELDS } from './import_wizard_types.js';

	interface ImportColumnMappingProps {
		columns: DetectedColumn[];
		onchange: (columns: DetectedColumn[]) => void;
	}

	let { columns, onchange }: ImportColumnMappingProps = $props();

	/** Sentinel value for the "clear this field" option in a single-select. */
	const UNSET_VALUE = '__unset__';

	/** A source column's caption: its header text, or a positional fallback when headerless. */
	function columnLabel(column: DetectedColumn): string {
		const label = column.headerLabel?.trim();
		if (label !== undefined && label.length > 0) {
			return label;
		}
		return m.import_wizard_column_fallback({ index: column.index + 1 });
	}

	/** Source columns currently feeding a given field role, in column order. */
	function columnsForRole(role: ColumnRole): DetectedColumn[] {
		return columns.filter((column) => column.role === role);
	}

	/** Reassign roles so `role` is held by exactly `indexes`, freeing displaced columns. */
	function assignRole(role: ColumnRole, indexes: number[]) {
		const next = new Set(indexes);
		const updated = columns.map((column) => {
			if (next.has(column.index)) {
				return column.role === role ? column : { ...column, role };
			}
			// Was feeding this field but no longer selected → release it.
			if (column.role === role) {
				return { ...column, role: COLUMN_ROLE.ignore };
			}
			return column;
		});
		onchange(updated);
	}

	function setSingle(role: ColumnRole, value: string | undefined) {
		if (value === undefined || value === UNSET_VALUE) {
			assignRole(role, []);
			return;
		}
		assignRole(role, [Number(value)]);
	}

	function setMulti(role: ColumnRole, values: string[]) {
		assignRole(
			role,
			values.map((value) => Number(value)),
		);
	}
</script>

<!-- One row per gift field; each picks the source column(s) that fill it. The
     field set is fixed, so width never grows with the spreadsheet. -->
<div class="grid gap-x-4 gap-y-3 [grid-template-columns:repeat(auto-fit,minmax(13rem,1fr))]">
	{#each MAPPING_FIELDS as field (field.role)}
		{@const selected = columnsForRole(field.role)}
		<div class="flex min-w-0 flex-col gap-1">
			<span class="text-foreground flex items-center gap-1 text-xs font-medium">
				{field.label()}
				{#if field.required}
					<span class="text-status-danger" aria-hidden="true">*</span>
				{/if}
			</span>

			{#if field.multi}
				<Select.Root
					type="multiple"
					value={selected.map((column) => String(column.index))}
					onValueChange={(values) => setMulti(field.role, values)}
				>
					<Select.Trigger size="sm" class="bg-background w-full">
						<span
							class={cn('truncate', selected.length === 0 && 'text-muted-foreground')}
						>
							{selected.length === 0
								? m.import_wizard_mapping_unset()
								: selected.map(columnLabel).join(', ')}
						</span>
					</Select.Trigger>
					<Select.Content>
						<Select.Group>
							{#each columns as column (column.index)}
								<Select.Item
									value={String(column.index)}
									label={columnLabel(column)}
									indicator="checkbox"
								>
									{columnLabel(column)}
								</Select.Item>
							{/each}
						</Select.Group>
					</Select.Content>
				</Select.Root>
			{:else}
				{@const current = selected[0]}
				<Select.Root
					type="single"
					value={current === undefined ? UNSET_VALUE : String(current.index)}
					onValueChange={(value) => setSingle(field.role, value)}
				>
					<Select.Trigger
						size="sm"
						state={field.required && current === undefined ? 'error' : 'default'}
						class="bg-background w-full"
					>
						<span
							class={cn('truncate', current === undefined && 'text-muted-foreground')}
						>
							{current === undefined
								? m.import_wizard_mapping_unset()
								: columnLabel(current)}
						</span>
					</Select.Trigger>
					<Select.Content>
						<Select.Group>
							<Select.Item
								value={UNSET_VALUE}
								label={m.import_wizard_mapping_unset()}
							>
								{m.import_wizard_mapping_unset()}
							</Select.Item>
							{#each columns as column (column.index)}
								<Select.Item
									value={String(column.index)}
									label={columnLabel(column)}
								>
									{columnLabel(column)}
								</Select.Item>
							{/each}
						</Select.Group>
					</Select.Content>
				</Select.Root>
			{/if}
		</div>
	{/each}
</div>
