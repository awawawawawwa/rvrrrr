import {existsSync, chmodSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {execSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

export const PLATFORM_MAP: Record<string, string> = {
	'linux-x64-glibc': 'linux-x64-gnu',
	'linux-x64-musl': 'linux-x64-musl',
	'linux-arm64': 'linux-arm64-gnu',
	'darwin-x64': 'darwin-x64',
	'darwin-arm64': 'darwin-arm64',
	'win32-x64': 'win32-x64-msvc',
	'win32-arm64': 'win32-arm64-msvc',
};

export function getCurrentPlatformSuffix(): string | null {
	const {platform, arch} = process;

	if (platform === 'linux') {
		if (arch === 'x64') {
			const isMusl = existsSync('/lib/ld-musl-x86_64.so.1');
			const libc = isMusl ? 'musl' : 'glibc';
			return PLATFORM_MAP[`linux-x64-${libc}`] ?? null;
		}

		if (arch === 'arm64') return PLATFORM_MAP['linux-arm64'] ?? null;
	}

	return PLATFORM_MAP[`${platform}-${arch}`] ?? null;
}

// Alias for external consumers
export const getPlatformPackageName = getCurrentPlatformSuffix;

export function resolveFromOptionalDependencies(importMetaUrl: string): string | null {
	const suffix = getCurrentPlatformSuffix();
	if (!suffix) return null;

	const pkgName = `@rvrrrr/renderer-${suffix}`;
	const binaryName =
		process.platform === 'win32' ? 'rvrrrr-renderer.exe' : 'rvrrrr-renderer';

	const require = createRequire(importMetaUrl);
	try {
		const pkgJsonPath = require.resolve(`${pkgName}/package.json`);
		const pkgDir = join(pkgJsonPath, '..');
		const binaryPath = join(pkgDir, binaryName);
		if (existsSync(binaryPath)) {
			// Ensure executable bit is set (npm strips permissions on install)
			try {
				chmodSync(binaryPath, 0o755);
			} catch {
				// May fail on Windows or read-only fs — non-fatal
			}

			return binaryPath;
		}
	} catch {
		// Package not installed — wrong platform or --ignore-optional was used
	}

	return null;
}

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

	// 2. optionalDependencies lookup (npm-installed platform package)
	const optDepsPath = resolveFromOptionalDependencies(import.meta.url);
	if (optDepsPath) return optDepsPath;

	// 3. Relative to package (development: cargo build output)
	const binaryName =
		process.platform === 'win32'
			? 'rvrrrr-renderer.exe'
			: 'rvrrrr-renderer';
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

	// 4. PATH lookup
	try {
		const which = process.platform === 'win32' ? 'where' : 'which';
		const result = execSync(`${which} rvrrrr-renderer`, {
			encoding: 'utf8',
		}).trim();
		if (result) return result.split('\n')[0]!;
	} catch {
		/* not in PATH */
	}

	// 5. Not found anywhere
	throw new Error(
		'No prebuilt binary for your platform. Run: cargo install rvrrrr-renderer',
	);
}
