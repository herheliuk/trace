import { createContext } from "react";

export type NodeContextType = {
  nodeIndex: string | null;
  setNodeIndex: React.Dispatch<React.SetStateAction<string | null>>;
};

export const NodeContext = createContext<NodeContextType | undefined>(
  undefined
);
