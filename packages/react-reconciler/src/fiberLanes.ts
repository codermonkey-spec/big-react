import {
	unstable_getCurrentPriorityLevel,
	unstable_IdlePriority,
	unstable_ImmediatePriority,
	unstable_NormalPriority,
	unstable_UserBlockingPriority
} from 'scheduler';
import { FiberRootNode } from './fiber';
import ReactCurrentBatchConfig from 'react/src/curentBatchConfig';

export type Lane = number;
export type Lanes = number;

export const SyncLane = 0b00001;
export const NoLane = 0b00000;
export const NoLanes = 0b00000;
export const InputContinuousLane = 0b00010;
export const DefaultLane = 0b00100;
export const transitionane = 0b01000;
export const IdleLane = 0b10000;

export const requestUpdateLane = () => {
	const isTransition = ReactCurrentBatchConfig.transition !== null;
	if (isTransition) {
		return transitionane;
	}
	// 从上下文中获取不同的优先级
	const currentSchedulerPriority = unstable_getCurrentPriorityLevel();
	const lane = schedulerPriorityToLane(currentSchedulerPriority);
	return lane;
};

export const mergeLanes = (laneA: Lane, laneB: Lane): Lanes => {
	return laneA | laneB;
};

export const getHighestPriorityLane = (lanes: Lanes): Lane => {
	return lanes & -lanes;
};

export const isSubsetOfLanes = (set: Lanes, subset: Lane) => {
	return (set & subset) === subset;
};

export function markRootFinished(root: FiberRootNode, lane: Lane) {
	root.pendingLanes &= ~lane;
	root.suspendedLanes = NoLanes;
	root.pingdLanes = NoLanes;
}

export const lanesToSchedulerPriority = (lanes: Lanes) => {
	const lane = getHighestPriorityLane(lanes);

	if (lane === SyncLane) {
		return unstable_ImmediatePriority;
	}

	if (lane === InputContinuousLane) {
		return unstable_UserBlockingPriority;
	}

	if (lane === DefaultLane) {
		return unstable_NormalPriority;
	}

	return unstable_IdlePriority;
};

export const schedulerPriorityToLane = (schedulerPriority: number) => {
	if (schedulerPriority === unstable_ImmediatePriority) {
		return SyncLane;
	}

	if (schedulerPriority === unstable_UserBlockingPriority) {
		return InputContinuousLane;
	}
	if (schedulerPriority === unstable_NormalPriority) {
		return DefaultLane;
	}

	return NoLane;
};

export function markRootSuspended(root: FiberRootNode, suspendedLane: Lane) {
	root.suspendedLanes |= suspendedLane;
	root.pendingLanes &= ~suspendedLane;
}

export function markRootPinged(root: FiberRootNode, pingdLane: Lane) {
	root.pingdLanes |= root.suspendedLanes & pingdLane;
}

export function getNextLane(root: FiberRootNode): Lane {
	const pendingLanes = root.pendingLanes;

	if (pendingLanes === NoLanes) {
		return NoLane;
	}

	let nextLane = NoLane;

	const suspendedLanes = pendingLanes & ~root.suspendedLanes;
	if (suspendedLanes !== NoLanes) {
		nextLane = getHighestPriorityLane(suspendedLanes);
	} else {
		const pingdLanes = pendingLanes & root.pingdLanes;
		if (pingdLanes !== NoLanes) {
			nextLane = getHighestPriorityLane(pingdLanes);
		}
	}

	return nextLane;
}
