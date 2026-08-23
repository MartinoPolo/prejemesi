// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { User, Session } from 'better-auth/minimal';

declare global {
	// Injected by vite.config.ts at build/dev time; holds the current git branch name.
	const __GIT_BRANCH__: string;

	namespace App {
		// interface Error {}
		interface Locals {
			user?: User;
			session?: Session;
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
			};
			ctx: ExecutionContext;
			caches: CacheStorage;
			cf?: IncomingRequestCfProperties;
		}
	}
}

export {};
