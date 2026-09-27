import { useState } from "react";
import type { ProjectWorkspace } from "../api";
import "./studioWorkspace.css";

type StudioWorkspaceProps = {
  projectName: string;
  projectPlatform: string;
  projectSaving: boolean;
  projectLoading: boolean;
  projectError: string;
  projectWorkspaces: ProjectWorkspace[];
  onProjectNameChange: (value: string) => void;
  onProjectPlatformChange: (value: string) => void;
  onCreateProject: () => void;
  onOpenTools: () => void;
};

const STUDIO_MODES = [
  { id: "canvas", label: "لوحة الإبداع", icon: "✦" },
  { id: "assets", label: "الأصول", icon: "◈" },
  { id: "workflow", label: "سير العمل", icon: "↗" }
] as const;

export function StudioWorkspace({
  projectName,
  projectPlatform,
  projectSaving,
  projectLoading,
  projectError,
  projectWorkspaces,
  onProjectNameChange,
  onProjectPlatformChange,
  onCreateProject,
  onOpenTools
}: StudioWorkspaceProps) {
  const [activeMode, setActiveMode] =
    useState<(typeof STUDIO_MODES)[number]["id"]>("canvas");

  return (
    <section className="workspace studio-workspace">
      <header className="studio-workspace-header">
        <div>
          <span className="studio-workspace-kicker">CREATION WORKSPACE</span>
          <h2>الاستوديو</h2>
          <p>
            مساحة مستقلة لإنشاء المشاريع وإدارة الأصول وبناء سير العمل الإبداعي.
          </p>
        </div>

        <button
          type="button"
          className="workspace-tool-add studio-tools-button"
          onClick={onOpenTools}
        >
          أدوات الاستوديو
        </button>
      </header>

      <div className="studio-workspace-layout">
        <aside className="studio-project-rail">
          <div className="studio-panel-heading">
            <span>المشاريع</span>
            <span className="studio-count">
              {projectWorkspaces.length}
            </span>
          </div>

          <div className="studio-project-create">
            <input
              value={projectName}
              onChange={(event) => onProjectNameChange(event.target.value)}
              placeholder="اسم المشروع"
              disabled={projectSaving}
              aria-label="اسم مشروع الاستوديو"
            />

            <select
              value={projectPlatform}
              onChange={(event) => onProjectPlatformChange(event.target.value)}
              disabled={projectSaving}
              aria-label="منصة مشروع الاستوديو"
            >
              <option value="web">Web</option>
              <option value="android">Android</option>
              <option value="ios">iOS</option>
              <option value="cross-platform">Cross Platform</option>
            </select>

            <button
              type="button"
              onClick={onCreateProject}
              disabled={projectSaving || !projectName.trim()}
            >
              {projectSaving ? "جارٍ الإنشاء..." : "مشروع جديد"}
            </button>

            {projectError ? (
              <small className="studio-project-error">{projectError}</small>
            ) : null}
          </div>

          <div className="studio-project-list">
            {projectLoading ? (
              <div className="studio-empty-state">جارٍ تحميل المشاريع...</div>
            ) : projectWorkspaces.length > 0 ? (
              projectWorkspaces.map((project) => (
                <article className="studio-project-item" key={project.id}>
                  <div className="studio-project-icon">◆</div>
                  <div>
                    <strong>{project.name}</strong>
                    <span>{project.platform || "web"}</span>
                  </div>
                </article>
              ))
            ) : (
              <div className="studio-empty-state">
                لا توجد مشاريع بعد.
              </div>
            )}
          </div>
        </aside>

        <main className="studio-main-stage">
          <nav className="studio-mode-tabs" aria-label="أوضاع الاستوديو">
            {STUDIO_MODES.map((mode) => (
              <button
                type="button"
                key={mode.id}
                className={activeMode === mode.id ? "is-active" : ""}
                onClick={() => setActiveMode(mode.id)}
              >
                <span>{mode.icon}</span>
                {mode.label}
              </button>
            ))}
          </nav>

          {activeMode === "canvas" ? (
            <section className="studio-canvas">
              <div className="studio-canvas-grid" />
              <div className="studio-canvas-content">
                <span className="studio-canvas-kicker">CREATIVE CANVAS</span>
                <h3>مساحة الإنشاء</h3>
                <p>
                  ابدأ من مشروع جديد أو اختر مشروعًا موجودًا لبناء تجربة
                  إبداعية متكاملة.
                </p>
                <div className="studio-canvas-actions">
                  <button type="button" onClick={onOpenTools}>
                    فتح الأدوات
                  </button>
                  <span>بوابة الأدوات مرتبطة بمسار التحكم المركزي.</span>
                </div>
              </div>
            </section>
          ) : null}

          {activeMode === "assets" ? (
            <section className="studio-resource-panel">
              <div className="studio-resource-icon">◈</div>
              <h3>مكتبة الأصول</h3>
              <p>
                مساحة مخصصة للأصول والمصادر الإبداعية المرتبطة بالمشروع.
              </p>
              <span>ASSET LIBRARY · READY FOR INTEGRATION</span>
            </section>
          ) : null}

          {activeMode === "workflow" ? (
            <section className="studio-resource-panel">
              <div className="studio-resource-icon">↗</div>
              <h3>سير العمل</h3>
              <p>
                تنظيم مراحل المشروع مع الحفاظ على حدود الموافقة والتنفيذ
                الآمن.
              </p>
              <span>WORKFLOW · APPROVAL GATED</span>
            </section>
          ) : null}
        </main>

        <aside className="studio-inspector">
          <span className="studio-inspector-kicker">PROJECT STATUS</span>
          <h3>حالة الاستوديو</h3>

          <div className="studio-status-card">
            <span>المشاريع</span>
            <strong>{projectWorkspaces.length}</strong>
          </div>

          <div className="studio-status-card">
            <span>الوضع الحالي</span>
            <strong>
              {STUDIO_MODES.find((mode) => mode.id === activeMode)?.label}
            </strong>
          </div>

          <div className="studio-security-note">
            <span>●</span>
            <div>
              <strong>مسار آمن</strong>
              <p>العمليات التنفيذية لا تتجاوز بوابة الموافقة.</p>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
