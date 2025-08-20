import { Container, createInstance, createTextInstance } from 'hostConfig';
import { FiberNode } from './fiber';
import {
	ContextProvider,
	Fragment,
	FunctionComponent,
	HostCompoment,
	HostRoot,
	HostText,
	OffscreenComponent,
	SuspenseComponent
} from './workTags';
import { NoFlags, Ref, Update, Visibility } from './fiberFlags';
import { updateFiberProps } from 'react-dom/src/SyntheticEvent';
import { popProvider } from './fiberContext';
import { popSuspenseHandler } from './suspenseContext';

export const markUpdate = (fiber: FiberNode) => {
	fiber.flags |= Update;
};

export function markRef(fiber: FiberNode) {
	fiber.flags |= Ref;
}

export const completeWork = (wip: FiberNode) => {
	// 归阶段的操作
	const newProps = wip.pendingProps;
	const current = wip.alternate;

	switch (wip.tag) {
		case HostCompoment:
			if (current !== null && wip.stateNode) {
				// update
				// 判断props是否改变
				updateFiberProps(wip.stateNode, newProps);
				if (current.ref !== wip.ref) {
					markRef(wip);
				}
			} else {
				/**
				 * 1.构建dom
				 * 2. 将dom插入到dom树中
				 */
				const instance = createInstance(wip.type, newProps);
				appendAllChildren(instance, wip);
				wip.stateNode = instance;

				// mount阶段标记ref
				if (wip.ref !== null) {
					markRef(wip);
				}
			}
			bubbleProperties(wip);
			return null;
		case HostText:
			if (current !== null && wip.stateNode) {
				// update
				const oldText = current.memoizedProps.content;
				const newText = newProps.content;
				if (oldText !== newText) {
					markUpdate(wip);
				}
			} else {
				const instance = createTextInstance(newProps.content);
				wip.stateNode = instance;
			}
			bubbleProperties(wip);
			return null;

		case HostRoot:
		case FunctionComponent:
		case Fragment:
		case OffscreenComponent:
			bubbleProperties(wip);
			return null;

		case ContextProvider:
			const context = wip.type._context;
			popProvider(context);
			bubbleProperties(wip);
			return null;
		case SuspenseComponent:
			popSuspenseHandler();
			const offscreenFiber = wip.child as FiberNode;
			const isHidden = offscreenFiber.pendingProps.mode === 'hidden';
			const currentOffscreenFiber = offscreenFiber.alternate;
			if (currentOffscreenFiber !== null) {
				const wasHidden = currentOffscreenFiber.pendingProps.mode === 'hidden';
				if (isHidden !== wasHidden) {
					offscreenFiber.flags |= Visibility;
					bubbleProperties(offscreenFiber);
				}
			} else if (isHidden) {
				offscreenFiber.flags |= Visibility;
				bubbleProperties(offscreenFiber);
			}
			bubbleProperties(wip);
			return null;
		default:
			if (__DEV__) {
				console.warn('未实现的情况');
			}
			break;
	}
};

export const appendAllChildren = (parent: Container, wip: FiberNode) => {
	let node = wip.child;

	while (node !== null) {
		if (node?.tag === HostCompoment || node?.tag === HostText) {
			appendAllChildren(parent, node.stateNode);
		} else if (node.child !== null) {
			node.child.return = node;
			node = node.child;
			continue;
		}

		if (node === wip) {
			return;
		}

		while (node.sibling === null) {
			if (node.return === null || node.return === wip) {
				return;
			}

			node = node?.return;
		}

		node.sibling.return = node.return;
		node = node.sibling;
	}
};

export const bubbleProperties = (wip: FiberNode) => {
	let subtreeFlags = NoFlags;
	let child = wip.child;

	while (child !== null) {
		subtreeFlags |= child.subtreeFlags;
		subtreeFlags |= child.flags;

		child.return = wip;
		child = child.sibling;
	}

	wip.subtreeFlags |= subtreeFlags;
};
