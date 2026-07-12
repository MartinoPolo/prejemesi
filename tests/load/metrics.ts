/** Latency + error accounting for the load-test harness (issue #110, REQ-5). */

export interface RequestSample {
	/** Logical operation, e.g. `page:anonymous-view`, `command:reserveGift`. */
	operation: string;
	durationMs: number;
	/** HTTP status; 0 = network-level failure. */
	status: number;
	/** Cloudflare error code parsed from an error body (e.g. 1102, 1027). */
	cfErrorCode: number | null;
	/**
	 * Status of the remote-function error envelope (SvelteKit returns HTTP 200
	 * with `{type:'error', status}` for handled errors). Null for successes.
	 */
	remoteErrorStatus: number | null;
	/** True when the error is an expected, controlled outcome (e.g. reservation conflict). */
	expectedConflict: boolean;
}

export interface OperationSummary {
	operation: string;
	count: number;
	p50Ms: number;
	p95Ms: number;
	p99Ms: number;
	maxMs: number;
	errors: number;
	expectedConflicts: number;
}

export interface ErrorTotals {
	requests: number;
	networkErrors: number;
	http4xx: number;
	http5xx: number;
	cfError1102: number;
	cfError1027: number;
	cfErrorOther: number;
	remoteErrors: number;
	expectedConflicts: number;
	/** Errors that violate the acceptance criteria (excludes expected conflicts). */
	unexpectedErrors: number;
}

export function percentile(sortedDurations: readonly number[], p: number): number {
	if (sortedDurations.length === 0) {
		return 0;
	}
	const index = Math.min(
		sortedDurations.length - 1,
		Math.max(0, Math.ceil((p / 100) * sortedDurations.length) - 1),
	);
	return sortedDurations[index]!;
}

export function isSampleError(sample: RequestSample): boolean {
	return (
		sample.status === 0 ||
		sample.status >= 400 ||
		sample.cfErrorCode !== null ||
		sample.remoteErrorStatus !== null
	);
}

export class MetricsRecorder {
	readonly samples: RequestSample[] = [];

	record(sample: RequestSample): void {
		this.samples.push(sample);
	}

	summarizeByOperation(): OperationSummary[] {
		const byOperation = new Map<string, RequestSample[]>();
		for (const sample of this.samples) {
			const bucket = byOperation.get(sample.operation);
			if (bucket === undefined) {
				byOperation.set(sample.operation, [sample]);
			} else {
				bucket.push(sample);
			}
		}

		return [...byOperation.entries()]
			.map(([operation, samples]) => {
				const sorted = samples.map((s) => s.durationMs).sort((a, b) => a - b);
				return {
					operation,
					count: samples.length,
					p50Ms: percentile(sorted, 50),
					p95Ms: percentile(sorted, 95),
					p99Ms: percentile(sorted, 99),
					maxMs: sorted[sorted.length - 1] ?? 0,
					errors: samples.filter((s) => isSampleError(s) && !s.expectedConflict).length,
					expectedConflicts: samples.filter((s) => s.expectedConflict).length,
				};
			})
			.sort((a, b) => a.operation.localeCompare(b.operation));
	}

	errorTotals(): ErrorTotals {
		const totals: ErrorTotals = {
			requests: this.samples.length,
			networkErrors: 0,
			http4xx: 0,
			http5xx: 0,
			cfError1102: 0,
			cfError1027: 0,
			cfErrorOther: 0,
			remoteErrors: 0,
			expectedConflicts: 0,
			unexpectedErrors: 0,
		};

		for (const sample of this.samples) {
			if (sample.status === 0) {
				totals.networkErrors++;
			} else if (sample.status >= 500) {
				totals.http5xx++;
			} else if (sample.status >= 400) {
				totals.http4xx++;
			}

			if (sample.cfErrorCode === 1102) {
				totals.cfError1102++;
			} else if (sample.cfErrorCode === 1027) {
				totals.cfError1027++;
			} else if (sample.cfErrorCode !== null) {
				totals.cfErrorOther++;
			}

			if (sample.remoteErrorStatus !== null) {
				totals.remoteErrors++;
			}

			if (sample.expectedConflict) {
				totals.expectedConflicts++;
			} else if (isSampleError(sample)) {
				totals.unexpectedErrors++;
			}
		}

		return totals;
	}
}
