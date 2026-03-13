// @vitest-environment jsdom
import {describe, it, expect, vi} from 'vitest';
import {renderHook} from '@testing-library/react';
import React, {createElement} from 'react';
import {EventEmitter} from 'node:events';
import {StdinContext} from '../../contexts/stdin-context.js';
import type {StdinContextValue} from '../../contexts/stdin-context.js';
import {useStdin} from '../use-stdin.js';

function createMockStdinValue(): StdinContextValue {
	const emitter = new EventEmitter() as NodeJS.ReadStream;
	return {
		stdin: emitter,
		isRawModeSupported: true,
		setRawMode: vi.fn(),
		internal_exitOnCtrlC: false,
	};
}

function createWrapper(value: StdinContextValue) {
	return function Wrapper({children}: {children: React.ReactNode}) {
		return createElement(StdinContext.Provider, {value}, children);
	};
}

describe('useStdin', () => {
	it('returns stdin stream from StdinContext', () => {
		const stdinValue = createMockStdinValue();
		const {result} = renderHook(() => useStdin(), {
			wrapper: createWrapper(stdinValue),
		});
		expect(result.current.stdin).toBe(stdinValue.stdin);
	});

	it('returns isRawModeSupported from StdinContext', () => {
		const stdinValue = createMockStdinValue();
		const {result} = renderHook(() => useStdin(), {
			wrapper: createWrapper(stdinValue),
		});
		expect(result.current.isRawModeSupported).toBe(true);
	});

	it('returns setRawMode from StdinContext', () => {
		const stdinValue = createMockStdinValue();
		const {result} = renderHook(() => useStdin(), {
			wrapper: createWrapper(stdinValue),
		});
		expect(result.current.setRawMode).toBe(stdinValue.setRawMode);
	});

	it('throws when used outside StdinContext.Provider', () => {
		expect(() => {
			renderHook(() => useStdin());
		}).toThrow();
	});
});
