import {createContext} from 'react';
import * as Scheduler from 'scheduler';
import Reconciler from 'react-reconciler';
import {
	DefaultEventPriority,
	// @ts-expect-error — not typed yet in @types/react-reconciler
	NoEventPriority,
} from 'react-reconciler/constants.js';
import {
	createNode,
	createTextNode,
	appendChild,
	removeChild,
	insertBefore,
	appendChildToContainer,
	removeChildFromContainer,
	insertBeforeInContainer,
	setAttribute,
	setTextNodeValue,
} from '../dom/dom.js';
import {
	type DOMElement,
	type TextNode,
	type DOMNode,
	type DOMNodeAttribute,
	type OutputTransformer,
} from '../dom/types.js';
import applyStyles, {type Styles} from '../layout/styles.js';

let currentUpdatePriority: number = NoEventPriority;

const hostConfig = {
	supportsMutation: true,
	supportsPersistence: false,
	supportsHydration: false,
	isPrimaryRenderer: true,
	warnsIfNotActing: true,

	scheduleTimeout: setTimeout,
	cancelTimeout: clearTimeout,
	noTimeout: -1,
	scheduleCallback: Scheduler.unstable_scheduleCallback,
	cancelCallback: Scheduler.unstable_cancelCallback,
	shouldYield: Scheduler.unstable_shouldYield,
	now: Scheduler.unstable_now,

	getRootHostContext: () => null,
	getChildHostContext: () => null,

	shouldSetTextContent: () => false,
	getPublicInstance: (instance: unknown) => instance,

	prepareForCommit: () => null,
	clearContainer: () => {},
	resetTextContent: () => {},

	hideInstance: () => {},
	unhideInstance: () => {},
	hideTextInstance: () => {},
	unhideTextInstance: () => {},

	preparePortalMount: () => {},
	detachDeletedInstance: () => {},
	prepareScopeUpdate: () => {},
	getInstanceFromScope: () => null,
	getInstanceFromNode: () => null,
	beforeActiveInstanceBlur: () => {},
	afterActiveInstanceBlur: () => {},

	createInstance(type: string, props: Record<string, unknown>) {
		const node = createNode(type);

		if (props.style) {
			applyStyles(node.yogaNode!, props.style as Styles);
		}

		if (props.internal_transform) {
			node.internal_transform = props.internal_transform as OutputTransformer;
		}

		for (const [key, value] of Object.entries(props)) {
			if (key === 'children' || key === 'style' || key === 'internal_transform') {
				continue;
			}

			setAttribute(node, key, value as DOMNodeAttribute);
		}

		return node;
	},

	createTextInstance(text: string) {
		return createTextNode(text);
	},

	appendInitialChild(parentInstance: DOMElement, child: DOMNode) {
		appendChild(parentInstance, child);
	},

	finalizeInitialChildren: () => false,
	prepareUpdate: () => true,

	appendChild(parentInstance: DOMElement, child: DOMNode) {
		appendChild(parentInstance, child);
	},

	removeChild(parentInstance: DOMElement, child: DOMNode) {
		removeChild(parentInstance, child);
	},

	insertBefore(
		parentInstance: DOMElement,
		child: DOMNode,
		beforeChild: DOMNode,
	) {
		insertBefore(parentInstance, child, beforeChild);
	},

	appendChildToContainer(container: DOMElement, child: DOMNode) {
		appendChildToContainer(container, child);
	},

	removeChildFromContainer(container: DOMElement, child: DOMNode) {
		removeChildFromContainer(container, child);
	},

	insertInContainerBefore(
		container: DOMElement,
		child: DOMNode,
		beforeChild: DOMNode,
	) {
		insertBeforeInContainer(container, child, beforeChild);
	},

	commitUpdate(
		node: DOMElement,
		_type: string,
		_oldProps: Record<string, unknown>,
		newProps: Record<string, unknown>,
	) {
		if (newProps.style) {
			applyStyles(node.yogaNode!, newProps.style as Styles);
		}

		node.internal_transform =
			newProps.internal_transform as OutputTransformer | undefined;

		for (const [key, value] of Object.entries(newProps)) {
			if (key === 'children' || key === 'style' || key === 'internal_transform') {
				continue;
			}

			setAttribute(node, key, value as DOMNodeAttribute);
		}
	},

	commitTextUpdate(node: TextNode, _oldText: string, newText: string) {
		setTextNodeValue(node, newText);
	},

	resetAfterCommit(rootNode: DOMElement) {
		rootNode.onComputeLayout?.();
		rootNode.onRender?.();
	},

	setCurrentUpdatePriority(newPriority: number) {
		currentUpdatePriority = newPriority;
	},

	getCurrentUpdatePriority() {
		return currentUpdatePriority;
	},

	resolveUpdatePriority() {
		if (currentUpdatePriority !== NoEventPriority) {
			return currentUpdatePriority;
		}

		return DefaultEventPriority;
	},

	maySuspendCommit() {
		return false;
	},
	preloadInstance() {
		return true;
	},
	startSuspendingCommit() {},
	suspendInstance() {},
	waitForCommitToBeReady() {
		return null;
	},
	NotPendingTransition: null as unknown,
	HostTransitionContext: createContext(null),
	resetFormInstance() {},
	requestPostPaintCallback() {},
	shouldAttemptEagerTransition() {
		return false;
	},
	trackSchedulerEvent() {},
	resolveEventType() {
		return null;
	},
	resolveEventTimeStamp() {
		return -1.1;
	},

	rendererPackageName: 'tui-engine',
	rendererVersion: '0.1.0',
};

const reconciler = Reconciler(hostConfig as any);

export default reconciler;
