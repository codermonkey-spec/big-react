import {
	createWorkInProcess,
	FiberNode,
	FiberRootNode,
	PendingPassiveEffects
} from './fiber';
import { beginWork } from './beginWork';
import { completeWork } from './completeWork';
import { HostRoot } from './workTags';
import { MutationMask, NoFlags, PassiveEffect } from './fiberFlags';
import {
	commitHookEffectListCreate,
	commitHookEffectListDestroy,
	commitHookEffectListUnmount,
	commitLayoutEffects,
	commitMutationEffects
} from './commitWork';
import {
	getHighestPriorityLane,
	getNextLane,
	Lane,
	lanesToSchedulerPriority,
	markRootFinished,
	markRootSuspended,
	mergeLanes,
	NoLane,
	SyncLane
} from './fiberLanes';
import { scheeduleMicroTask } from 'hostConfig';
import { flushSyncCallbacks, scheduleSyncCallback } from './syncTaskQueue';
import {
	unstable_scheduleCallback as scheduleCallback,
	unstable_NormalPriority as NormalPriority,
	unstable_shouldYield,
	unstable_cancelCallback
} from 'scheduler';
import { HookHasEffect, Passive } from './hookEffectTag';
import { getSuspenseThenable, SuspenseException } from './thenable';
import { resetHooksOnUnwind } from './fiberHooks';
import { throwException } from './fiberThrow';
import { unwindWork } from './fiberUnwindWork';

let workInProgress: FiberNode | null = null;
let wipRootRenderLane: Lane = NoLane;
let rootDoesHasPassiveEffects: boolean = false;

type RootExitStatus = number;

// 工作中的状态
const RootInProgress = 0;
// 并发更新 中途打断
const RootInComplete = 1;
// render完成
const RootCompleted = 2;
//由于挂起，当前是未完成的状态
const RootDidNotComplete = 3;

let wipRootExitStatus: number = RootInProgress;

// TODO 执行过程中报错了

export type SuspenedReason = typeof NotSuspended | typeof SuspendedOnData;
export const NotSuspended = 0;
export const SuspendedOnData = 1;
export let wipSuspenedReason: SuspenedReason = NotSuspended;
export let wipThrownValue: any = null;

function prepareFreshStack(root: FiberRootNode, lane: Lane) {
	root.finishedLane = NoLane;
	root.finishedWork = null;
	workInProgress = createWorkInProcess(root.current, {});
	wipRootRenderLane = lane;
	wipRootExitStatus = RootInProgress;
	wipSuspenedReason = NotSuspended;
	wipThrownValue = null;
}

export const scheduleUpdateOnFiber = (fiber: FiberNode, lane: Lane) => {
	// TODO 调度功能
	// FiberRootNode
	const root = markUpdateFromFiberToRoot(fiber);
	markRootUpdated(root, lane);
	ensureRootIsScheduled(root);
};

export function ensureRootIsScheduled(root: FiberRootNode) {
	const updateLane = getNextLane(root);
	const existingCallback = root.callbackNode;
	if (updateLane === NoLane) {
		if (existingCallback !== null) {
			unstable_cancelCallback(existingCallback);
		}

		root.callbackNode = null;
		root.callbackPriority = NoLane;
		return;
	}

	const curPriority = updateLane;
	const prevPriority = root.callbackPriority;

	if (curPriority === prevPriority) {
		return;
	}

	if (existingCallback !== null) {
		unstable_cancelCallback(existingCallback);
	}

	let newCallbackNode = null;

	if (updateLane === SyncLane) {
		//同步优先级	用微任务调度
		if (__DEV__) {
			console.log('微任务中的调度,优先级为', updateLane);
		}
		scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root, updateLane));
		scheeduleMicroTask(flushSyncCallbacks);
	} else {
		// 其他优先级，用宏任务调度
		const schedulerPriority = lanesToSchedulerPriority(updateLane);
		newCallbackNode = scheduleCallback(
			schedulerPriority,
			// @ts-ignore
			performConcurrentWorkOnRoot.bind(null, root)
		);
	}

	root.callbackNode = newCallbackNode;
	root.callbackPriority = curPriority;
}

