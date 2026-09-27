import "./controlWorkspace.css";

type ControlWorkspaceProps = {
  planStatus: {
    plans?: number;
    status?: string;
  } | null;
  executionStatus: {
    executed?: number;
  } | null;
  openApprovals: number;
  failedApprovals: number;
  onRefresh: () => void;
  onOpenTools: () => void;
};

function statusLabel(status?: string) {
  if (!status) return "الحالة غير متاحة";
  return status;
}

export function ControlWorkspace({
  planStatus,
  executionStatus,
  openApprovals,
  failedApprovals,
  onRefresh,
  onOpenTools
}: ControlWorkspaceProps) {
  return (
    <section className="workspace control-workspace">
      <header className="control-workspace-header">
        <div>
          <span className="control-workspace-kicker">OPERATIONS &amp; SECURITY</span>
          <h2>التحكم والأمان</h2>
          <p>
            مركز موحد للمراقبة والموافقات والتدقيق والحالة التشغيلية للوكيل.
          </p>
        </div>

        <div className="control-header-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={onRefresh}
          >
            تحديث الحالة
          </button>
          <button
            type="button"
            className="workspace-tool-add"
            onClick={onOpenTools}
            aria-label="إدارة أدوات التحكم والأمان"
            title="إدارة أدوات التحكم والأمان"
          >
            أدوات التحكم
          </button>
        </div>
      </header>

      <div className="control-workspace-layout">
        <main className="control-main-panel">
          <section className="control-status-grid">
            <article className="control-status-card">
              <span>الخطط المسجلة</span>
              <strong>{planStatus?.plans ?? "—"}</strong>
              <small>{statusLabel(planStatus?.status)}</small>
            </article>

            <article className="control-status-card">
              <span>عمليات التنفيذ</span>
              <strong>{executionStatus?.executed ?? "—"}</strong>
              <small>عمليات مسجلة</small>
            </article>

            <article className="control-status-card control-warning">
              <span>موافقات معلقة</span>
              <strong>{openApprovals}</strong>
              <small>تحتاج قرارًا صريحًا قبل التنفيذ</small>
            </article>

            <article className="control-status-card">
              <span>عمليات فاشلة</span>
              <strong>{failedApprovals}</strong>
              <small>تحتاج مراجعة</small>
            </article>
          </section>

          <section className="control-operations-panel">
            <div className="control-section-heading">
              <div>
                <span className="control-section-kicker">SECURITY PIPELINE</span>
                <h3>مسار التشغيل الآمن</h3>
              </div>
              <span className="control-live-indicator">● ACTIVE</span>
            </div>

            <div className="control-pipeline">
              <div className="control-pipeline-step">
                <span>01</span>
                <strong>Capability</strong>
                <small>تحديد القدرة المطلوبة</small>
              </div>
              <div className="control-pipeline-step">
                <span>02</span>
                <strong>Authorization</strong>
                <small>التحقق من الصلاحية</small>
              </div>
              <div className="control-pipeline-step">
                <span>03</span>
                <strong>Approval</strong>
                <small>موافقة صريحة</small>
              </div>
              <div className="control-pipeline-step">
                <span>04</span>
                <strong>Execution</strong>
                <small>تنفيذ مقيد وقابل للتدقيق</small>
              </div>
              <div className="control-pipeline-step">
                <span>05</span>
                <strong>Audit</strong>
                <small>تسجيل والتحقق</small>
              </div>
            </div>
          </section>
        </main>

        <aside className="control-security-panel">
          <span className="control-security-kicker">RUNTIME SECURITY</span>
          <h3>حالة الحماية</h3>

          <div className="control-security-state">
            <span>●</span>
            <div>
              <strong>Fail-Closed</strong>
              <p>التنفيذ لا يتجاوز بوابة الموافقة.</p>
            </div>
          </div>

          <div className="control-security-row">
            <span>التنفيذ الذاتي</span>
            <strong>معطل</strong>
          </div>

          <div className="control-security-row">
            <span>الموافقة</span>
            <strong>إلزامية</strong>
          </div>

          <div className="control-security-row">
            <span>التدقيق</span>
            <strong>مفعل</strong>
          </div>

          <div className="control-audit-note">
            <strong>Audit Boundary</strong>
            <p>
              مخرجات النموذج لا تتحول إلى تنفيذ مباشر؛ كل عملية تنفيذية تمر
              بمسار الصلاحية والموافقة والتحقق.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
