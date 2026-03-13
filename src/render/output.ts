import stringWidth from 'string-width';

export type WriteOptions = {
	transformers?: Array<(s: string) => string>;
};

/**
 * JS-side character grid renderer. Paints text at (x, y) positions and
 * produces a final string output for renderToString and Static.
 */
export class Output {
	// Map<row, Map<col, char>>
	private readonly grid: Map<number, Map<number, string>> = new Map();

	/**
	 * Write text starting at column x, row y. ANSI escape codes are
	 * preserved in the output but occupy zero display columns.
	 */
	write(x: number, y: number, text: string, options?: WriteOptions): void {
		let finalText = text;

		if (options?.transformers && options.transformers.length > 0) {
			for (const transformer of options.transformers) {
				finalText = transformer(finalText);
			}
		}

		if (!this.grid.has(y)) {
			this.grid.set(y, new Map());
		}

		// Write the full (potentially ANSI-escaped) text as a block starting at x.
		// We track display width to advance the column correctly.
		const row = this.grid.get(y)!;

		// Split text into printable segments and ANSI escape segments
		// ANSI escape pattern: ESC [ ... m  or other control sequences
		// We store the entire string starting at x as a single "cell" entry
		// and advance x by the display width of the visible characters.
		let col = x;
		let i = 0;

		while (i < finalText.length) {
			// Detect ANSI escape sequence: ESC followed by [ or other chars
			if (finalText.charCodeAt(i) === 0x1b) {
				// Find the end of the escape sequence
				let j = i + 1;
				if (j < finalText.length && finalText[j] === '[') {
					// CSI sequence: ESC [ ... final byte (0x40–0x7e)
					j++;
					while (j < finalText.length && (finalText.charCodeAt(j) < 0x40 || finalText.charCodeAt(j) > 0x7e)) {
						j++;
					}
					if (j < finalText.length) j++; // include final byte
				} else if (j < finalText.length) {
					// Other escape sequence: ESC + single char
					j++;
				}

				// Store the entire escape sequence at the current column
				// (zero display width, so we don't advance col)
				const existing = row.get(col) ?? '';
				row.set(col, existing + finalText.slice(i, j));
				i = j;
				continue;
			}

			// Regular character (potentially multi-byte/wide)
			// Extract one grapheme cluster (simple: one char for ASCII, handle surrogate pairs)
			let charEnd = i + 1;
			if (
				finalText.charCodeAt(i) >= 0xd800 &&
				finalText.charCodeAt(i) <= 0xdbff &&
				charEnd < finalText.length
			) {
				// Surrogate pair
				charEnd++;
			}

			const ch = finalText.slice(i, charEnd);
			const w = stringWidth(ch);

			row.set(col, ch);
			col += Math.max(1, w);
			i = charEnd;
		}
	}

	/**
	 * Build the final output string. Rows are joined by '\n'.
	 * Trailing empty rows are trimmed.
	 */
	get(width: number, height: number): string {
		const lines: string[] = [];

		for (let row = 0; row < height; row++) {
			const rowMap = this.grid.get(row);
			if (!rowMap) {
				lines.push('');
				continue;
			}

			let line = '';
			let currentCol = 0;
			const cols = [...rowMap.keys()].sort((a, b) => a - b);

			for (const col of cols) {
				if (col > width) break;

				// Fill gap with spaces
				while (currentCol < col) {
					line += ' ';
					currentCol++;
				}

				const ch = rowMap.get(col)!;
				line += ch;

				// Advance by display width (ANSI escapes have zero width)
				const displayW = stringWidth(ch);
				currentCol += displayW === 0 ? 0 : displayW;
			}

			lines.push(line);
		}

		// Trim trailing empty rows
		while (lines.length > 0 && lines[lines.length - 1]!.trim() === '') {
			lines.pop();
		}

		return lines.join('\n');
	}
}
