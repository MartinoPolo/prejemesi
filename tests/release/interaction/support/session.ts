import {
	devices,
	expect,
	test as base,
	type Browser,
	type BrowserContext,
	type Page,
	type PlaywrightWorkerArgs,
	type WorkerInfo,
} from '@playwright/test';
import { parseCookiesForContext, registerViaApi } from '../../../e2e/fixtures/auth-helpers.js';
import { createTestUser } from '../../../e2e/fixtures/test-data.js';
import { VIEWPORTS, type ViewportName } from '../inventory.js';
import { RUN_FIXTURE_WAIT_MS } from './run-fixture.js';
import { collectPageErrors, type PageErrorCollector } from './settled.js';
import { createTouchInput, type TouchInput } from './touch.js';

/** A worker may wait for another worker's run fixture, then build its own state on top of it. */
const WORLD_FIXTURE_TIMEOUT_MS = RUN_FIXTURE_WAIT_MS + 60_000;

export interface InteractionSession {
	viewport: ViewportName;
	context: BrowserContext;
	page: Page;
	/** Present on touch viewports, where every press goes through real touch input. */
	touch?: TouchInput;
	errors: PageErrorCollector;
}

export interface SessionOptions {
	reducedMotion?: boolean;
}

/** A signed-in browser context sized and equipped for the viewport. */
export async function openSession(
	browser: Browser,
	baseURL: string,
	cookies: readonly string[],
	viewport: ViewportName,
	{ reducedMotion = false }: SessionOptions = {},
): Promise<InteractionSession> {
	const { touch, ...size } = VIEWPORTS[viewport];
	const context = await browser.newContext({
		...(touch ? devices['Pixel 7'] : devices['Desktop Chrome']),
		viewport: size,
		baseURL,
		reducedMotion: reducedMotion ? 'reduce' : 'no-preference',
	});
	await context.addCookies(parseCookiesForContext([...cookies], baseURL));
	const page = await context.newPage();
	return {
		viewport,
		context,
		page,
		touch: touch ? await createTouchInput(page) : undefined,
		errors: collectPageErrors(page),
	};
}

export function requireTouch(session: { touch?: TouchInput }): TouchInput {
	expect(session.touch, 'touch interactions run in a touch session').toBeDefined();
	return session.touch!;
}

/** Clears focus and text selection, and moves a mouse off the content so nothing stays hovered. */
export async function releaseFocusAndPointer({ page, touch }: InteractionSession): Promise<void> {
	await page.evaluate(() => {
		document.getSelection()?.removeAllRanges();
		(document.activeElement as HTMLElement | null)?.blur();
	});
	if (touch === undefined) {
		await page.mouse.move(1, 1);
	}
}

/** Registers a fresh account and returns its session cookies. */
export async function registerUser(
	playwright: PlaywrightWorkerArgs['playwright'],
	baseURL: string,
	role: string,
): Promise<string[]> {
	const request = await playwright.request.newContext();
	try {
		return await registerViaApi(request, baseURL, createTestUser(role));
	} finally {
		await request.dispose();
	}
}

/** Runs `prepare` on a throwaway signed-in page, for building fixture data. */
export async function withSignedInPage<T>(
	browser: Browser,
	baseURL: string,
	cookies: readonly string[],
	prepare: (page: Page) => Promise<T>,
): Promise<T> {
	const context = await browser.newContext({ baseURL });
	try {
		await context.addCookies(parseCookiesForContext([...cookies], baseURL));
		return await prepare(await context.newPage());
	} finally {
		await context.close();
	}
}

/** Sessions opened on first use and reused by every later case of the worker. */
export class SessionPool {
	readonly #sessions = new Map<string, Promise<InteractionSession>>();

	/** The session stored under `key`; one key always holds sessions of one type. */
	get<Session extends InteractionSession>(
		key: string,
		open: () => Promise<Session>,
	): Promise<Session> {
		if (!this.#sessions.has(key)) {
			this.#sessions.set(key, open());
		}
		return this.#sessions.get(key) as Promise<Session>;
	}

	async closeAll(): Promise<void> {
		const opened = await Promise.allSettled(this.#sessions.values());
		this.#sessions.clear();
		await Promise.allSettled(
			opened.flatMap((result) =>
				result.status === 'fulfilled' ? [result.value.context.close()] : [],
			),
		);
	}
}

export interface WorldSetup {
	browser: Browser;
	playwright: PlaywrightWorkerArgs['playwright'];
	workerInfo: WorkerInfo;
	baseURL: string;
	sessions: SessionPool;
}

/** `test` with a worker-scoped `world`, built once per worker; its sessions close with the worker. */
export function testWithWorld<World>(createWorld: (setup: WorldSetup) => Promise<World>) {
	return base.extend<object, { world: World }>({
		world: [
			async ({ browser, playwright }, use, workerInfo) => {
				const sessions = new SessionPool();
				try {
					await use(
						await createWorld({
							browser,
							playwright,
							workerInfo,
							baseURL: workerInfo.project.use.baseURL!,
							sessions,
						}),
					);
				} finally {
					await sessions.closeAll();
				}
			},
			{ scope: 'worker', timeout: WORLD_FIXTURE_TIMEOUT_MS },
		],
	});
}
