import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import React from 'react';
import type {Instance} from '../types.js';

// Mock the bridge so tests don't spawn a real Rust binary
vi.mock('../../bridge/ipc-child.js', () => {
	const mockBridge = {
		waitForReady: vi.fn(() => Promise.resolve()),
		enqueueRender: vi.fn(),
		sendResize: vi.fn(),
		shutdown: vi.fn(() => Promise.resolve()),
	};

	return {
		IpcRendererBridge: vi.fn(() => mockBridge),
	};
});

// Capture the mock bridge instance for assertions
let bridgeMock: {
	waitForReady: ReturnType<typeof vi.fn>;
	enqueueRender: ReturnType<typeof vi.fn>;
	sendResize: ReturnType<typeof vi.fn>;
	shutdown: ReturnType<typeof vi.fn>;
};

beforeEach(async () => {
	vi.clearAllMocks();
	const {IpcRendererBridge} = await import('../../bridge/ipc-child.js');
	// Re-import to get fresh mock reference
	const MockCtor = IpcRendererBridge as unknown as ReturnType<typeof vi.fn>;
	MockCtor.mockImplementation(() => {
		bridgeMock = {
			waitForReady: vi.fn(() => Promise.resolve()),
			enqueueRender: vi.fn(),
			sendResize: vi.fn(),
			shutdown: vi.fn(() => Promise.resolve()),
		};
		return bridgeMock;
	});
});

// Helper: create a mock stdout WriteStream
function makeMockStdout() {
	const listeners: Record<string, Array<(...args: unknown[]) => void>> = {};
	return {
		write: vi.fn(),
		columns: 80,
		rows: 24,
		on(event: string, handler: (...args: unknown[]) => void) {
			listeners[event] ??= [];
			listeners[event]!.push(handler);
			return this;
		},
		off(event: string, handler: (...args: unknown[]) => void) {
			if (listeners[event]) {
				listeners[event] = listeners[event]!.filter((h) => h !== handler);
			}

			return this;
		},
		emit(event: string, ...args: unknown[]) {
			listeners[event]?.forEach((h) => h(...args));
		},
	};
}

// Helper: create a mock stdin ReadStream
function makeMockStdin() {
	const listeners: Record<string, Array<(...args: unknown[]) => void>> = {};
	return {
		setRawMode: vi.fn(),
		on(event: string, handler: (...args: unknown[]) => void) {
			listeners[event] ??= [];
			listeners[event]!.push(handler);
			return this;
		},
		off(event: string, handler: (...args: unknown[]) => void) {
			if (listeners[event]) {
				listeners[event] = listeners[event]!.filter((h) => h !== handler);
			}

			return this;
		},
		emit(event: string, ...args: unknown[]) {
			listeners[event]?.forEach((h) => h(...args));
		},
	};
}

describe('render()', () => {
	let instance: Instance;
	let mockStdout: ReturnType<typeof makeMockStdout>;
	let mockStdin: ReturnType<typeof makeMockStdin>;

	beforeEach(async () => {
		mockStdout = makeMockStdout();
		mockStdin = makeMockStdin();
	});

	afterEach(() => {
		// Always unmount to clean up listeners
		instance?.unmount();
	});

	it('returns an Instance with all four methods', async () => {
		const {render} = await import('../render.js');
		instance = render(React.createElement('div'), {
			stdout: mockStdout as unknown as NodeJS.WriteStream,
			stdin: mockStdin as unknown as NodeJS.ReadStream,
		});

		expect(typeof instance.rerender).toBe('function');
		expect(typeof instance.unmount).toBe('function');
		expect(typeof instance.waitUntilExit).toBe('function');
		expect(typeof instance.clear).toBe('function');
	});

	it('waitUntilExit() returns a Promise', async () => {
		const {render} = await import('../render.js');
		instance = render(React.createElement('div'), {
			stdout: mockStdout as unknown as NodeJS.WriteStream,
			stdin: mockStdin as unknown as NodeJS.ReadStream,
		});

		const p = instance.waitUntilExit();
		expect(p).toBeInstanceOf(Promise);
	});

	it('unmount() calls bridge.shutdown and resolves waitUntilExit', async () => {
		const {render} = await import('../render.js');
		instance = render(React.createElement('div'), {
			stdout: mockStdout as unknown as NodeJS.WriteStream,
			stdin: mockStdin as unknown as NodeJS.ReadStream,
		});

		const exitPromise = instance.waitUntilExit();
		instance.unmount();

		await expect(exitPromise).resolves.toBeUndefined();
		expect(bridgeMock.shutdown).toHaveBeenCalledTimes(1);
	});

	it('clear() writes ANSI clear sequence to stdout', async () => {
		const {render} = await import('../render.js');
		instance = render(React.createElement('div'), {
			stdout: mockStdout as unknown as NodeJS.WriteStream,
			stdin: mockStdin as unknown as NodeJS.ReadStream,
		});

		instance.clear();
		expect(mockStdout.write).toHaveBeenCalled();
		// The written content should contain an ESC character (ANSI escape)
		const written = mockStdout.write.mock.calls.map((c) => c[0]).join('');
		expect(written).toContain('\x1b');
	});

	it('rerender() does not throw', async () => {
		const {render} = await import('../render.js');
		instance = render(React.createElement('div'), {
			stdout: mockStdout as unknown as NodeJS.WriteStream,
			stdin: mockStdin as unknown as NodeJS.ReadStream,
		});

		expect(() => {
			instance.rerender(React.createElement('span'));
		}).not.toThrow();
	});

	it('resize event on stdout triggers sendResize on the bridge', async () => {
		const {render} = await import('../render.js');
		instance = render(React.createElement('div'), {
			stdout: mockStdout as unknown as NodeJS.WriteStream,
			stdin: mockStdin as unknown as NodeJS.ReadStream,
		});

		// Simulate terminal resize
		mockStdout.columns = 120;
		mockStdout.rows = 40;
		mockStdout.emit('resize');

		// sendResize should have been called with updated dimensions
		expect(bridgeMock.sendResize).toHaveBeenCalledWith(120, 40);
	});

	it('resize event triggers onComputeLayout and enqueueRender', async () => {
		const {render} = await import('../render.js');
		instance = render(React.createElement('div'), {
			stdout: mockStdout as unknown as NodeJS.WriteStream,
			stdin: mockStdin as unknown as NodeJS.ReadStream,
		});

		const callsBefore = bridgeMock.enqueueRender.mock.calls.length;
		mockStdout.emit('resize');

		// enqueueRender should be called again after resize
		expect(bridgeMock.enqueueRender.mock.calls.length).toBeGreaterThan(
			callsBefore,
		);
	});

	it('unmount() removes the resize listener', async () => {
		const {render} = await import('../render.js');
		instance = render(React.createElement('div'), {
			stdout: mockStdout as unknown as NodeJS.WriteStream,
			stdin: mockStdin as unknown as NodeJS.ReadStream,
		});

		instance.unmount();
		const callsAfterUnmount = bridgeMock.sendResize.mock.calls.length;

		// Fire resize after unmount — should NOT call sendResize again
		mockStdout.emit('resize');
		expect(bridgeMock.sendResize.mock.calls.length).toBe(callsAfterUnmount);
	});
});
