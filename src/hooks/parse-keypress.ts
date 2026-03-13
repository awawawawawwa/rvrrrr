import type {Key} from './types.js';

export type KeypressResult = {
	input: string;
	key: Key;
};

function defaultKey(): Key {
	return {
		upArrow: false,
		downArrow: false,
		leftArrow: false,
		rightArrow: false,
		pageDown: false,
		pageUp: false,
		return: false,
		escape: false,
		ctrl: false,
		shift: false,
		tab: false,
		backspace: false,
		delete: false,
		meta: false,
	};
}

/**
 * Parse a raw stdin data buffer into a structured key event.
 *
 * Handles:
 * - CSI sequences: ESC [ ... — arrows, page up/down, delete, shift/ctrl/meta modifiers
 * - Simple control characters: return (\r), tab (\t), escape (\x1b alone), backspace (\x7f)
 * - Ctrl+a through Ctrl+z (\x01 – \x1a)
 * - Meta prefix: ESC followed by a printable character
 * - Plain printable characters
 */
export function parseKeypress(data: Buffer): KeypressResult {
	const str = data.toString('utf8');
	const key = defaultKey();
	let input = '';

	// CSI sequence: ESC [ ...
	if (str.startsWith('\x1b[')) {
		const seq = str.slice(2); // strip ESC [

		// Parse optional parameters before the final byte
		// Format: [param1[;param2]]finalByte
		const match = /^(\d+)?(?:;(\d+))?([A-Za-z~])$/.exec(seq);

		if (match) {
			const param1 = match[1] ? parseInt(match[1], 10) : undefined;
			const param2 = match[2] ? parseInt(match[2], 10) : undefined;
			const finalByte = match[3];

			// Apply modifier from param2 (xterm modifiers: 2=shift, 3=meta, 5=ctrl, 6=ctrl+shift)
			if (param2 !== undefined) {
				const mod = param2;
				if (mod === 2 || mod === 6) key.shift = true;
				if (mod === 3 || mod === 7) key.meta = true;
				if (mod === 5 || mod === 6 || mod === 7 || mod === 8) key.ctrl = true;
			}

			if (finalByte === '~') {
				// Tilde sequences
				switch (param1) {
					case 3:
						key.delete = true;
						break;
					case 5:
						key.pageUp = true;
						break;
					case 6:
						key.pageDown = true;
						break;
					default:
						break;
				}
			} else {
				// Letter final byte — cursor keys
				switch (finalByte) {
					case 'A':
						key.upArrow = true;
						break;
					case 'B':
						key.downArrow = true;
						break;
					case 'C':
						key.rightArrow = true;
						break;
					case 'D':
						key.leftArrow = true;
						break;
					default:
						break;
				}
			}
		}

		return {input, key};
	}

	// Standalone ESC — could be plain escape or ESC + printable char (meta)
	if (str.startsWith('\x1b')) {
		const rest = str.slice(1);

		if (rest.length === 0) {
			// Plain escape key
			key.escape = true;
		} else if (rest.length === 1 && rest >= ' ') {
			// Meta + printable character
			key.meta = true;
			input = rest;
		}

		return {input, key};
	}

	// Return / Enter
	if (str === '\r' || str === '\n') {
		key.return = true;
		return {input, key};
	}

	// Tab
	if (str === '\t') {
		key.tab = true;
		return {input, key};
	}

	// Backspace (DEL character)
	if (str === '\x7f') {
		key.backspace = true;
		return {input, key};
	}

	// Ctrl+a through Ctrl+z (\x01 – \x1a)
	const charCode = str.charCodeAt(0);
	if (charCode >= 1 && charCode <= 26) {
		key.ctrl = true;
		// Map to the corresponding letter: \x01 => 'a', \x1a => 'z'
		input = String.fromCharCode(charCode + 96);
		return {input, key};
	}

	// Plain printable character (or multi-byte UTF-8)
	input = str;
	return {input, key};
}
