import { getModeForResolutionAtIndex } from 'typescript';
import { createWorkInProcess, FiberNode, FiberRootNode } from './fiber';
import { beginWork } from './beginWork';
import { completeWork } from './completeWork';
import { HostRoot } from './workTags';

let workInProgress: FiberNode | null = null;

function prepareFreshStack(root: FiberRootNode) {
	workInProgress = createWorkInProcess(root.current, {});
}

export const scheduleUpdateOnFiber = (fiber: FiberNode) => {
	// TODO 调度功能
	// FiberRootNode
	const root = markUpdateFromFiberToRoot(fiber);
	renderRoot(root);
};

export const markUpdateFromFiberToRoot = (fiber: FiberNode) => {
	let node = fiber;
	let parent = node.return;
	while (parent !== null) {
		node = parent;
		parent = node.return;
	}

	// 找到HostRootFiber的时候
	if (node.tag == HostRoot) {
		return node.stateNode;
	}

	return null;
};

function renderRoot(root: FiberRootNode) {
	// 初始化
	prepareFreshStack(root);

	do {
		try {
			workLoop();
			break;
		} catch (e) {
			if (__DEV__) {
				console.warn('workLoop发生错误', e);
			}
			workInProgress = null;
		}
	} while (true);
}

export const workLoop = () => {
	while (workInProgress !== null) {
		performUnitOfWork(workInProgress);
	}
};

export const performUnitOfWork = (fiber: FiberNode) => {
	const next = beginWork(fiber);
	fiber.memoizedProps = fiber.pendingProps;

	if (next === null) {
		completeUnitOfWork(fiber);
	} else {
		workInProgress = next;
	}
};

function completeUnitOfWork(fiber: FiberNode) {
	let node: FiberNode | null = fiber;

	do {
		// 开始进行归的阶段
		completeWork(node);
		const sibling = node.sibling;

		if (sibling !== null) {
			workInProgress = sibling;
			return;
		}

		node = node!.return;
		workInProgress = node;
	} while (node !== null);
}
