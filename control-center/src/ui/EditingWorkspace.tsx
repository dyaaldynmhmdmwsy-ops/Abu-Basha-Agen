import { useMemo, useState } from "react";
import "./editingWorkspace.css";

type EditingProject = {
  id: string;
  name: string;
  platform?: string;
  status?: string;
};

export type EditingWorkspaceProps = {
  projectName: string;
  projectPlatform: string;
  projectSaving: boolean;
  projectLoading: boolean;
  projectError: string;
  projectWorkspaces: EditingProject[];
  onProjectNameChange: (value: string) => void;
  onProjectPlatformChange: (value: string) => void;
  onCreateProject: () => void;
  onOpenTools: () => void;
};

const EDITING_ASSETS = [
  { id: "video", label: "الفيديو", meta: "مصادر الفيديو" },
  { id: "audio", label: "الصوت", meta: "مسارات الصوت" },
  { id: "images", label: "الصور", meta: "الصور والأصول" },
  { id: "text", label: "النصوص", meta: "العناوين والنصوص" }
] as const;

const EDITING_TRACKS = [
  { id: "v1", label: "V1", type: "فيديو" },
  { id: "a1", label: "A1", type: "صوت" },
  { id: "a2", label: "A2", type: "صوت" }
] as const;

export function EditingWorkspace({
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
}: EditingWorkspaceProps) {
  const [activeAsset, setActiveAsset] = useState("video");
  const [activeProjectId, setActiveProjectId] = useState<string | null>(
    projectWorkspaces[0]?.id || null
  );

  const activeProject = useMemo(
    () =>
      projectWorkspaces.find((project) => project.id === activeProjectId) ||
      projectWorkspaces[0] ||
      null,
    [activeProjectId, projectWorkspaces]
  );

  return (
    <section className="workspace editing-workspace">
      <header className="editing-workspace-header">
        <div className="editing-workspace-heading">
          <span className="workspace-kicker">EDITING WORKSPACE</span>
          <h2>المونتاج</h2>
          <p>
            مساحة مستقلة لتحرير المشاريع والوسائط والأصول مع بنية عمل مخصصة
            للمونتاج.
          </p>
        </div>

        <div className="editing-workspace-actions">
          <span className="editing-project-state">
            {activeProject ? activeProject.name : "لا يوجد مشروع نشط"}
          </span>

          <button
            type="button"
            className="workspace-tool-add"
            onClick={onOpenTools}
            aria-label="إدارة أدوات المونتاج"
            title="إدارة أدوات المونتاج"
          >
            +
          </button>
        </div>
      </header>

      <div className="editing-workspace-layout">
        <aside className="editing-project-rail">
          <div className="editing-panel-heading">
            <div>
              <span className="editing-panel-kicker">PROJECTS</span>
              <strong>المشاريع</strong>
            </div>
            <span className="editing-count">{projectWorkspaces.length}</span>
          </div>

          <div className="editing-project-form">
            <label>
              <span>اسم المشروع</span>
              <input
                value={projectName}
                onChange={(event) => onProjectNameChange(event.target.value)}
                placeholder="مشروع جديد"
                disabled={projectSaving}
              />
            </label>

            <label>
              <span>المنصة</span>
              <select
                value={projectPlatform}
                onChange={(event) =>
                  onProjectPlatformChange(event.target.value)
                }
                disabled={projectSaving}
              >
                <option value="web">Web</option>
                <option value="android">Android</option>
                <option value="ios">iOS</option>
                <option value="generic">Generic</option>
              </select>
            </label>

            <button
              type="button"
              className="editing-primary-action"
              onClick={onCreateProject}
              disabled={projectSaving || !projectName.trim()}
            >
              {projectSaving ? "جاري الإنشاء..." : "إنشاء مشروع"}
            </button>

            {projectError ? (
              <small className="editing-error">{projectError}</small>
            ) : null}
          </div>

          <div className="editing-project-list">
            {projectLoading ? (
              <div className="editing-empty">جاري تحميل المشاريع...</div>
            ) : projectWorkspaces.length > 0 ? (
              projectWorkspaces.map((project) => (
                <button
                  type="button"
                  key={project.id}
                  className={
                    project.id === activeProject?.id
                      ? "editing-project-card active"
                      : "editing-project-card"
                  }
                  onClick={() => setActiveProjectId(project.id)}
                >
                  <strong>{project.name}</strong>
                  <span>
                    {project.platform || "generic"} ·{" "}
                    {project.status || "active"}
                  </span>
                </button>
              ))
            ) : (
              <div className="editing-empty">
                لا توجد مشاريع مونتاج بعد.
              </div>
            )}
          </div>
        </aside>

        <main className="editing-editor">
          <section className="editing-preview-panel">
            <div className="editing-panel-heading">
              <div>
                <span className="editing-panel-kicker">PREVIEW</span>
                <strong>المعاينة</strong>
              </div>
              <span className="editing-preview-status">READY</span>
            </div>

            <div className="editing-preview-stage">
              <div className="editing-preview-frame">
                <span>معاينة المشروع</span>
                <strong>
                  {activeProject?.name || "أنشئ مشروعًا لبدء التحرير"}
                </strong>
                <small>
                  منطقة المعاينة جاهزة لربط أدوات الوسائط لاحقًا عبر طبقة
                  الأدوات الآمنة.
                </small>
              </div>
            </div>
          </section>

          <section className="editing-assets-panel">
            <div className="editing-panel-heading">
              <div>
                <span className="editing-panel-kicker">MEDIA</span>
                <strong>الأصول</strong>
              </div>
            </div>

            <div className="editing-asset-tabs">
              {EDITING_ASSETS.map((asset) => (
                <button
                  type="button"
                  key={asset.id}
                  className={
                    activeAsset === asset.id
                      ? "editing-asset-tab active"
                      : "editing-asset-tab"
                  }
                  onClick={() => setActiveAsset(asset.id)}
                >
                  <strong>{asset.label}</strong>
                  <span>{asset.meta}</span>
                </button>
              ))}
            </div>

            <div className="editing-asset-surface">
              <span>
                {EDITING_ASSETS.find((asset) => asset.id === activeAsset)?.label}
              </span>
              <strong>مساحة الأصول</strong>
              <small>
                سيتم ربط استيراد وإدارة الأصول من خلال أدوات المونتاج المعتمدة.
              </small>
            </div>
          </section>

          <section className="editing-timeline-panel">
            <div className="editing-panel-heading">
              <div>
                <span className="editing-panel-kicker">TIMELINE</span>
                <strong>خط الزمن</strong>
              </div>
              <span className="editing-timecode">00:00:00:00</span>
            </div>

            <div className="editing-timeline-ruler">
              <span>00:00</span>
              <span>00:05</span>
              <span>00:10</span>
              <span>00:15</span>
              <span>00:20</span>
            </div>

            <div className="editing-tracks">
              {EDITING_TRACKS.map((track) => (
                <div className="editing-track" key={track.id}>
                  <div className="editing-track-label">
                    <strong>{track.label}</strong>
                    <span>{track.type}</span>
                  </div>
                  <div className="editing-track-lane">
                    <span className="editing-track-placeholder">
                      {activeProject ? "مسار جاهز للتحرير" : "لا يوجد مشروع"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>
    </section>
  );
}
