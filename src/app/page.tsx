import ToolsLayout from './tools/layout';
import StartPage from './tools/start/page';

// Render the main experience at the entry URL so the original referrer and
// campaign parameters remain available after the visitor chooses consent.
export default function Page() {
  return <ToolsLayout><StartPage /></ToolsLayout>;
}
