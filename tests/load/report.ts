/** Report generation (REQ-5/AC-5): JSON + markdown per run. */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ErrorTotals, OperationSummary } from './metrics.js';
import type { ContentionOutcome } from './scenarios.js';
import type { OverReservedGift } from './db.js';

export interface LoadTestReport {
	profile: string;
	target: string;
	startedAt: string;
	durationSeconds: number;
	virtualUsers: number;
	/** Every request the harness issued hits the Worker (no static assets fetched). */
	dynamicRequestCount: number;
	operations: OperationSummary[];
	errors: ErrorTotals;
	databaseStatements: {
		delta: number | null;
		note: string;
	};
	reservationIntegrity: {
		checked: boolean;
		overReservedGifts: OverReservedGift[];
		contention: (ContentionOutcome & { activeReservationsInDb: number | null }) | null;
	};
	acceptance: {
		zeroHttp5xx: boolean;
		zeroWorkerLimitErrors: boolean;
		zeroUnexpectedErrors: boolean;
		zeroOverReservation: boolean;
		contentionExactlyOneWinner: boolean | null;
		passed: boolean;
	};
}

function formatMs(value: number): string {
	return `${value.toFixed(1)} ms`;
}

export function renderMarkdown(report: LoadTestReport): string {
	const lines: string[] = [
		`# Load test report — ${report.profile}`,
		'',
		`- Target: ${report.target}`,
		`- Started: ${report.startedAt}`,
		`- Duration: ${report.durationSeconds.toFixed(1)} s`,
		`- Virtual users: ${String(report.virtualUsers)}`,
		`- Dynamic requests: ${String(report.dynamicRequestCount)}`,
		`- DB statements executed: ${report.databaseStatements.delta === null ? `n/a (${report.databaseStatements.note})` : String(report.databaseStatements.delta)}`,
		'',
		'## Latency percentiles',
		'',
		'| Operation | Count | p50 | p95 | p99 | Max | Errors | Expected conflicts |',
		'| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
		...report.operations.map(
			(op) =>
				`| ${op.operation} | ${String(op.count)} | ${formatMs(op.p50Ms)} | ${formatMs(op.p95Ms)} | ${formatMs(op.p99Ms)} | ${formatMs(op.maxMs)} | ${String(op.errors)} | ${String(op.expectedConflicts)} |`,
		),
		'',
		'## Errors',
		'',
		`- Network failures: ${String(report.errors.networkErrors)}`,
		`- HTTP 4xx: ${String(report.errors.http4xx)}`,
		`- HTTP 5xx: ${String(report.errors.http5xx)}`,
		`- Worker limit 1102 (resources exceeded): ${String(report.errors.cfError1102)}`,
		`- Worker limit 1027 (free-tier daily limit): ${String(report.errors.cfError1027)}`,
		`- Other Cloudflare error codes: ${String(report.errors.cfErrorOther)}`,
		`- Remote-function errors: ${String(report.errors.remoteErrors)} (of which expected conflicts: ${String(report.errors.expectedConflicts)})`,
		'',
		'## Reservation integrity',
		'',
	];

	if (!report.reservationIntegrity.checked) {
		lines.push('- Skipped (no database access for this run).');
	} else {
		lines.push(
			`- Over-reserved gifts: ${String(report.reservationIntegrity.overReservedGifts.length)}`,
		);
		for (const overReserved of report.reservationIntegrity.overReservedGifts) {
			lines.push(
				`  - ${overReserved.giftId}: reserved ${String(overReserved.reservedQuantity)} of ${String(overReserved.maxQuantity)}`,
			);
		}
	}

	const contention = report.reservationIntegrity.contention;
	if (contention !== null) {
		lines.push(
			`- Contention: ${String(contention.successes.length)} winner(s), ${String(contention.conflicts)} controlled conflicts, ${String(contention.unexpectedFailures)} unexpected failures` +
				(contention.activeReservationsInDb === null
					? ''
					: `, ${String(contention.activeReservationsInDb)} active reservation(s) in DB`),
		);
	}

	lines.push(
		'',
		'## Acceptance',
		'',
		`- Zero HTTP 5xx: ${report.acceptance.zeroHttp5xx ? '✅' : '❌'}`,
		`- Zero Worker limit errors (1102/1027): ${report.acceptance.zeroWorkerLimitErrors ? '✅' : '❌'}`,
		`- Zero unexpected errors: ${report.acceptance.zeroUnexpectedErrors ? '✅' : '❌'}`,
		`- Zero over-reservation: ${report.acceptance.zeroOverReservation ? '✅' : '❌'}`,
		...(report.acceptance.contentionExactlyOneWinner === null
			? []
			: [
					`- Contention has exactly one winner: ${report.acceptance.contentionExactlyOneWinner ? '✅' : '❌'}`,
				]),
		'',
		`**Result: ${report.acceptance.passed ? 'PASSED' : 'FAILED'}**`,
		'',
	);

	return lines.join('\n');
}

export function writeReportFiles(reportsDir: string, report: LoadTestReport): string {
	mkdirSync(reportsDir, { recursive: true });
	const stamp = report.startedAt.replaceAll(':', '-').replace(/\..*$/, '');
	const baseName = `${stamp}-${report.profile}`;
	writeFileSync(join(reportsDir, `${baseName}.json`), JSON.stringify(report, null, '\t'));
	const markdownPath = join(reportsDir, `${baseName}.md`);
	writeFileSync(markdownPath, renderMarkdown(report));
	return markdownPath;
}
