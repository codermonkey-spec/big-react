import { ReactElementType } from 'shared/ReactTypes';
import { FiberNode } from './fiber';
import { processUpdateQueue, UpdateQueue } from './updateQueue';
import {
	FunctionComponent,
	HostCompoment,
	HostRoot,
	HostText
} from './workTags';
import { mountChildFibers, reconcileChildFibers } from './childFibers';
import { renderWithHooks } from './fiberHooks';
import { Fragment } from 'react';

export const beginWork = (wip: FiberNode) => {
	// 比较ReactElement和FilberNode,生成子FilberNode

	switch (wip.tag) {
		case HostRoot:
			return updateHostRoot(wip);
		case HostCompoment:
			return updateHostComponent(wip);
		case HostText:
			return null;
		case FunctionComponent:
			return updateFunctionComponent(wip);

		case Fragment:
			return updateFragment(wip);
		default:
			if (__DEV__) {
				console.warn('beginWork未实现的部分');
			}
			break;
	}

	return null;
};

function updateFragment(wip: FiberNode) {
	const nextChildren = wip.pendingProps;
	reconcileChildren(wip, nextChildren);

	return wip.child;
}

export const updateFunctionComponent = (wip: FiberNode) => {
	const nextChildren = renderWithHooks(wip);
	reconcileChildren(wip, nextChildren);

	return wip.child;
};

export const updateHostRoot = (wip: FiberNode) => {
	// 上一次更新的state
	const baseState = wip.memoizedState;

	// 拿到workprocess中的那个更新队列
	const updateQueue = wip.updateQueue as UpdateQueue<Element>;
	const pending = updateQueue.shared.pending;

	// 重置更新队列
	updateQueue.shared.pending = null;

	// 计算出新的state
	const { memoizedState } = processUpdateQueue(baseState, pending);
	wip.memoizedState = memoizedState;

	const nextChildren = wip.memoizedState;

	// 根据当前的workprocess和
	reconcileChildren(wip, nextChildren);
	return wip.child;
};

export const updateHostComponent = (wip: FiberNode) => {
	const nextProps = wip.memoizedProps;
	const nextChildren = nextProps.children;

	reconcileChildren(wip, nextChildren);
	return wip.child;
};

export const reconcileChildren = (
	wip: FiberNode,
	children?: ReactElementType
) => {
	const current = wip.alternate;

	if (current !== null) {
		// update阶段

		wip.child = reconcileChildFibers(wip, current?.child, children);
	} else {
		// mount阶段
		wip.child = mountChildFibers(wip, null, children);
	}
};
