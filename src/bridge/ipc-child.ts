import {spawn, type ChildProcess} from 'node:child_process';
import type {WidgetNode} from '../protocol/types.js';
import {resolveBinaryPath} from './binary-resolver.js';
import type {
	BridgeOptions,
	BridgeState,
	RendererMessageOut,
	RenderMessageIn,
} from './types.js';

export class IpcRendererBridge {
	private child: ChildProcess;
	private state: BridgeState = 'starting';
	private nextFrameId = 0;
	private lastSentFrameId = -1;
	private lastAckedFrameId = -1;
	private lastSentTime = 0;
	private pendingFrame: RenderMessageIn | null = null;
	private drainPending = false;
	private sendInterval: ReturnType<typeof setInterval> | null = null;
	private killTimeout: ReturnType<typeof setTimeout> | null = null;
	private shutdownResolve: (() => void) | null = null;
	private readonly options: BridgeOptions;
	private readonly maxFps: number;

	// Signal handler references for cleanup
	private readonly sigintHandler: () => void;
	private readonly sigtermHandler: () => void;
	private readonly uncaughtExceptionHandler: (err: Error) => void;

	// Ready promise machinery
	private readyResolve: (() => void) | null = null;
	private readyReject: ((err: Error) => void) | null = null;
	private startupTimeoutHandle: ReturnType<typeof setTimeout> | null = null;

	constructor(options: BridgeOptions = {}) {
		this.options = options;
		this.maxFps = options.maxFps ?? 30;

		const binaryPath = resolveBinaryPath(options.binaryPath);
		this.child = spawn(binaryPath, [], {
			stdio: ['pipe', 'pipe', 'inherit'],
		});

		this.setupStdoutReader();
		this.setupChildExitHandler();
		this.setupSendLoop();

		// Register signal handlers
		this.sigintHandler = () => {
			void this.shutdown();
		};
		this.sigtermHandler = () => {
			void this.shutdown();
		};
		this.uncaughtExceptionHandler = (err: Error) => {
			void this.shutdown().finally(() => {
				// Re-throw after cleanup completes
				process.stderr.write(`Uncaught exception: ${err.message}\n`);
				process.exit(1);
			});
		};

		process.on('SIGINT', this.sigintHandler);
		process.on('SIGTERM', this.sigtermHandler);
		process.on('uncaughtException', this.uncaughtExceptionHandler);
	}

	/**
	 * Wait for the renderer to signal it's ready.
	 * Resolves when {type: "ready"} is received, rejects on timeout or crash.
	 */
	waitForReady(timeoutMs = 10_000): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			if (this.state === 'ready' || this.state === 'running') {
				resolve();
				return;
			}

			if (this.state === 'crashed' || this.state === 'stopped') {
				reject(new Error('Renderer process exited before becoming ready'));
				return;
			}

			this.readyResolve = resolve;
			this.readyReject = reject;

