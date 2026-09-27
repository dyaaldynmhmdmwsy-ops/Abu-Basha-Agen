import { useState } from "react";
import "./codingWorkspace.css";
import type { ReactNode } from "react";

export type CodingProject = {
  id: string;
  name: string;
  platform?: string;
  status?: string;
  type?: string;
};

export type CodingEditorFile = {
  id: string;
  name: string;
  path: string;
  language: string;
  content: string;
};

const CODING_EDITOR_FILES: readonly CodingEditorFile[] = [
  {
    id: "workspace",
    name: "workspace.json",
    path: "/workspace/workspace.json",
    language: "json",
    content: '{\n  "name": "abu-basha-project",\n  "runtime": "approval-gated",\n  "execution": "disabled-until-approved"\n}'
  },
  {
    id: "readme",
    name: "README.md",
    path: "/workspace/README.md",
    language: "markdown",
    content: "# Abu Basha Project\n\nProject context is isolated inside the Coding Workspace."
  },
  {
    id: "main",
    name: "main.ts",
    path: "/workspace/src/main.ts",
    language: "typescript",
    content: 'export function main() {\n  return "Abu Basha AI";\n}'
  }
];

export type CodingWorkspaceProps = {
  projectName: string;
  projectPlatform: string;
  projectSaving: boolean;
  projectLoading: boolean;
  projectError: string;
  projectWorkspaces: CodingProject[];
  codingTask: string;
  codingLoading: boolean;
  codingApproval: {
    id?: string;
    status?: string;
  } | null | undefined;
  codingExecution: {
    success?: boolean;
  } | null;
  codingExecutionLoading: boolean;
  onProjectNameChange: (value: string) => void;
  onProjectPlatformChange: (value: string) => void;
  onCreateProject: () => void;
  onTaskChange: (value: string) => void;
  onCreateApproval: () => void;
  onExecuteApproval: () => void;
  onOpenTools: () => void;
  renderToolIcon?: () => ReactNode;
};

