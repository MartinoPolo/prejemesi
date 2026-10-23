import * as v from 'valibot';
import { guardedQueryWithArgs } from '$lib/server/remote.js';
import { userInterfaceActor } from '$lib/server/operations/actor.js';
import { executeOperation } from '$lib/server/operations/runner.js';
import { readGiftCategoriesOperation } from '$lib/server/operations/gift_grouping_operations.js';

export const getGiftCategories = guardedQueryWithArgs(v.string(), ({ user }, wishlistId) =>
	executeOperation(userInterfaceActor(user), readGiftCategoriesOperation, { wishlistId }),
);
