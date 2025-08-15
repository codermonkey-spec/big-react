import { ReactElementType } from 'shared/ReactTypes';
import { FiberNode } from './fiber';
import { processUpdateQueue, UpdateQueue } from './updateQueue';
import {
	Fragment,
	FunctionComponent,
	HostCompoment,
	HostRoot,
	HostText
} from './workTags';
import { mountChildFibers, reconcileChildFibers } from './childFibers';
import { renderWithHooks } from './fiberHooks';
import { Lane } from './fiberLanes';
import { Ref } from './fiberFlags';

export const beginWork = (wip: FiberNode, renderLane: Lane) => {
	// 比较ReactElement和FilberNode,生成子FilberNode

	switch (wip.tag) {
		case HostRoot:
			return updateHostRoot(wip, renderLane);
		case HostCompoment:
			return updateHostComponent(wip);
		case HostText:
			return null;
		case FunctionComponent:
			return updateFunctionComponent(wip, renderLane);

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

export const updateFunctionComponent = (wip: FiberNode, renderLane: Lane) => {
	const nextChildren = renderWithHooks(wip, renderLane);
	reconcileChildren(wip, nextChildren);

	return wip.child;
};

export const updateHostRoot = (wip: FiberNode, renderLane: Lane) => {
	// 上一次更新的state
	const baseState = wip.memoizedState;

	// 拿到workprocess中的那个更新队列
	const updateQueue = wip.updateQueue as UpdateQueue<Element>;
	const pending = updateQueue.shared.pending;

	// 重置更新队列
	updateQueue.shared.pending = null;

	// 计算出新的state
	const { memoizedState } = processUpdateQueue(baseState, pending, renderLane);
	wip.memoizedState = memoizedState;

	const nextChildren = wip.memoizedState;

	// 根据当前的workprocess和
	reconcileChildren(wip, nextChildren);
	return wip.child;
};

export const updateHostComponent = (wip: FiberNode) => {
	const nextProps = wip.memoizedProps;
	const nextChildren = nextProps.children;
	markRef(wip.alternate, wip);
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

export function markRef(current: FiberNode | null, workInProgress: FiberNode) {
	const ref = workInProgress.ref;

	if (
		(current === null && ref !== null) ||
		(current !== null && current.ref !== ref)
	) {
		workInProgress.flags |= Ref;
	}
}