export const markRootUpdated = (root: FiberRootNode, lane: Lane) => {
	root.pendingLanes = mergeLanes(root.pendingLanes, lane);
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

export const performConcurrentWorkOnRoot = (
	root: FiberRootNode,
	didTimeout: boolean
): any => {
	// 保证useEffect回调执行
	const curCallback = root.callbackNode;
	const didFlushPassiveEffect = flushPassiveEffects(root.pendingPassiveEffects);

	if (didFlushPassiveEffect) {
		if (root.callbackNode !== curCallback) {
			return null;
		}
	}

	const lane = getNextLane(root);
	const curCallbackNode = root.callbackNode;
	if (lane === NoLane) {
		return null;
	}
	const needSync = lane === SyncLane || didTimeout;

	// render阶段
	const exitStatus = renderRoot(root, lane, !needSync);

	switch (exitStatus) {
		case RootCompleted:
			// 中断执行的情况
			if (root.callbackNode !== curCallbackNode) {
				return null;
			}

			return performConcurrentWorkOnRoot.bind(null, root);
		case RootCompleted:
			const finishedWork = root.current.alternate;
			root.finishedWork = finishedWork;
			root.finishedLane = lane;
			wipRootRenderLane = NoLane;

			commitRoot(root);
			break;
		case RootDidNotComplete:
			wipRootRenderLane = NoLane;
			markRootSuspended(root, lane);
			ensureRootIsScheduled(root);
			break;
		default:
			if (__DEV__) {
				console.warn('还未实现的并发更新结束状态');
			}

			break;
	}
};
function performSyncWorkOnRoot(root: FiberRootNode) {
	const nextLane = getNextLane(root);
	if (nextLane !== SyncLane) {
		ensureRootIsScheduled(root);
		return;
	}

	const exitStatus = renderRoot(root, nextLane, false);

	switch (exitStatus) {
		case RootCompleted:
			const finishedWork = root.current.alternate;
			root.finishedWork = finishedWork;
			root.finishedLane = nextLane;
			wipRootRenderLane = NoLane;

			commitRoot(root);
			break;
		case RootDidNotComplete:
			wipRootRenderLane = NoLane;
			markRootSuspended(root, nextLane);
			ensureRootIsScheduled(root);
			break;
		default:
			if (__DEV__) {
				console.warn('还未实现的同步更新结束状态');
			}

			break;
	}
}
function renderRoot(root: FiberRootNode, lane: Lane, shouldTimeSlice: boolean) {
	if (__DEV__) {
		console.log(`开始${shouldTimeSlice ? '并发' : '同步'}`);
	}

	if (wipRootRenderLane !== lane) {
		// 初始化
		prepareFreshStack(root, lane);
	}
	do {
		try {
			if (wipSuspenedReason !== NotSuspended && workInProgress !== null) {
				const thrownValue = wipThrownValue;
				wipSuspenedReason = NotSuspended;
				wipThrownValue = null;
				throwAndUnwindWorkLoop(root, workInProgress, thrownValue, lane);
			}

			shouldTimeSlice ? workLoopConcurrent() : workLoopSync();
			break;
		} catch (e) {
			if (__DEV__) {
				console.log('root', root);
				console.warn('workLoop发生错误', e);
			}

			handleThrow(root, e);
		}
	} while (true);

	if (wipRootExitStatus !== RootInProgress) {
		return wipRootExitStatus;
	}

	// 中断执行
	if (shouldTimeSlice && workInProgress !== null) {
		return RootInComplete;
	}

	// render阶段完了
	if (!shouldTimeSlice && workInProgress !== null && __DEV__) {
		console.error('render阶段结束时wip不应该不是null');
	}

	// TODO 报错的情况
	return RootCompleted;
}

export function throwAndUnwindWorkLoop(
	root: FiberRootNode,
	unitOfWork: FiberNode,
	thrownValue: any,
	lane: Lane
) {
	// 1. 重置全局变量
	resetHooksOnUnwind();
	// 2. 请求返回重新出发更新
	throwException(root, thrownValue, lane);
	// 3. unwind
	unwindUnitOfWork(unitOfWork);
}

export function unwindUnitOfWork(unitOfWork: FiberNode) {
	let incompleteWork: FiberNode | null = unitOfWork;

	do {
		const next = unwindWork(incompleteWork);
		if (next !== null) {
			workInProgress = next;
			return;
		}
		const returnFiber = incompleteWork.return as FiberNode;
		if (returnFiber !== null) {
			returnFiber.deletions = null;
		}

		incompleteWork = returnFiber;
	} while (incompleteWork !== null);

	wipRootExitStatus = RootDidNotComplete;
	workInProgress = null;
}

export function handleThrow(root: FiberRootNode, thrownValue: any) {
	if (thrownValue === SuspenseException) {
		thrownValue = getSuspenseThenable();
		wipSuspenedReason = SuspendedOnData;
	}
	wipThrownValue = thrownValue;
}

export const commitRoot = (root: FiberRootNode) => {
	// 拿到等待被commit的fiber树
	const finishedWork = root.finishedWork;

	if (finishedWork === null) {
		return;
	}
	if (__DEV__) {
		console.warn('commit阶段开始', finishedWork);
	}

	const lane = root.finishedLane;

	if (lane === NoLane && __DEV__) {
		console.error('commit阶段');
	}

	// 重置
	root.finishedWork = null;
	root.finishedLane = NoLane;
	markRootFinished(root, lane);

	if (
		(finishedWork.flags & PassiveEffect) !== NoFlags ||
		(finishedWork.subtreeFlags & PassiveEffect) !== NoFlags
	) {
		if (!rootDoesHasPassiveEffects) {
			rootDoesHasPassiveEffects = true;
			// 调度副作用
			// 相当于在setTimeout中进行执行副作用
			scheduleCallback(NormalPriority, () => {
				// 执行副作用
				flushPassiveEffects(root.pendingPassiveEffects);
				return;
			});
		}
	}

	const subtreeHasEffect =
		(finishedWork.subtreeFlags & MutationMask) !== NoFlags;
	const rootHasEffect = (finishedWork.flags & MutationMask) !== NoFlags;

	if (subtreeHasEffect || rootHasEffect) {
		//  * 1.beforeMutation阶段

		//  * 2. mutation阶段
		commitMutationEffects(finishedWork, root);
		root.current = finishedWork;
		//  * 3. layout阶段 (useLayoutEffect执行的时候)
		commitLayoutEffects(finishedWork, root);
	} else {
		root.current = finishedWork;
	}

	rootDoesHasPassiveEffects = false;
	ensureRootIsScheduled(root);
};

export function flushPassiveEffects(
	pendingPassiveEffects: PendingPassiveEffects
) {
	let didFlushPassiveEffect = false;
	pendingPassiveEffects.unmount.forEach((effect) => {
		// useEffect中的依赖项为空数组的卸载的函数
		didFlushPassiveEffect = true;
		commitHookEffectListUnmount(Passive, effect);
	});
	pendingPassiveEffects.unmount = [];

	pendingPassiveEffects.update.forEach((effect) => {
		// useEffect中的依赖项变化的时候的卸载的函数
		didFlushPassiveEffect = true;
		commitHookEffectListDestroy(Passive | HookHasEffect, effect);
	});

	// 先执行为所有的useEffect的所有的卸载的函数，在进行create中要执行的函数
	pendingPassiveEffects.update.forEach((effect) => {
		didFlushPassiveEffect = true;
		commitHookEffectListCreate(Passive | HookHasEffect, effect);
	});
	pendingPassiveEffects.update = [];
	flushSyncCallbacks();

	return didFlushPassiveEffect;
}

export const workLoopSync = () => {
	while (workInProgress !== null) {
		performUnitOfWork(workInProgress);
	}
};

export const workLoopConcurrent = () => {
	while (workInProgress !== null && !unstable_shouldYield()) {
		performUnitOfWork(workInProgress);
	}
};

export const performUnitOfWork = (fiber: FiberNode) => {
	const next = beginWork(fiber, wipRootRenderLane);
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
