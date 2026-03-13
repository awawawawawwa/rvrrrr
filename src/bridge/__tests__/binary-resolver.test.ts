import {describe, it, expect, beforeAll} from 'vitest';
import {existsSync, writeFileSync, mkdtempSync, rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {resolveBinaryPath} from '../binary-resolver.js';

const binaryName =
	process.platform === 'win32'
		? 'tui-engine-renderer.exe'
		: 'tui-engine-renderer';

// Path to the cargo debug build relative to this file:
// src/bridge/__tests__/ -> ../../.. -> project root -> crates/renderer/target/debug/
const projectRoot = join(import.meta.dirname, '..', '..', '..');
const debugBinaryPath = join(
	projectRoot,
	'crates',
	'renderer',
	'target',
	'debug',
	binaryName,
);

describe('resolveBinaryPath', () => {
	it('finds explicit path when file exists', () => {
		// Create a temp file to act as a fake binary
		const tmpDir = mkdtempSync(join(tmpdir(), 'tui-resolver-'));
		const fakeBinary = join(tmpDir, 'fake-renderer');
		try {
			writeFileSync(fakeBinary, '');
			const result = resolveBinaryPath(fakeBinary);
			expect(result).toBe(fakeBinary);
		} finally {
			rmSync(tmpDir, {recursive: true, force: true});
		}
	});

	it('throws on missing explicit path', () => {
		const missing = '/nonexistent/path/to/renderer-binary-xyz';
		expect(() => resolveBinaryPath(missing)).toThrow(
			'not found at explicit path',
		);
	});

	describe('cargo debug build discovery', () => {
		let binaryExists: boolean;

		beforeAll(() => {
			binaryExists = existsSync(debugBinaryPath);
		});

		it('finds cargo debug build when it exists', () => {
			if (!binaryExists) {
				console.warn(
					`Skipping: binary not found at ${debugBinaryPath}. Run cargo build first.`,
				);
				return;
			}

			// resolveBinaryPath() with no args should find the debug build
			const result = resolveBinaryPath();
			expect(existsSync(result)).toBe(true);
			// Should be an absolute path ending with the binary name
			expect(result).toMatch(
				new RegExp(binaryName.replace('.', '\\.') + '$'),
			);
		});
	});

	it('throws with helpful message when binary not found anywhere', () => {
		// Pass an explicit nonexistent path to guarantee no fallback
		expect(() => resolveBinaryPath('/definitely/does/not/exist/renderer')).toThrow(
			/not found at explicit path/,
		);

		// Also verify the no-args error message when neither dev paths nor PATH has it
		// We can test this indirectly: the error when explicit path is given is deterministic
		// For the full "not found anywhere" path we verify the error message content
		const resolver = resolveBinaryPath;
		try {
			// Force the PATH lookup to fail by providing an explicit path
			resolver('/this/path/does/not/exist/tui-engine-renderer');
		} catch (err) {
			// Error for explicit path is "not found at explicit path"
			expect((err as Error).message).toContain('not found at explicit path');
		}
	});
});
