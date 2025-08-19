import { ReactElementType } from 'shared/ReactTypes';
import {
	createFiberFromFragment,
	createFiberFromOffscreen,
	createWorkInProcess,
	FiberNode,
	OffscreenProps
} from './fiber';
import { processUpdateQueue, UpdateQueue } from './updateQueue';
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
import { mountChildFibers, reconcileChildFibers } from './childFibers';
import { dispatchSetState, renderWithHooks } from './fiberHooks';
import { Lane } from './fiberLanes';
import { ChildDeletion, Placement, Ref } from './fiberFlags';
import { pushProvider } from './fiberContext';

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

		case ContextProvider:
			return updateContextProvider(wip);

		case SuspenseComponent:
		case OffscreenComponent:
			return updateOffscreenComponent(wip);
		default:
			if (__DEV__) {
				console.warn('beginWork未实现的部分');
			}
			break;
	}

	return null;
};

export function updateSuspenseComponent(wip: FiberNode) {
	const current = wip.alternate;
	const nextProps = wip.pendingProps;
	let showFallback = false;
	const didSuspend = true;
	if (didSuspend) {
		showFallback = true;
	}

	const nextPrimaryChildren = nextProps.children;
	const nextFallbackChildren = nextProps.fallback;

	if (current === null) {
		// mount

		if (showFallback) {
			// 挂起
			return mountSuspenseFallbackChildren(
				wip,
				nextPrimaryChildren,
				nextFallbackChildren
			);
		} else {
			//正常
			return mountSuspensePrimaryChildren(wip, nextPrimaryChildren);
		}
	} else {
		// update
		if (showFallback) {
			// 挂起
			return updateSuspenseFallbackChildren(
				wip,
				nextPrimaryChildren,
				nextFallbackChildren
			);
		} else {
			// 正常
			return updateSuspensePrimaryChildren(wip, nextPrimaryChildren);
		}
	}
}

export function updateSuspensePrimaryChildren(
	wip: FiberNode,
	primaryChildren: any
) {
	const current = wip.alternate as FiberNode;
	const currentPrimaryChildFragment = current.child as FiberNode;
	const currentFallbackChildFragment: FiberNode | null =
		currentPrimaryChildFragment.sibling;

	const primaryChildProps: OffscreenProps = {
		mode: 'visible',
		children: primaryChildren
	};

	const primaryChildFragment = createWorkInProcess(
		currentPrimaryChildFragment,
		primaryChildProps
	);

	primaryChildFragment.return = wip;
	primaryChildFragment.sibling = null;
	wip.child = primaryChildFragment;

	if (currentFallbackChildFragment !== null) {
		const deletions = wip.deletions;
		if (deletions === null) {
			wip.deletions = [currentFallbackChildFragment];
			wip.flags |= ChildDeletion;
		} else {
			deletions.push(currentFallbackChildFragment);
		}
	}

	return primaryChildFragment;
}

export function updateSuspenseFallbackChildren(
	wip: FiberNode,
	primaryChildren: any,
	fallbackChildren: any
) {
	const current = wip.alternate as FiberNode;
	const currentPrimaryChildFragment = current.child as FiberNode;
	const currentFallbackChildFragment: FiberNode | null =
		currentPrimaryChildFragment.sibling;

	const primaryChildProps: OffscreenProps = {
		mode: 'hidden',
		children: primaryChildren
	};

	const primaryChildFragment = createWorkInProcess(
		currentPrimaryChildFragment,
		primaryChildProps
	);
	let fallbackChildFragment;
	if (currentFallbackChildFragment !== null) {
		fallbackChildFragment = createWorkInProcess(
			currentFallbackChildFragment,
			fallbackChildren
		);
	} else {
		fallbackChildFragment = createFiberFromFragment(fallbackChildren, null);

		fallbackChildFragment.flags |= Placement;
	}

	fallbackChildFragment.return = wip;
	primaryChildFragment.return = wip;
	primaryChildFragment.sibling = fallbackChildFragment;
	wip.child = primaryChildFragment;

	return fallbackChildFragment;
}

export function mountSuspensePrimaryChildren(
	wip: FiberNode,
	primaryChildren: any
) {
	const primaryChildProps: OffscreenProps = {
		mode: 'visible',
		children: primaryChildren
	};

	const primaryChildFragment = createFiberFromOffscreen(primaryChildProps);

	wip.child = primaryChildFragment;
	primaryChildFragment.return = wip;
	return primaryChildFragment;
}

export function mountSuspenseFallbackChildren(
	wip: FiberNode,
	primaryChildren: any,
	fallbackChildren: any
) {
	const primaryChildProps: OffscreenProps = {
		mode: 'hidden',
		children: primaryChildren
	};

	const primaryChildFragment = createFiberFromOffscreen(primaryChildProps);
	const fallbackChildFragment = createFiberFromFragment(fallbackChildren, null);

	fallbackChildFragment.flags |= Placement;

	primaryChildFragment.return = wip;
	fallbackChildFragment.return = wip;
	primaryChildFragment.sibling = fallbackChildFragment;
	wip.child = primaryChildFragment;

	return fallbackChildFragment;
}

export function updateOffscreenComponent(wip: FiberNode) {
	const nextProps = wip.pendingProps;
	const nextChildren = nextProps.children;
	reconcileChildren(wip, nextChildren);
	return wip.child;
}

export function updateContextProvider(wip: FiberNode) {
	const providerType = wip.type;
	const context = providerType._context;

	const newProps = wip.pendingProps;

	pushProvider(context, newProps.value);

	const nextChildren = newProps.children;
	reconcileChildren(wip, nextChildren);

	return wip.child;
}

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
