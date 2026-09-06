import { useCallback, useEffect, useState } from "react";
import {
  getExecutionHistory,
  getExecutionStatus,
  getPlanStatus,
  type ExecutionHistoryItem,
  type ExecutionStatus,
  type PlanStatus
} from "./api";

type Section =
  | "overview"
  | "chat"
  | "plans"
  | "approvals"
  | "execution"
  | "audit"
  | "revenue";

const sections: { id: Section; label: string; icon: string }[] = [
  { id: "overview", label: "الرئيسية", icon: "⌂" },
  { id: "chat", label: "المحادثة", icon: "✦" },
  { id: "plans", label: "الخطط", icon: "≡" },
  { id: "approvals", label: "الموافقات", icon: "✓" },
  { id: "execution", label: "التنفيذ", icon: "▶" },
  { id: "audit", label: "التدقيق", icon: "◉" },
  { id: "revenue", label: "الأرباح", icon: "$" }
];

function statusLabel(status?: string) {
  if (status === "online") return "متصل";
  if (status === "unavailable") return "غير متاح";
  return status || "غير معروف";
}

function App() {
  const [active, setActive] = useState<Section>("overview");
  const [planStatus, setPlanStatus] = useState<PlanStatus | null>(null);
  const [executionStatus, setExecutionStatus] =
    useState<ExecutionStatus | null>(null);
  const [history, setHistory] = useState<ExecutionHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadMonitor = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [planResult, executionResult, historyResult] =
        await Promise.all([
          getPlanStatus(),
          getExecutionStatus(),
          getExecutionHistory()
        ]);

      if (!planResult.success || !executionResult.success) {
        throw new Error("Monitor API returned a protected failure");
      }

      setPlanStatus(planResult.status || null);
      setExecutionStatus(executionResult.status || null);
      setHistory(historyResult.items || []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "تعذر قراءة بيانات المراقبة"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (active === "plans" || active === "execution" || active === "overview") {
      void loadMonitor();
    }
  }, [active, loadMonitor]);

  const activeSection = sections.find((item) => item.id === active);
  const monitorVisible = active === "plans" || active === "execution";

  return (
    <div className="app-shell" dir="rtl">
      <header className="topbar">
        <div>
          <div className="brand">Agent Control Center</div>
          <div className="subtitle">مركز التحكم الآمن بالوكيل</div>
        </div>
        <div className="status">
          <span className="status-dot" />
          <span>Online</span>
        </div>
      </header>

      <main className="content">
        <section className="hero">
          <div>
            <span className="eyebrow">CENTRAL CORE</span>
            <h1>{activeSection?.label}</h1>
            <p>
              جميع العمليات تمر عبر طبقات التحقق والموافقة والتنفيذ الآمن.
            </p>
          </div>
        </section>

        <section className="grid">
          <article className="card">
            <span className="card-label">حالة الوكيل</span>
            <strong>جاهز</strong>
            <small>Runtime operational</small>
          </article>

          <article className="card">
            <span className="card-label">الخطط المسجلة</span>
            <strong>{planStatus?.plans ?? "—"}</strong>
            <small>{statusLabel(planStatus?.status)}</small>
          </article>

          <article className="card">
            <span className="card-label">التنفيذ</span>
            <strong>{executionStatus?.executed ?? "—"}</strong>
            <small>عمليات مسجلة</small>
          </article>

          <article className="card">
            <span className="card-label">التنفيذ الذاتي</span>
            <strong>معطل</strong>
            <small>Autonomous execution disabled</small>
          </article>
        </section>

        {monitorVisible ? (
          <section className="monitor-stack">
            <section className="workspace">
              <div className="workspace-header">
                <span>Plan Registry</span>
                <span className="protected">READ ONLY</span>
              </div>

              <div className="monitor-body">
                <div className="monitor-row">
                  <span>الحالة</span>
                  <strong>{statusLabel(planStatus?.status)}</strong>
                </div>
                <div className="monitor-row">
                  <span>الإصدار</span>
                  <strong>{planStatus?.version || "—"}</strong>
                </div>
                <div className="monitor-row">
                  <span>عدد الخطط</span>
                  <strong>{planStatus?.plans ?? "—"}</strong>
                </div>
              </div>
            </section>

            <section className="workspace">
              <div className="workspace-header">
                <span>Execution Monitor</span>
                <span className="protected">READ ONLY</span>
              </div>

              <div className="monitor-body">
                <div className="monitor-row">
                  <span>الحالة</span>
                  <strong>{statusLabel(executionStatus?.status)}</strong>
                </div>
                <div className="monitor-row">
                  <span>التنفيذات</span>
                  <strong>{executionStatus?.executed ?? "—"}</strong>
                </div>
                <div className="monitor-row">
                  <span>السجل</span>
                  <strong>{executionStatus?.history ?? history.length}</strong>
                </div>
              </div>
            </section>

            <section className="workspace">
              <div className="workspace-header">
                <span>Execution History</span>
                <span className="protected">READ ONLY</span>
              </div>

              <div className="history-list">
                {history.length === 0 ? (
                  <div className="empty-state">
                    لا توجد عمليات مسجلة للعرض.
                  </div>
                ) : (
                  history.map((item, index) => (
                    <article className="history-item" key={index}>
                      <strong>
                        {String(
                          item.planId ??
                            item.plan ??
                            item.name ??
                            `عملية ${index + 1}`
                        )}
                      </strong>
                      <small>
                        {String(
                          item.status ??
                            item.result ??
                            item.outcome ??
                            "سجل تنفيذ"
                        )}
                      </small>
                    </article>
                  ))
                )}
              </div>
            </section>

            {error ? <div className="error-state">{error}</div> : null}

            <button
              className="refresh-button"
              type="button"
              onClick={() => void loadMonitor()}
              disabled={loading}
            >
              {loading ? "جارٍ التحديث..." : "تحديث البيانات"}
            </button>
          </section>
        ) : (
          <section className="workspace">
            <div className="workspace-header">
              <span>Control Surface</span>
              <span className="protected">PROTECTED</span>
            </div>

            <div className="workspace-body">
              <div className="placeholder-icon">{activeSection?.icon}</div>
              <h2>{activeSection?.label}</h2>
              <p>
                هذه الطبقة تعرض الحالة والبيانات فقط. لا توجد هنا أي قناة تنفيذ
                مباشر.
              </p>
            </div>
          </section>
        )}
      </main>

      <nav className="bottom-nav" aria-label="Control Center navigation">
        {sections.map((section) => (
          <button
            key={section.id}
            className={active === section.id ? "nav-item active" : "nav-item"}
            onClick={() => setActive(section.id)}
            type="button"
          >
            <span>{section.icon}</span>
            <small>{section.label}</small>
          </button>
        ))}
      </nav>
    </div>
  );
}

export default App;
