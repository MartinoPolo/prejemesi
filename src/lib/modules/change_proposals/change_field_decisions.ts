import * as v from 'valibot';

/** A reviewer's decision on one proposal row or one of its fields. */
export const CHANGE_DECISION = {
	accepted: 'accepted',
	rejected: 'rejected',
} as const;

export type ChangeDecision = (typeof CHANGE_DECISION)[keyof typeof CHANGE_DECISION];

/** The gift fields a reviewer decides one by one, in the order the review page lists them. */
export const CHANGE_FIELD = {
	name: 'name',
	description: 'description',
	append: 'append',
	price: 'price',
	quantity: 'quantity',
	category: 'category',
	priority: 'priority',
	links: 'links',
	image: 'image',
} as const;

export type ChangeField = (typeof CHANGE_FIELD)[keyof typeof CHANGE_FIELD];

export const CHANGE_FIELDS = Object.values(CHANGE_FIELD);

/** The operation input keys each field covers; rejecting a field drops all of them. */
const INPUT_KEYS_BY_FIELD = {
	name: ['name'],
	description: ['description', 'descriptionAppendEdit'],
	append: ['text'],
	price: ['price', 'priceMax', 'currency'],
	quantity: ['quantity'],
	category: ['categoryId'],
	priority: ['priorityLevelId'],
	links: ['links'],
	image: ['imageReference', 'imageUrl', 'imageKey', 'imageMeta'],
} as const satisfies Record<ChangeField, readonly string[]>;

/** Operations whose rows are decided field by field; every other row is decided whole. */
const FIELDS_BY_OPERATION: Readonly<Record<string, readonly ChangeField[]>> = {
	createGift: [
		CHANGE_FIELD.name,
		CHANGE_FIELD.description,
		CHANGE_FIELD.price,
		CHANGE_FIELD.quantity,
		CHANGE_FIELD.category,
		CHANGE_FIELD.priority,
		CHANGE_FIELD.links,
		CHANGE_FIELD.image,
	],
	updateGift: [
		CHANGE_FIELD.name,
		CHANGE_FIELD.description,
		CHANGE_FIELD.price,
		CHANGE_FIELD.quantity,
		CHANGE_FIELD.category,
		CHANGE_FIELD.priority,
		CHANGE_FIELD.links,
		CHANGE_FIELD.image,
	],
	appendGiftDescription: [CHANGE_FIELD.append],
};

/** A new gift needs its name, so only the whole gift can be rejected, never the name alone. */
const REQUIRED_FIELDS: Readonly<Record<string, readonly ChangeField[]>> = {
	createGift: [CHANGE_FIELD.name],
};

/** Fields the reviewer may give their own value; images and links are only accepted or rejected. */
const EDITABLE_FIELDS = new Set<ChangeField>([
	CHANGE_FIELD.name,
	CHANGE_FIELD.description,
	CHANGE_FIELD.append,
	CHANGE_FIELD.price,
	CHANGE_FIELD.quantity,
	CHANGE_FIELD.category,
	CHANGE_FIELD.priority,
]);

export function isEditableChangeField(field: ChangeField): boolean {
	return EDITABLE_FIELDS.has(field);
}

export function isRequiredChangeField(operation: string, field: ChangeField): boolean {
	return REQUIRED_FIELDS[operation]?.includes(field) ?? false;
}

/** An operation input as a plain record, or null when it is not an object. */
export function changeInputRecord(input: unknown): Record<string, unknown> | null {
	return typeof input === 'object' && input !== null && !Array.isArray(input)
		? Object.fromEntries(Object.entries(input))
		: null;
}

/** Whether a row is decided field by field rather than as a whole. */
export function isFieldDecidedOperation(operation: string): boolean {
	return Object.hasOwn(FIELDS_BY_OPERATION, operation);
}

/** The fields a row's input sets, in review order; empty for a row decided as a whole. */
export function changeRowFields(operation: string, input: unknown): ChangeField[] {
	const record = changeInputRecord(input);
	const fields = FIELDS_BY_OPERATION[operation] ?? [];
	if (record === null) {
		return [];
	}
	return CHANGE_FIELDS.filter(
		(field) =>
			fields.includes(field) &&
			INPUT_KEYS_BY_FIELD[field].some((key) => Object.hasOwn(record, key)),
	);
}

export const FIELD_DECISION = {
	rejected: 'rejected',
	edited: 'edited',
} as const;

const FieldDecisionSchema = v.variant('decision', [
	v.strictObject({ decision: v.literal(FIELD_DECISION.rejected) }),
	v.strictObject({
		decision: v.literal(FIELD_DECISION.edited),
		/** The reviewer's own value, as the operation input keys of that field. */
		input: v.record(v.string(), v.unknown()),
	}),
]);

export type FieldDecision = v.InferOutput<typeof FieldDecisionSchema>;

/** A field left out of `fields` applies as the agent proposed it. */
export type FieldDecisions = Partial<Record<ChangeField, FieldDecision>>;

export const ChangeRowDecisionSchema = v.variant('decision', [
	v.strictObject({
		rowId: v.pipe(v.string(), v.minLength(1)),
		decision: v.literal(CHANGE_DECISION.rejected),
	}),
	v.strictObject({
		rowId: v.pipe(v.string(), v.minLength(1)),
		decision: v.literal(CHANGE_DECISION.accepted),
		fields: v.optional(v.record(v.picklist(CHANGE_FIELDS), FieldDecisionSchema)),
	}),
]);

export type ChangeRowDecision = v.InferOutput<typeof ChangeRowDecisionSchema>;

/** Why a row's decision cannot apply; null when it can. */
export function fieldDecisionsProblem(
	operation: string,
	input: unknown,
	fields: FieldDecisions,
): string | null {
	const rowFields = changeRowFields(operation, input);
	for (const field of CHANGE_FIELDS) {
		const decision = fields[field];
		if (decision === undefined) {
			continue;
		}
		if (!rowFields.includes(field)) {
			return `field ${field} is not part of the row`;
		}
		if (
			decision.decision === FIELD_DECISION.rejected &&
			isRequiredChangeField(operation, field)
		) {
			return `field ${field} cannot be rejected on its own`;
		}
		if (decision.decision === FIELD_DECISION.edited) {
			const allowedKeys: readonly string[] = INPUT_KEYS_BY_FIELD[field];
			if (
				!isEditableChangeField(field) ||
				Object.keys(decision.input).some((key) => !allowedKeys.includes(key))
			) {
				return `field ${field} cannot take that value`;
			}
		}
	}
	return null;
}

/**
 * The input a row applies with: rejected fields dropped, edited fields replaced by the reviewer's
 * value. Null when nothing the row would change is left, e.g. an edit with every field rejected.
 */
export function effectiveChangeInput(
	operation: string,
	input: unknown,
	fields: FieldDecisions = {},
): unknown {
	const record = changeInputRecord(input);
	const rowFields = changeRowFields(operation, input);
	if (record === null || rowFields.length === 0) {
		return input;
	}
	const effective: Record<string, unknown> = { ...record };
	let keptFieldCount = 0;
	for (const field of rowFields) {
		const decision = fields[field];
		if (decision === undefined) {
			keptFieldCount += 1;
			continue;
		}
		for (const key of INPUT_KEYS_BY_FIELD[field]) {
			delete effective[key];
		}
		if (decision.decision === FIELD_DECISION.edited) {
			Object.assign(effective, decision.input);
			keptFieldCount += 1;
		}
	}
	return keptFieldCount === 0 ? null : effective;
}
