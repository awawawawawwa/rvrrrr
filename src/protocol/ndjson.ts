import {type ProtocolMessage} from './types.js';

export function encodeMessage(message: ProtocolMessage): string {
	return JSON.stringify(message) + '\n';
}

export function encodeMessages(messages: ProtocolMessage[]): string {
	let result = '';
	for (const message of messages) {
		result += JSON.stringify(message) + '\n';
	}
	return result;
}
