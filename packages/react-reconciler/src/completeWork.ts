import { Container, createInstance, createTextInstance } from 'hostConfig';
import { FiberNode } from './fiber';
import {
	FunctionComponent,
	HostCompoment,
	HostRoot,
	HostText
} from './workTags';
import { NoFlags, Update } from './fiberFlags';
import { updateFiberProps } from 'react-dom/src/SyntheticEvent';

export const markUpdate = (fiber: FiberNode) => {
	fiber.flags |= Update;
};

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
			} else {
				/**
				 * 1.构建dom
				 * 2. 将dom插入到dom树中
				 */
				const instance = createInstance(wip.type, newProps);
				appendAllChildren(instance, wip);
				wip.stateNode = instance;
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
			bubbleProperties(wip);
			return null;
		case FunctionComponent:
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
