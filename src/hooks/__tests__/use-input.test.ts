import {describe, it, expect, vi, beforeEach} from 'vitest';
import {renderHook, act} from '@testing-library/react';
import React, {createElement} from 'react';
import {EventEmitter} from 'node:events';
import {StdinContext} from '../../contexts/stdin-context.js';
import type {StdinContextValue} from '../../contexts/stdin-context.js';
import {useInput} from '../use-input.js';

function createMockStdin() {
	const emitter = new EventEmitter() as NodeJS.ReadStream;
	(emitter as any).setRawMode = vi.fn();
	return emitter;
}

function createWrapper(stdinValue: StdinContextValue) {
	return function Wrapper({children}: {children: React.ReactNode}) {
		return createElement(StdinContext.Provider, {value: stdinValue}, children);
	};
}

describe('useInput', () => {
	let mockStdin: NodeJS.ReadStream;
	let mockSetRawMode: ReturnType<typeof vi.fn>;
	let stdinValue: StdinContextValue;

	beforeEach(() => {
		mockStdin = createMockStdin();
		mockSetRawMode = vi.fn();
		stdinValue = {
			stdin: mockStdin,
			isRawModeSupported: true,
			setRawMode: mockSetRawMode,
			internal_exitOnCtrlC: false,
		};
	});

	it('calls setRawMode(true) on mount', () => {
		renderHook(() => useInput(() => {}), {
			wrapper: createWrapper(stdinValue),
		});
		expect(mockSetRawMode).toHaveBeenCalledWith(true);
	});

	it('calls setRawMode(false) on unmount', () => {
		const {unmount} = renderHook(() => useInput(() => {}), {
			wrapper: createWrapper(stdinValue),
		});
		unmount();
		expect(mockSetRawMode).toHaveBeenCalledWith(false);
	});

	it('calls handler with parsed key event when stdin emits data', () => {
		const handler = vi.fn();
		renderHook(() => useInput(handler), {
			wrapper: createWrapper(stdinValue),
		});

		act(() => {
			mockStdin.emit('data', Buffer.from('a'));
		});

		expect(handler).toHaveBeenCalledOnce();
		const [input, key] = handler.mock.calls[0]!;
		expect(input).toBe('a');
		expect(key.ctrl).toBe(false);
	});

	it('calls handler with parsed arrow key when stdin emits CSI sequence', () => {
		const handler = vi.fn();
		renderHook(() => useInput(handler), {
			wrapper: createWrapper(stdinValue),
		});

		act(() => {
			mockStdin.emit('data', Buffer.from('\x1b[A'));
		});

		expect(handler).toHaveBeenCalledOnce();
		const [, key] = handler.mock.calls[0]!;
		expect(key.upArrow).toBe(true);
	});

	it('does NOT call handler when isActive is false', () => {
		const handler = vi.fn();
		renderHook(() => useInput(handler, {isActive: false}), {
			wrapper: createWrapper(stdinValue),
		});

		act(() => {
			mockStdin.emit('data', Buffer.from('a'));
		});

		expect(handler).not.toHaveBeenCalled();
	});

	it('does NOT call setRawMode when isActive is false', () => {
		renderHook(() => useInput(() => {}, {isActive: false}), {
			wrapper: createWrapper(stdinValue),
		});
		expect(mockSetRawMode).not.toHaveBeenCalled();
	});

	it('uses latest handler reference without re-subscribing', () => {
		let callCount = 0;
		const handler1 = vi.fn(() => {
			callCount++;
		});
		const handler2 = vi.fn(() => {
			callCount += 10;
		});

		const {rerender} = renderHook(
			({handler}: {handler: (input: string, key: any) => void}) =>
				useInput(handler),
			{
				initialProps: {handler: handler1},
				wrapper: createWrapper(stdinValue),
			},
		);

		rerender({handler: handler2});

		act(() => {
			mockStdin.emit('data', Buffer.from('a'));
		});

		// handler2 should have been called (latest ref), not handler1
		expect(callCount).toBe(10);
		expect(handler1).not.toHaveBeenCalled();
		expect(handler2).toHaveBeenCalledOnce();
	});
});