			this.startupTimeoutHandle = setTimeout(() => {
				this.readyReject?.(
					new Error(`Renderer did not become ready within ${timeoutMs}ms`),
				);
				this.readyResolve = null;
				this.readyReject = null;
			}, timeoutMs);
		});
	}

	private setupStdoutReader(): void {
		const stdout = this.child.stdout!;
		stdout.setEncoding('utf8');

		let buffer = '';

		stdout.on('data', (chunk: string) => {
			buffer += chunk;
			const lines = buffer.split('\n');
			// Last element is incomplete line (possibly empty string)
			buffer = lines.pop() ?? '';

			for (const line of lines) {
				const trimmed = line.trim();
				if (!trimmed) continue;

				let msg: RendererMessageOut;
				try {
					msg = JSON.parse(trimmed) as RendererMessageOut;
				} catch {
					// Malformed JSON from renderer — ignore
					continue;
				}

				this.handleRendererMessage(msg);
			}
		});
	}

	private handleRendererMessage(msg: RendererMessageOut): void {
		switch (msg.type) {
			case 'ready': {
				this.state = 'ready';
				if (this.startupTimeoutHandle !== null) {
					clearTimeout(this.startupTimeoutHandle);
					this.startupTimeoutHandle = null;
				}

				this.readyResolve?.();
				this.readyResolve = null;
				this.readyReject = null;
				break;
			}

			case 'rendered': {
				this.lastAckedFrameId = msg.frameId;
				this.drainPending = false;
				break;
			}

			case 'input': {
				this.options.onInput?.(msg.event);
				break;
			}

			case 'error': {
				this.options.onError?.(new Error(msg.message));
				break;
			}

			case 'fatal': {
				this.options.onError?.(
					new Error(`Fatal renderer error: ${msg.message}`),
				);
				// Child is expected to exit soon; crash handler will take over
				break;
			}
		}
	}

	private setupChildExitHandler(): void {
		this.child.on('exit', (code, signal) => {
			if (this.state !== 'stopping') {
				// Unexpected exit — crash
				this.state = 'crashed';
				const reason =
					signal != null
						? `killed by signal ${signal}`
						: `exited with code ${code ?? 'unknown'}`;
				const err = new Error(`Renderer process crashed: ${reason}`);
				this.options.onError?.(err);

				// Reject ready promise if still waiting
				if (this.readyReject) {
					this.readyReject(err);
					this.readyResolve = null;
					this.readyReject = null;
				}
			} else {
				this.state = 'stopped';
			}

			// Resolve shutdown promise if any
			this.shutdownResolve?.();
			this.shutdownResolve = null;

			// Clear kill timeout
			if (this.killTimeout !== null) {
				clearTimeout(this.killTimeout);
				this.killTimeout = null;
			}
		});

		this.child.on('error', (err: Error) => {
			this.state = 'crashed';
			this.options.onError?.(
				new Error(`Failed to spawn renderer: ${err.message}`),
			);
			if (this.readyReject) {
				this.readyReject(err);
				this.readyResolve = null;
				this.readyReject = null;
			}
		});
	}

	private setupSendLoop(): void {
		const intervalMs = Math.floor(1000 / this.maxFps);

		this.sendInterval = setInterval(() => {
			if (this.pendingFrame === null) return;
			if (this.drainPending) return;

			const stdin = this.child.stdin;
			if (!stdin || !stdin.writable) return;

			// Backpressure: only send if last frame was acked or safety timeout elapsed
			const ackCurrent = this.lastAckedFrameId >= this.lastSentFrameId;
			const safetyTimeout =
				this.lastSentFrameId < 0 ||
				Date.now() - this.lastSentTime >= 100;

			if (!ackCurrent && !safetyTimeout) return;

			const frame = this.pendingFrame;
			this.pendingFrame = null;

			const encoded = JSON.stringify(frame) + '\n';
			const ok = stdin.write(encoded);

			this.lastSentFrameId = frame.frameId;
			this.lastSentTime = Date.now();

			if (!ok) {
				this.drainPending = true;
				stdin.once('drain', () => {
					this.drainPending = false;
				});
			}
		}, intervalMs);

		// Don't keep Node.js alive just for this interval
		if (this.sendInterval.unref) {
			this.sendInterval.unref();
		}
	}

	/**
	 * Enqueue a render frame. Newer frames overwrite pending ones (single-slot coalescing).
	 */
	enqueueRender(root: WidgetNode): void {
		if (this.state !== 'ready' && this.state !== 'running') return;

		if (this.state === 'ready') {
			this.state = 'running';
		}

		this.nextFrameId++;
		this.pendingFrame = {
			type: 'render',
			frameId: this.nextFrameId,
			root,
		};
	}

	/**
	 * Send a resize notification immediately (not subject to frame throttling).
	 */
	sendResize(width: number, height: number): void {
		const stdin = this.child.stdin;
		if (!stdin || !stdin.writable) return;

		stdin.write(JSON.stringify({type: 'resize', width, height}) + '\n');
	}

	/**
	 * Gracefully shut down the renderer. Sends shutdown message, closes stdin,
	 * and kills the process if it doesn't exit within 2 seconds.
	 */
	shutdown(): Promise<void> {
		if (this.state === 'stopping' || this.state === 'stopped') {
			return Promise.resolve();
		}

		this.state = 'stopping';

		// Stop the send loop
		if (this.sendInterval !== null) {
			clearInterval(this.sendInterval);
			this.sendInterval = null;
		}

		// Remove signal handlers to avoid leaking listeners
		process.off('SIGINT', this.sigintHandler);
		process.off('SIGTERM', this.sigtermHandler);
		process.off('uncaughtException', this.uncaughtExceptionHandler);

		const stdin = this.child.stdin;
		if (stdin && stdin.writable) {
			try {
				stdin.write(JSON.stringify({type: 'shutdown'}) + '\n');
				stdin.end();
			} catch {
				// stdin may already be closed
			}
		}

		return new Promise<void>((resolve) => {
			// If already exited by the time we get here
			if (this.state === 'stopped') {
				resolve();
				return;
			}

			this.shutdownResolve = resolve;

			// Kill timeout — 2 seconds
			this.killTimeout = setTimeout(() => {
				this.child.kill('SIGKILL');
				this.killTimeout = null;
			}, 2000);
		});
	}

	/**
	 * Alias for shutdown() — implements React-style cleanup interface.
	 */
	destroy(): Promise<void> {
		return this.shutdown();
	}

	get currentState(): BridgeState {
		return this.state;
	}
}
