import ELK from 'elkjs/lib/elk.bundled.js';

const elk = new ELK();

export async function layoutNodes(nodes, edges, direction = 'DOWN') {
  const elkGraph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': direction,
      'elk.spacing.nodeNode': '40',
      'elk.layered.spacing.nodeNodeBetweenLayers': '60',
    },
    children: nodes.map((node) => ({
      id: node.id,
      width: node.width ?? 200,
      height: node.height ?? 100,
    })),
    edges: edges.map((e) => ({
      id: e.id,
      sources: [e.source],
      targets: [e.target],
    })),
  };

  const layout = await elk.layout(elkGraph);

  return nodes.map((node) => {
    const lNode = layout.children.find((n) => n.id === node.id);
    return {
      ...node,
      position: {
        x: lNode.x,
        y: lNode.y,
      },
    };
  });
}
