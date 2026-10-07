// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { User, Session } from 'better-auth/minimal';
import type { DatabaseTransaction } from '$lib/server/db/index.js';
import type {
	R2Bucket,
	Hyperdrive,
	Fetcher,
	RateLimit,
	ExecutionContext,
	CacheStorage,
	IncomingRequestCfProperties,
} from '@cloudflare/workers-types';

declare global {
	// Injected by vite.config.ts at build/dev time; holds the current git branch name.
	const __GIT_BRANCH__: string;

	namespace App {
		// interface Error {}
		interface Locals {
			user?: User;
			session?: Session;
			realUser?: User;
			demoSession?: { id: string; expiresAt: Date };
			demoExpired?: boolean;
			demoDatabaseTransaction?: DatabaseTransaction;
		}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			env: {
				GIT_COMMIT_SHA?: string;
				PUBLIC_SENTRY_DSN?: string;
				HYPERDRIVE: Hyperdrive;
				R2: R2Bucket;
				ASSETS: Fetcher;
				CF_VERSION_METADATA?: { id: string; tag?: string; timestamp?: string };
				GIFT_INGESTION_RATE_LIMIT?: RateLimit;
			};
			ctx: ExecutionContext;
			caches: CacheStorage;
			cf?: IncomingRequestCfProperties;
		}
	}
}

export {};