export function CodingWorkspace({
  projectName,
  projectPlatform,
  projectSaving,
  projectLoading,
  projectError,
  projectWorkspaces,
  codingTask,
  codingLoading,
  codingApproval,
  codingExecution,
  codingExecutionLoading,
  onProjectNameChange,
  onProjectPlatformChange,
  onCreateProject,
  onTaskChange,
  onCreateApproval,
  onExecuteApproval,
  onOpenTools
}: CodingWorkspaceProps) {
  const activeProject = projectWorkspaces[0] || null;
  const [activeFileId, setActiveFileId] = useState("workspace");
  const [openFileIds, setOpenFileIds] = useState<string[]>(["workspace"]);
  const approvalStatus = codingApproval?.status || "idle";
  const activeFile =
    CODING_EDITOR_FILES.find((file) => file.id === activeFileId) ||
    CODING_EDITOR_FILES[0];

  const openFiles = openFileIds
    .map((id) => CODING_EDITOR_FILES.find((file) => file.id === id))
    .filter((file): file is CodingEditorFile => Boolean(file));

  const openCodingFile = (fileId: string) => {
    setOpenFileIds((current) =>
      current.includes(fileId) ? current : [...current, fileId]
    );
    setActiveFileId(fileId);
  };

  return (
    <section className="workspace coding-workspace">
      <header className="coding-workspace-header">
        <div className="coding-workspace-heading">
          <span className="workspace-kicker">CODING WORKSPACE</span>
          <h2>بيئة البرمجة</h2>
          <p>
            مساحة تطوير مستقلة للمشاريع والمهام البرمجية، مع بقاء التنفيذ
            محكومًا بالموافقة والبوابة الأمنية.
          </p>
        </div>

        <div className="coding-header-actions">
          <span className="coding-security-badge">
            <span className="coding-status-dot" />
            SAFE RUNTIME
          </span>

          <button
            type="button"
            className="workspace-tool-add"
            onClick={onOpenTools}
            aria-label="إدارة أدوات البرمجة"
            title="إدارة أدوات البرمجة"
          >
            +
          </button>
        </div>
      </header>

      <div className="coding-ide-shell">
        <aside className="coding-explorer">
          <div className="coding-explorer-header">
            <div>
              <span className="coding-section-label">EXPLORER</span>
              <strong>المشاريع</strong>
            </div>
            <span className="coding-count">{projectWorkspaces.length}</span>
          </div>

          <div className="coding-project-create">
            <label className="settings-field">
              <span>اسم المشروع</span>
              <input
                value={projectName}
                onChange={(event) => onProjectNameChange(event.target.value)}
                placeholder="مثال: مشروعي الجديد"
                disabled={projectSaving}
              />
            </label>

            <label className="settings-field">
              <span>المنصة</span>
              <select
                value={projectPlatform}
                onChange={(event) =>
                  onProjectPlatformChange(event.target.value)
                }
                disabled={projectSaving}
              >
                <option value="web">Web</option>
                <option value="api">API</option>
                <option value="android">Android</option>
                <option value="ios">iOS</option>
                <option value="node">Node.js</option>
                <option value="python">Python</option>
                <option value="generic">Generic</option>
              </select>
            </label>

            <button
              type="button"
              onClick={onCreateProject}
              disabled={projectSaving || !projectName.trim()}
            >
              {projectSaving ? "جاري الإنشاء..." : "إنشاء مشروع"}
            </button>
          </div>

          {projectLoading ? (
            <div className="coding-inline-state">جاري تحميل المشاريع...</div>
          ) : null}

          {projectError ? (
            <div className="coding-inline-state coding-error">
              {projectError}
            </div>
          ) : null}

          <div className="coding-project-tree">
            {!projectLoading && projectWorkspaces.length === 0 ? (
              <div className="coding-empty-projects">
                <strong>لا توجد مشاريع</strong>
                <span>أنشئ أول مشروع ليظهر هنا.</span>
              </div>
            ) : null}

            {projectWorkspaces.map((workspace) => (
              <article className="coding-project-item" key={workspace.id}>
                <span className="coding-project-type">
                  {workspace.type || "PROJECT"}
                </span>
                <strong>{workspace.name}</strong>
                <small>
                  {workspace.platform || "generic"} ·{" "}
                  {workspace.status || "active"}
                </small>
              </article>
            ))}
          </div>
        </aside>

        <main className="coding-editor">
          <div className="coding-editor-context-tabs">
            <div className="coding-file-tree">
              <div className="coding-file-tree-title">PROJECT FILES</div>
              {CODING_EDITOR_FILES.map((file) => (
                <button
                  key={file.id}
                  type="button"
                  className={`coding-file-item ${activeFileId === file.id ? "active" : ""}`}
                  onClick={() => openCodingFile(file.id)}
                >
                  <span className="coding-file-icon">{file.language === "typescript" ? "TS" : file.language === "json" ? "{}" : "MD"}</span>
                  <span>{file.name}</span>
                </button>
              ))}
            </div>

            <div className="coding-open-files">
              <div className="coding-open-files-bar">
                {openFiles.map((file) => (
                  <button
                    key={file.id}
                    type="button"
                    className={`coding-editor-context-tab ${activeFileId === file.id ? "active" : ""}`}
                    onClick={() => setActiveFileId(file.id)}
                  >
                    {file.name}
                  </button>
                ))}
              </div>

              <div className="coding-editor-active-file">
                <div className="coding-editor-file-meta">
                  <span>{activeFile.path}</span>
                  <span>{activeFile.language}</span>
                </div>
                <pre className="coding-editor-preview">
                  {activeFile.content}
                </pre>
              </div>
            </div>
          </div>

          <div className="coding-editor-tabs">
            <div className="coding-editor-tab coding-editor-tab-active">
              <span className="coding-tab-dot" />
              مهمة التطوير
            </div>

            <div className="coding-editor-context">
              {activeProject
                ? `${activeProject.name} · ${
                    activeProject.platform || "generic"
                  }`
                : "لا يوجد مشروع محدد"}
            </div>
          </div>

          <div className="coding-editor-toolbar">
            <div>
              <span className="coding-section-label">DEVELOPMENT TASK</span>
              <strong>مساحة العمل</strong>
            </div>

            <div className="coding-editor-meta">
              <span>AI ASSISTED</span>
              <span>APPROVAL REQUIRED</span>
            </div>
          </div>

          <div className="coding-editor-surface">
            <div className="coding-line-numbers" aria-hidden="true">
              {Array.from({ length: 10 }, (_, index) => (
                <span key={index}>{index + 1}</span>
              ))}
            </div>

            <textarea
              value={codingTask}
              onChange={(event) => onTaskChange(event.target.value)}
              placeholder="اكتب هنا المهمة البرمجية أو وصف التغيير المطلوب..."
              disabled={codingLoading}
              aria-label="مهمة التطوير"
            />
          </div>

          <div className="coding-command-bar">
            <span>
              {codingApproval
                ? `Approval: ${codingApproval.status || "pending"}`
                : "Draft · لم يتم إنشاء طلب موافقة"}
            </span>

            <button
              type="button"
              onClick={onCreateApproval}
              disabled={codingLoading || !codingTask.trim()}
            >
              {codingLoading
                ? "جاري إنشاء طلب الموافقة..."
                : "طلب موافقة التنفيذ"}
            </button>
          </div>
        </main>

        <aside className="coding-runtime">
          <div className="coding-runtime-header">
            <span className="coding-section-label">RUNTIME</span>
            <strong>التشغيل والأمان</strong>
          </div>

          <div className="coding-runtime-card">
            <span>SECURITY GATE</span>
            <strong>Approval Gateway</strong>
            <small>
              لا يوجد تنفيذ مباشر من واجهة المستخدم.
            </small>
          </div>

          <div className="coding-runtime-card">
            <span>APPROVAL STATUS</span>
            <strong>{approvalStatus}</strong>

            {codingApproval ? (
              <small>
                ID: {codingApproval.id || "—"}
              </small>
            ) : (
              <small>بانتظار إنشاء طلب موافقة.</small>
            )}
          </div>

          {codingApproval?.status === "approved" ? (
            <button
              type="button"
              className="coding-execute-button"
              onClick={onExecuteApproval}
              disabled={codingExecutionLoading}
            >
              {codingExecutionLoading
                ? "جاري التنفيذ..."
                : "تنفيذ المهمة المعتمدة"}
            </button>
          ) : (
            <div className="coding-runtime-hint">
              الموافقة الصريحة مطلوبة قبل أي تنفيذ.
            </div>
          )}

          {codingExecution ? (
            <div className="coding-execution-result">
              <span>EXECUTION RESULT</span>
              <strong>
                {codingExecution.success ? "نجح التنفيذ" : "فشل التنفيذ"}
              </strong>
            </div>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
