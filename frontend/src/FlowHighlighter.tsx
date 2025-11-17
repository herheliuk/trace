import { useEffect } from "react";
import { useReactFlow } from "@xyflow/react";

export function FlowHighlighter({ highlightedId }) {
  const reactFlow = useReactFlow();

  useEffect(() => {
    if (!highlightedId) return;

    // Get latest node state from React Flow
    const node = reactFlow.getNode(highlightedId);
    if (!node) return;

    // Guaranteed to exist
    const { x, y } = node.position;

    // Width/height may not exist on first render
    const width = node.width ?? 0;
    const height = node.height ?? 0;

    reactFlow.setCenter(x + width / 2, y + height / 2, {
      duration: 400,
      zoom: reactFlow.getZoom(),
    });
  }, [highlightedId]);

  return null;
}
