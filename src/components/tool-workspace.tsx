import { Layers3, Link2 } from "lucide-react";
import { ToolsHeader } from "@/components/tools-header";
import { SeoChecklist } from "@/components/seo-checklist";
import { workspaces, type WorkspaceId } from "@/lib/tool-workspaces";
import "@/app/tools/finance-bento.css";
import "@/app/tools/workspaces.css";
export function ToolWorkspace({ id }: { id: WorkspaceId }) {
  const workspace = workspaces[id];
  return (
    <div className="finance-dashboard tools-workspace">
      <ToolsHeader active={id} />
      <main>
        <section className="workspace-hero">
          <span>{workspace.eyebrow}</span>
          <h1>{workspace.title}</h1>
          <p>{workspace.description}</p>
        </section>
        <section className="workspace-summary" aria-label="연결 상태">
          <span><Link2 size={16} /> 외부 서비스 미연결</span>
          <h2>{workspace.empty}</h2>
          <p>{workspace.connection}</p>
        </section>
        {id === "seo" ? <SeoChecklist /> : (
          <section className="workspace-features" aria-label="연결 후 확인할 항목">
            {workspace.cards.map((card) => (
              <article key={card.title} className="workspace-panel">
                <Layers3 size={20} aria-hidden="true" />
                <h2>{card.title}</h2>
                <p>{card.text}</p>
                <span className="workspace-pending">데이터 연결 대기</span>
              </article>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
