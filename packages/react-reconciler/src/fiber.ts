import { Flags, NoFlags } from './fiberFlags';
import { Container } from 'hostConfig';
import {
	Fragment,
	FunctionComponent,
	HostCompoment,
	WorkTag
} from './workTags';
import { Props, Key, Ref, ReactElementType } from 'shared/ReactTypes';
import { Lane, Lanes, NoLane, NoLanes } from './fiberLanes';
import { Effect } from './fiberHooks';

export class FiberNode {
	tag: WorkTag; // 节点类型 () -> {}  -> FunctionComponent
	pendingProps: Props; // 最新的props
	key: Key;
	type: any; // 当前节点的组件类型(函数组件，类组件，标签名)
	stateNode: any; // DOM节点或者是组件实例
	ref: Ref; // 引用，如(ref,React.createRef)

	return: FiberNode | null; // 父fiber
	sibling: FiberNode | null; // 兄弟fiber
	child: FiberNode | null; // 第一个子fiber节点
	index: number; // 当前节点在其兄弟节点中的位置

	memoizedProps: Props | null; // 上一次渲染使用的props
	memoizedState: any; // 状态
	alternate: FiberNode | null; // 指向上次渲染的fiber(current和workInProgress的互指)
	flags: Flags; // fiber需要执行的操作
	subtreeFlags: Flags; // 当前节点的子树的副作用标识
	updateQueue: unknown; // 存放state更新队列(如setState的调用)
	deletions: FiberNode[] | null;

	constructor(tag: WorkTag, pendingProps: Props, key: Key) {
		this.tag = tag; // fiber类型
		this.key = key || null;
		this.stateNode = null; // HostComponent <div> -> div的dom节点
		this.type = null; // FunctionComponent -> () => {}

		this.return = null; // 指向父fiberNode
		this.sibling = null;
		this.child = null;
		this.index = 0;
		this.ref = null;

		// 工作单元
		this.pendingProps = pendingProps;
		this.memoizedProps = null;
		this.memoizedState = null;
		this.alternate = null;
		this.updateQueue = null;

		// 副作用
		this.flags = NoFlags;
		this.subtreeFlags = NoFlags;
		this.deletions = null;
	}
}

export interface PendingPassiveEffects {
	unmount: Effect[];
	update: Effect[];
}

export class FiberRootNode {
	container: Container; // 宿主环境的容器，比如 DOM 中的 #root
	current: FiberNode; // 指向当前渲染中的根 FiberNode（HostRootFiber）
	finishedWork: FiberNode | null; // 调度完成、等待 commit 的 Fiber 树
	pendingLanes: Lanes;
	finishedLane: Lane;
	pendingPassiveEffects: PendingPassiveEffects;
	constructor(container: Container, hostRootFiber: FiberNode) {
		this.container = container;
		this.current = hostRootFiber;
		hostRootFiber.stateNode = this;
		this.finishedWork = null;
		this.pendingLanes = NoLanes;
		this.finishedLane = NoLane;

		this.pendingPassiveEffects = {
			unmount: [],
			update: []
		};
	}
}

export const createWorkInProcess = (
	current: FiberNode,
	pendingProps: Props
): FiberNode => {
	let wip = current.alternate;

	if (wip === null) {
		// mount
		wip = new FiberNode(current.tag, pendingProps, current.key);
		wip.stateNode = current.stateNode;
		wip.alternate = current;
		current.alternate = wip;
	} else {
		// update
		wip.pendingProps = pendingProps;
		wip.flags = NoFlags;
		wip.subtreeFlags = NoFlags;
		wip.deletions = null;
	}

	wip.type = current.type;
	wip.updateQueue = current.updateQueue;
	wip.child = current.child;
	wip.memoizedProps = current.memoizedProps;
	wip.memoizedState = current.memoizedState;

	return wip;
};

export const createFiberFromElement = (element: ReactElementType) => {
	const { type, key, props } = element;

	let fiberTag: WorkTag = FunctionComponent;

	if (typeof type === 'string') {
		// HostComponent <div></div> -> type: "div"
		fiberTag = HostCompoment;
	} else if (typeof type !== 'function' && __DEV__) {
		console.warn('未定义的type类型', type);
	}

	const fiber = new FiberNode(fiberTag, props, key);
	fiber.type = type;
	return fiber;
};

export const createFiberFromFragment = (elements: any, key: Key): FiberNode => {
	const fiber = new FiberNode(Fragment, elements, key);
	return fiber;
};
