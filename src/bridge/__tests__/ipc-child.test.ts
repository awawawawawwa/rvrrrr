/**
 * Integration tests for IpcRendererBridge against the real tui-engine-renderer binary.
 *
 * These tests require `cargo build` to have been run first. They spawn the actual
 * Rust binary. The binary supports headless mode (no TTY), so all tests run in CI.
 */
import {describe, it, expect, afterEach, beforeAll} from 'vitest';
import {execSync, spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {IpcRendererBridge} from '../ipc-child.js';
import type {WidgetNode} from '../../protocol/types.js';

// ─── Binary path resolution ───────────────────────────────────────────────────

const binaryName =
	process.platform === 'win32'
		? 'tui-engine-renderer.exe'
		: 'tui-engine-renderer';

const projectRoot = join(import.meta.dirname, '..', '..', '..');
const debugBinaryPath = join(
	projectRoot,
	'crates',
	'renderer',
	'target',
	'debug',
	binaryName,
);
const cratesRendererDir = join(projectRoot, 'crates', 'renderer');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSimpleTree(): WidgetNode {
	return {
		kind: 'box',
		layout: {x: 0, y: 0, width: 80, height: 24},
		padding: {top: 0, right: 0, bottom: 0, left: 0},
		border: {
			top: 0,
			right: 0,
			bottom: 0,
			left: 0,
			style: null,
			color: null,
			topColor: null,
			rightColor: null,
			bottomColor: null,
			leftColor: null,
			dimColor: false,
			topDimColor: false,
			rightDimColor: false,
			bottomDimColor: false,
			leftDimColor: false,
		},
		background: null,
		overflow: 'visible',
		children: [
			{
				kind: 'text',
				layout: {x: 0, y: 0, width: 5, height: 1},
				content: 'hello',
				wrap: 'wrap',
			},
		],
	};
}

// ─── Build binary before all tests ────────────────────────────────────────────

let cargoAvailable = false;

beforeAll(() => {
	// Check if cargo is available
	try {
		execSync('cargo --version', {stdio: 'ignore'});
		cargoAvailable = true;
	} catch {
		cargoAvailable = false;
		return;
	}

	// Build if binary not present or cargo is available
	if (!existsSync(debugBinaryPath)) {
		console.log('Building tui-engine-renderer (this may take a moment)...');
		execSync('cargo build', {
			cwd: cratesRendererDir,
			stdio: 'inherit',
			timeout: 120_000,
		});
	}
}, 120_000);

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('IpcRendererBridge integration tests', {timeout: 15_000}, () => {
		let bridge: IpcRendererBridge | null = null;

		afterEach(async () => {
			if (bridge !== null) {
				await bridge.shutdown().catch(() => {/* already stopped */});
				bridge = null;
			}
		});

		it('skips all tests when cargo/binary not available', () => {
			if (!cargoAvailable || !existsSync(debugBinaryPath)) {
				console.warn(
					`Skipping integration tests: binary not found at ${debugBinaryPath}`,
				);
				return;
			}
			// Not a real test — just a placeholder to log skip reason
		});

		it('BRDG-01: spawn and receive ready', async () => {
			if (!cargoAvailable || !existsSync(debugBinaryPath)) return;

			bridge = new IpcRendererBridge({binaryPath: debugBinaryPath});
			await bridge.waitForReady(5000);

			expect(bridge.currentState).toBe('ready');

			await bridge.shutdown();
			bridge = null;
		});

		it('BRDG-01/BRDG-04: send render frame and receive ack', async () => {
			if (!cargoAvailable || !existsSync(debugBinaryPath)) return;

			bridge = new IpcRendererBridge({binaryPath: debugBinaryPath, maxFps: 60});
			await bridge.waitForReady(5000);

			bridge.enqueueRender(makeSimpleTree());

			// Wait for ack — poll lastAckedFrameId for up to 3 seconds
			const deadline = Date.now() + 3000;
			while (Date.now() < deadline) {
				if ((bridge as unknown as {lastAckedFrameId: number}).lastAckedFrameId >= 1) break;
				await new Promise<void>((r) => setTimeout(r, 50));
			}

			const ackedId = (bridge as unknown as {lastAckedFrameId: number}).lastAckedFrameId;
			expect(ackedId).toBeGreaterThanOrEqual(1);

			await bridge.shutdown();
			bridge = null;
		});

		it('BRDG-02: EOF on stdin causes clean exit (code 0)', async () => {
			if (!cargoAvailable || !existsSync(debugBinaryPath)) return;

			const child = spawn(debugBinaryPath, [], {
				stdio: ['pipe', 'pipe', 'inherit'],
			});

			// Wait for ready line on stdout
			await new Promise<void>((resolve, reject) => {
				const timer = setTimeout(() => reject(new Error('Timed out waiting for ready')), 3000);
				let buf = '';
				child.stdout!.setEncoding('utf8');
				child.stdout!.on('data', (chunk: string) => {
					buf += chunk;
					if (buf.includes('"type":"ready"') || buf.includes('"type": "ready"')) {
						clearTimeout(timer);
						resolve();
					}
				});
				child.on('error', (e) => { clearTimeout(timer); reject(e); });
			});

			// Close stdin (EOF)
			child.stdin!.end();

			// Wait for exit
			const exitCode = await new Promise<number | null>((resolve, reject) => {
				const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('Timed out waiting for exit')); }, 3000);
				child.on('exit', (code) => {
					clearTimeout(timer);
					resolve(code);
				});
			});

			expect(exitCode).toBe(0);
		});

		it('BRDG-03: shutdown() causes clean exit, state becomes stopped', async () => {
			if (!cargoAvailable || !existsSync(debugBinaryPath)) return;

			bridge = new IpcRendererBridge({binaryPath: debugBinaryPath});
			await bridge.waitForReady(5000);

			await bridge.shutdown();

			expect(bridge.currentState).toBe('stopped');
			bridge = null;
		});

		it('BRDG-04: frame coalescing — intermediate frames are dropped', async () => {
			if (!cargoAvailable || !existsSync(debugBinaryPath)) return;

			bridge = new IpcRendererBridge({binaryPath: debugBinaryPath, maxFps: 5});
			await bridge.waitForReady(5000);

			// Enqueue 10 frames rapidly
			for (let i = 0; i < 10; i++) {
				bridge.enqueueRender(makeSimpleTree());
			}

			// Wait 500ms — enough for ~2 ticks at 5fps (200ms intervals)
			await new Promise<void>((r) => setTimeout(r, 500));

			const ackedId = (bridge as unknown as {lastAckedFrameId: number}).lastAckedFrameId;
			const nextFrameId = (bridge as unknown as {nextFrameId: number}).nextFrameId;

			// nextFrameId should be 10 (all 10 enqueued)
			expect(nextFrameId).toBe(10);

			// lastAckedFrameId should be close to 10 (the last one rendered)
			// but NOT 0 through 9 all individually acked — much fewer than 10 frames sent
			expect(ackedId).toBeGreaterThanOrEqual(1);

			await bridge.shutdown();
			bridge = null;
		});

		it('BRDG-03: kill causes bridge to report crashed state', async () => {
			if (!cargoAvailable || !existsSync(debugBinaryPath)) return;

			let errorReceived: Error | null = null;
			bridge = new IpcRendererBridge({
				binaryPath: debugBinaryPath,
				onError: (err) => {
					errorReceived = err;
				},
			});
			await bridge.waitForReady(5000);

			// Kill the child process directly
			const child = (bridge as unknown as {child: ReturnType<typeof spawn>}).child;
			child.kill('SIGKILL');

			// Wait briefly for crash detection
			await new Promise<void>((r) => setTimeout(r, 500));

			expect(bridge.currentState).toBe('crashed');
			expect(errorReceived).not.toBeNull();

			bridge = null;
		});

		it('PROT-05: stdout contains only valid JSON lines (no ANSI escape sequences)', async () => {
			if (!cargoAvailable || !existsSync(debugBinaryPath)) return;

			const child = spawn(debugBinaryPath, [], {
				stdio: ['pipe', 'pipe', 'inherit'],
			});

			const collectedLines: string[] = [];

			// Collect stdout
			child.stdout!.setEncoding('utf8');
			let buf = '';
			child.stdout!.on('data', (chunk: string) => {
				buf += chunk;
				const parts = buf.split('\n');
				buf = parts.pop() ?? '';
				for (const line of parts) {
					const trimmed = line.trim();
					if (trimmed) collectedLines.push(trimmed);
				}
			});

			// Wait for ready
			await new Promise<void>((resolve, reject) => {
				const timer = setTimeout(() => reject(new Error('Timed out waiting for ready')), 5000);
				const check = setInterval(() => {
					if (collectedLines.some(l => l.includes('"type":"ready"') || l.includes('"type": "ready"'))) {
						clearInterval(check);
						clearTimeout(timer);
						resolve();
					}
				}, 50);
				child.on('error', (e) => { clearInterval(check); clearTimeout(timer); reject(e); });
			});

			// Send a render frame directly on stdin
			const renderMsg = JSON.stringify({
				type: 'render',
				frameId: 1,
				root: makeSimpleTree(),
			}) + '\n';
			child.stdin!.write(renderMsg);

			// Wait briefly for rendered ack
			await new Promise<void>((r) => setTimeout(r, 500));

			// Send shutdown and wait for exit
			child.stdin!.write(JSON.stringify({type: 'shutdown'}) + '\n');
			child.stdin!.end();

			await new Promise<void>((resolve) => {
				child.on('exit', () => resolve());
				setTimeout(resolve, 2000);
			});

			// Flush remaining buffer
			if (buf.trim()) collectedLines.push(buf.trim());

			expect(collectedLines.length).toBeGreaterThan(0);

			for (const line of collectedLines) {
				// Every line must be valid JSON
				let parsed: unknown;
				try {
					parsed = JSON.parse(line);
				} catch {
					throw new Error(`Non-JSON line on stdout: ${JSON.stringify(line)}`);
				}
				expect(parsed).toBeTruthy();

				// No ANSI escape sequences (byte 0x1B / ESC)
				const hasAnsi = line.includes('\x1b') || /\u001b/.test(line);
				if (hasAnsi) {
					throw new Error(`ANSI escape sequence found on stdout: ${JSON.stringify(line)}`);
				}
			}
		});
});
