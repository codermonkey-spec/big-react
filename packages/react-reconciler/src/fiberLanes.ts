import { FiberRootNode } from './fiber';

export type Lane = number;
export type Lanes = number;

export const SyncLane = 0b0001;
export const NoLane = 0b0000;
export const NoLanes = 0b0000;

export const requestUpdateLane = () => {
	return SyncLane;
};

export const mergeLanes = (laneA: Lane, laneB: Lane): Lanes => {
	return laneA | laneB;
};

export const getHighestPriorityLane = (lanes: Lanes): Lane => {
	return lanes & -lanes;
};

export function markRootFinished(root: FiberRootNode, lane: Lane) {
	root.pendingLanes &= ~lane;
}
