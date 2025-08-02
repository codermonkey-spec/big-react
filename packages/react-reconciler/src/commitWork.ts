import {
	appendChildToContainer,
	commitUpdate,
	Container,
	insertChildToContainer,
	Instance,
	removeChild
} from 'hostConfig';
import { FiberNode, FiberRootNode } from './fiber';
import {
	ChildDeletion,
	MutationMask,
	NoFlags,
	Placement,
	Update
} from './fiberFlags';
import {
	FunctionComponent,
	HostCompoment,
	HostRoot,
	HostText
} from './workTags';

let nextEffect: FiberNode | null = null;

export const commitMutationEffects = (finishedWork: FiberNode) => {
	nextEffect = finishedWork;

	while (nextEffect !== null) {
		const child: FiberNode | null = nextEffect.child;
		if (
			(nextEffect.subtreeFlags & MutationMask) !== NoFlags &&
			child !== null
		) {
			nextEffect = child;
		} else {
			up: while (nextEffect !== null) {
				commitMutationEffectsOnFiber(nextEffect);
				const sibling: FiberNode | null = nextEffect.sibling;
				if (sibling !== null) {
					nextEffect = sibling;
					break up;
				}

				nextEffect = nextEffect.return;
			}
		}
	}
};

export const commitMutationEffectsOnFiber = (finishedWork: FiberNode) => {
	const flags = finishedWork.flags;

	if ((flags & Placement) !== NoFlags) {
		commitPlacement(finishedWork);
		finishedWork.flags &= ~Placement;
	}

	if ((flags & Update) !== NoFlags) {
		commitUpdate(finishedWork);
		finishedWork.flags &= ~Update;
	}

	if ((flags & ChildDeletion) !== NoFlags) {
		const deletions = finishedWork.deletions;
		if (deletions !== null) {
			deletions.forEach((childToDelete) => {
				commitDeletion(childToDelete);
			});
		}
		finishedWork.flags &= ~ChildDeletion;
	}
};

export const commitNestedComponent = (
	root: FiberNode,
	onCommitUnmount: (fiber: FiberNode) => void
) => {
	let node = root;

	while (true) {
		onCommitUnmount(node);

		if (node.child !== null) {
			node.child.return = node;
			node = node.child;
			continue;
		}

		if (node === root) {
			return;
		}

		while (node.sibling === null) {
			if (node.return === null || node.return === root) {
				return;
			}

			node = node.return;
		}

		node.sibling.return = node.return;
		node = node.sibling;
	}
};

function recordHostChildrenToDelete(
	childrenToDelete: FiberNode[],
	unmountFiber: FiberNode
) {
	// 找到第一个root host节点
	let lastOne = childrenToDelete[childrenToDelete.length - 1];
	if (!lastOne) {
		childrenToDelete.push(unmountFiber);
	} else {
		let node = lastOne.sibling;
		while (node !== null) {
			if (unmountFiber === node) {
				childrenToDelete.push(unmountFiber);
			}
			node = node.sibling;
		}
	}
	// 每找到一个host节点,判断下这个节点是不是1 找到那个节点的兄弟节点
}

export const commitDeletion = (childToDelete: FiberNode) => {
	const rootChildrenToDelete: FiberNode[] = [];

	commitNestedComponent(childToDelete, (unmountFiber) => {
		switch (unmountFiber.tag) {
			case HostCompoment:
				recordHostChildrenToDelete(rootChildrenToDelete, unmountFiber);
				//TODO 解绑ref
				return;
			case HostText:
				recordHostChildrenToDelete(rootChildrenToDelete, unmountFiber);
				return;
			case FunctionComponent:
			// useEffect unmount处理
			default:
				if (__DEV__) {
					console.warn('未处理unmount类型', unmountFiber);
				}
		}
	});

	if (rootChildrenToDelete) {
		const hostParent = getHostParent(childToDelete);
		if (hostParent) {
			rootChildrenToDelete.forEach((node) => {
				removeChild(node.stateNode, hostParent);
			});
		}

		childToDelete.return = null;
		childToDelete.child = null;
	}
};

export const commitPlacement = (finishedWork: FiberNode) => {
	// 根据dom寻找parent节点
	if (__DEV__) {
		console.warn('执行Placement操作', finishedWork);
	}

	const hostParent = getHostParent(finishedWork);
	const sibling = getHostSibling(finishedWork);

	if (hostParent !== null) {
		insetOrAppendPlacementNodeIntoContainer(finishedWork, hostParent, sibling);
	}
};

function getHostSibling(fiber: FiberNode) {
	let node: FiberNode = fiber;

	findSibling: while (true) {
		// 向上寻找
		while (node.sibling === null) {
			const parent = node.return;

			if (
				parent === null ||
				node.tag === HostCompoment ||
				node.tag === HostRoot
			) {
				return null;
			}

			node = parent;
		}

		node.sibling.return = node.return;
		node = node.sibling;

		while (node.tag !== HostText && node.tag !== HostCompoment) {
			// 向下寻找
			if ((node.flags & Placement) !== NoFlags) {
				continue findSibling;
			}

			if (node.child === null) {
				continue findSibling;
			} else {
				node.child.return = node;
				node = node.child;
			}
		}

		if ((node.flags & Placement) === NoFlags) {
			return node.stateNode;
		}
	}
}

export const getHostParent = (fiber: FiberNode): Container | null => {
	let parent = fiber.return;
	while (parent) {
		const parentTag = parent.tag;

		if (parentTag === HostCompoment) {
			return parent.stateNode;
		}

		if (parentTag === HostRoot) {
			return (parent.stateNode as FiberRootNode).container;
		}

		parent = parent.return;
	}

	if (__DEV__) {
		console.warn('未找到host parent', parent);
	}
	return null;
};

export const insetOrAppendPlacementNodeIntoContainer = (
	finishedWork: FiberNode,
	hostParent: Container,
	before?: Instance
) => {
	if (finishedWork.tag === HostCompoment || finishedWork.tag === HostText) {
		if (before) {
			insertChildToContainer(finishedWork.stateNode, hostParent, before);
		} else {
			appendChildToContainer(hostParent, finishedWork.stateNode);
		}

		return;
	}

	const child = finishedWork.child;
	if (child !== null) {
		insetOrAppendPlacementNodeIntoContainer(child, hostParent);
		let sibling = child.sibling;

		while (sibling !== null) {
			insetOrAppendPlacementNodeIntoContainer(sibling, hostParent);
			sibling = sibling.sibling;
		}
	}
};
