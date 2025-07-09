export type WorkTag =
	| typeof FunctionComponent
	| typeof HostRoot
	| typeof HostCompoment
	| typeof HostText;

export const FunctionComponent = 0;
export const HostRoot = 3; //  react根节点
export const HostCompoment = 5; // <div>
export const HostText = 6; // 123
