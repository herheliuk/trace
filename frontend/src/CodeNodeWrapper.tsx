// CodeNodeWrapper.tsx
import CodeNode from './CodeNode';

interface NodeWrapperProps {
  id: string;
  data: any;
}

// **DEFAULT EXPORT**
export default function CodeNodeWrapper({ id, data }: NodeWrapperProps) {
  return <CodeNode id={id} data={data} />;
}
