import {existsSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {execSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

export function resolveBinaryPath(explicitPath?: string): string {
	// 1. Explicit path
	if (explicitPath) {
		if (!existsSync(explicitPath)) {
			throw new Error(
				`Renderer binary not found at explicit path: ${explicitPath}`,
			);
		}

		return explicitPath;
	}

	// 2. Relative to package (development: cargo build output)
	const binaryName =
		process.platform === 'win32'
			? 'tui-engine-renderer.exe'
			: 'tui-engine-renderer';
	const packageDir = dirname(fileURLToPath(import.meta.url));
	const devPaths = [
		join(
			packageDir,
			'..',
			'..',
			'crates',
			'renderer',
			'target',
			'debug',
			binaryName,
		),
		join(
			packageDir,
			'..',
			'..',
			'crates',
			'renderer',
			'target',
			'release',
			binaryName,
		),
	];
	for (const p of devPaths) {
		if (existsSync(p)) return p;
	}

	// 3. PATH lookup
	try {
		const which = process.platform === 'win32' ? 'where' : 'which';
		const result = execSync(`${which} tui-engine-renderer`, {
			encoding: 'utf8',
		}).trim();
		if (result) return result.split('\n')[0]!;
	} catch {
		/* not in PATH */
	}

	throw new Error(
		'Could not find tui-engine-renderer binary. ' +
			'Run `cargo build` in crates/renderer/ or pass binaryPath in options.',
	);
}
