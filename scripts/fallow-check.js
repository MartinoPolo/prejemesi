/**
 * Wrapper for `fallow dead-code` that exits 0 when no regression is detected.
 *
 * Fallow exits with code 1 whenever issues are found, even when using
 * --fail-on-regression and the regression check passes. This script runs
 * fallow with JSON format, parses the regression result, and only exits 1
 * if a regression occurred (new issues beyond the baseline).
 */

import { execSync } from 'node:child_process';

const BASELINE = 'fallow-baselines/dead-code-regression.json';
const FALLOW_CMD = `pnpm exec fallow dead-code --fail-on-regression --regression-baseline ${BASELINE}`;

// Run fallow with JSON format to parse regression result
let jsonOutput = '';
try {
	jsonOutput = execSync(`${FALLOW_CMD} --format json --quiet`, {
		encoding: 'utf-8',
		stdio: ['pipe', 'pipe', 'pipe'],
	});
} catch (error) {
	jsonOutput = error.stdout ?? '';
}

// Parse JSON to determine regression status
let regressionExceeded = true; // Default to failure if we can't parse
try {
	const result = JSON.parse(jsonOutput);
	const reg = result.regression;

	const unusedFiles = result.unused_files ?? [];
	const unusedTypes = result.unused_types ?? [];
	const unresolvedImports = result.unresolved_imports ?? [];
	const unusedDeps = result.unused_dependencies ?? [];
	const circularDeps = result.circular_dependencies ?? [];

	const totalIssues =
		unusedFiles.length +
		unusedTypes.length +
		unresolvedImports.length +
		unusedDeps.length +
		circularDeps.length;

	if (totalIssues > 0) {
		console.log('\n── Fallow Dead Code ─────────────────────────────────────\n');

		if (unusedFiles.length > 0) {
			console.log(`  ● Unused files (${unusedFiles.length})`);
			for (const item of unusedFiles) {
				console.log(`    ${item.path}`);
			}
			console.log();
		}
		if (unusedTypes.length > 0) {
			console.log(`  ● Unused type exports (${unusedTypes.length})`);
			for (const item of unusedTypes) {
				console.log(`    ${item.path}:${item.line} ${item.export_name}`);
			}
			console.log();
		}
		if (unresolvedImports.length > 0) {
			console.log(`  ● Unresolved imports (${unresolvedImports.length})`);
			for (const item of unresolvedImports) {
				console.log(`    ${item.path}:${item.line} ${item.specifier}`);
			}
			console.log();
		}
		if (unusedDeps.length > 0) {
			console.log(`  ● Unused dependencies (${unusedDeps.length})`);
			for (const item of unusedDeps) {
				console.log(`    ${item.name ?? item.package ?? item}`);
			}
			console.log();
		}
		if (circularDeps.length > 0) {
			console.log(`  ● Circular dependencies (${circularDeps.length})`);
			for (const item of circularDeps) {
				console.log(`    ${Array.isArray(item) ? item.join(' → ') : item}`);
			}
			console.log();
		}
	}

	if (reg) {
		regressionExceeded = reg.exceeded;
		const statusLabel = reg.exceeded ? 'REGRESSION DETECTED' : 'passed';
		const deltaStr = `${reg.delta >= 0 ? '+' : ''}${reg.delta}`;
		console.log(
			`Regression check ${statusLabel}: ${reg.current_total} issues (baseline: ${reg.baseline_total}, delta: ${deltaStr})`,
		);
	}
} catch {
	console.error('fallow: failed to parse JSON output');
	if (jsonOutput) {
		console.error(jsonOutput);
	}
	process.exit(1);
}

process.exit(regressionExceeded ? 1 : 0);
