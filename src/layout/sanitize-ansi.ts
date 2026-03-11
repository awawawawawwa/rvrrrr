import {hasAnsiControlCharacters, tokenizeAnsi} from '../util/ansi-tokenizer.js';

const sgrParametersRegex = /^[\d:;]*$/;

const sanitizeAnsi = (text: string): string => {
	if (!hasAnsiControlCharacters(text)) {
		return text;
	}

	let output = '';

	for (const token of tokenizeAnsi(text)) {
		if (token.type === 'text' || token.type === 'osc') {
			output += token.value;
			continue;
		}

		if (
			token.type === 'csi' &&
			token.finalCharacter === 'm' &&
			token.intermediateString === '' &&
			sgrParametersRegex.test(token.parameterString)
		) {
			output += token.value;
		}
	}

	return output;
};

export default sanitizeAnsi;
