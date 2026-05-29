/**
 * EXAMPLE CONTEXT — Showcase Form
 *
 * Demonstrates the project's context pattern with all three reactivity
 * classes: Persisted, StateRaw, and Derived.
 *
 * Feel free to delete or replace this file when building your own app.
 */

import { getContext, setContext } from 'svelte';
import { CONTEXT_KEYS } from './context_key';
import { StateRaw } from '$lib/reactivity/state.svelte';
import { Derived } from '$lib/reactivity/derived.svelte';
import { jsonSerde, Persisted } from '$lib/reactivity/persisted.svelte';

// --- Exported types -------------------------------------------------------

export interface Interests {
	frontend: boolean;
	backend: boolean;
	devops: boolean;
}

export type ShowcaseFormContext = ReturnType<typeof createShowcaseFormContext>;

// --- Public API -----------------------------------------------------------

export function setShowcaseFormContext() {
	const context = createShowcaseFormContext();
	setContext(CONTEXT_KEYS.showcase_form, context);
	return context;
}

export function useShowcaseForm() {
	return getContext<ShowcaseFormContext>(CONTEXT_KEYS.showcase_form);
}

// --- Internal types & constants -------------------------------------------

type FrameworkValue = '' | 'sveltekit' | 'nextjs' | 'nuxt' | 'remix';
const FRAMEWORK_VALUES: readonly string[] = ['', 'sveltekit', 'nextjs', 'nuxt', 'remix'];
function isFrameworkValue(v: unknown): v is FrameworkValue {
	return typeof v === 'string' && FRAMEWORK_VALUES.includes(v);
}

type RoleValue = '' | 'admin' | 'editor' | 'viewer';
const ROLE_VALUES: readonly string[] = ['', 'admin', 'editor', 'viewer'];
function isRoleValue(v: unknown): v is RoleValue {
	return typeof v === 'string' && ROLE_VALUES.includes(v);
}

const DEFAULT_INTERESTS: Interests = { frontend: false, backend: false, devops: false };

// --- Context factory ------------------------------------------------------

function createShowcaseFormContext() {
	const framework = new Persisted<FrameworkValue>({
		key: 'showcase_framework',
		serde: jsonSerde(isFrameworkValue),
		defaultValue: '',
	});

	const role = new Persisted<RoleValue>({
		key: 'showcase_role',
		serde: jsonSerde(isRoleValue),
		defaultValue: '',
	});

	const interests = new StateRaw<Interests>(DEFAULT_INTERESTS);

	const selectionCount = new Derived(() => {
		let count = 0;
		if (framework.current !== '') {
			count++;
		}
		if (role.current !== '') {
			count++;
		}
		const i = interests.current;
		if (i.frontend) {
			count++;
		}
		if (i.backend) {
			count++;
		}
		if (i.devops) {
			count++;
		}
		return count;
	});

	return { framework, role, interests, selectionCount };
}
