import {type ErrorMessage} from './types.js';

export const ErrorCodes = {
	SERIALIZE_FAILED: 'SERIALIZE_FAILED',
	INVALID_TREE: 'INVALID_TREE',
	YOGA_ERROR: 'YOGA_ERROR',
} as const;

export function createErrorMessage(
	message: string,
	code?: string,
): ErrorMessage {
	const msg: ErrorMessage = {type: 'error', message};
	if (code !== undefined) {
		msg.code = code;
	}
	return msg;
}
