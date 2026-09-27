const crypto = require("node:crypto");
require("../config");
const RevenueEngine = require("../revenue");
const ApprovalQueue = require("../approval");
const ExecutionGate = require("../security/execution-gate");
const ConnectorGateway = require("../connector-gateway");
"use strict";

const Master = require("../agents/master");
const PlanVerificationGate = require("../phase21");
const HumanApprovalGate = require("../phase22");
const SessionStateManager = require("../session-state");
const SettingsService = require("../settings");
const AbuBashaPod = require("../agents/pods/abu-basha");

const ConnectorPolicy = require("../connector-policy");
const PlanExecutor = require("../plan-executors");
const PlanRegistry = require("../plan-registry");
const DiagnosticCenter = require("../diagnostic-center");
const QualityProvider = require("../diagnostic-center/providers/quality-provider");

const DeveloperToolRegistry = require("../developer-tools");
const AppBuilderExecutor = require("../executors/app-builder-executor");
const DevelopmentPipelineService = require("../development-pipeline");
const DevelopmentPipelineExecutor = require("../development-pipeline/executor");
const ProjectWorkspaceService = require("../project-workspace");
const {
  createDefaultDeveloperPlatform
} = require("../developer-platform");
const ConnectorHub = require("../connectors/hub");
const HubMockConnector = require("../connectors/hub/mock-connector");
const ConnectorResolver = require("../connectors/resolver");
const GeminiAdapter = require("../connectors/adapters/gemini-adapter");
const DeveloperPlatformConnector = require("../connectors/adapters/developer-platforms");
const VoiceCapability = require("../capabilities/voice");
const GeminiTTSAdapter = require("../connectors/adapters/gemini-tts-adapter");
const GeminiSTTAdapter = require("../connectors/adapters/gemini-stt-adapter");
const AbuBashaAgentsOrchestrator = require("./agents-orchestrator");
const ResilienceManager = require("../resilience");
const AuditStore = require("../observability/audit-store");
class AgentRuntime {
  constructor(options = {}) {
    const projectRoot = options.projectRoot || process.cwd();
    const sessionStateOptions = options.dbPath
      ? { dbPath: options.dbPath }
      : {};

    // Phase 23: Host Context is optional for backward compatibility.
    // Legacy Termux/CLI execution continues to use process.cwd().
    this.projectRoot = projectRoot;


    // Phase 3: safe Master + Abu Basha Runtime ownership
    this.master = new Master();
    this.verificationGate = new PlanVerificationGate(this);
    this.approvalGate = new HumanApprovalGate(this);
    this.sessionState = new SessionStateManager(sessionStateOptions);
    this.settings = new SettingsService({
      projectRoot: this.projectRoot
    });
    this.auditStore = new AuditStore({ dbPath: this.sessionState.dbPath });
    this.abuBashaPod = new AbuBashaPod({ mode: this.master.mode });
    this.master.registerPod("abu-basha", this.abuBashaPod);

    // Safety boundary: external execution remains disabled.
    if (this.master.externalExecution === true) {
      throw new Error(
        "Phase 3 safety violation: Master external execution enabled."
      );
    }

    if (this.abuBashaPod.externalExecution === true) {
      throw new Error(
        "Phase 3 safety violation: Abu Basha external execution enabled."
      );
    }


    this.connectorPolicy = new ConnectorPolicy();
    this.revenue = new RevenueEngine();

    this.diagnosticCenter = new DiagnosticCenter();

    this.approvals = new ApprovalQueue();

    // Smart Retry request identity / deduplication.
    // Bounded in-memory state; no execution capability is added.
    this.chatRequests = new Map();
    this.chatRequestMaxEntries = 200;

    // Chat-only logical cancellation markers.
    // Bounded in-memory state; no approval/execution capability is added.
    this.chatCancellations = new Map();
    this.chatCancellationMaxEntries = 200;

    this.executionGate = new ExecutionGate({
      externalExecution: false,
      failClosed: true
    });

    this.developerTools = new DeveloperToolRegistry(this.executionGate);
    this.appBuilderExecutor = new AppBuilderExecutor(this);
    this.developmentPipeline = new DevelopmentPipelineService();
    this.developmentPipelineExecutor = new DevelopmentPipelineExecutor({
      projectRoot: this.projectRoot,
      executionGate: this.executionGate,
      failClosed: true,
      externalExecution: false,
      autonomousExecution: false,
      requiresApproval: true,
    });
    this.projectWorkspace = new ProjectWorkspaceService();

    /*
     * PHASE31 CANONICAL DEVELOPMENT PIPELINE TOOL
     *
     * Canonical execution path:
     * ApprovalQueue
     *   -> Runtime.executeApproved()
     *   -> PlanExecutor
     *   -> DeveloperExecutor
     *   -> DeveloperToolRegistry
     *   -> DevelopmentPipelineExecutor
     *
     * The tool accepts only the already server-bound
     * pipelineRequest supplied by the canonical plan.
     *
     * No client-controlled action/workspace/projectId is selected here.
     */
    const developmentPipelineToolRegistration =
      this.developerTools.register(
        "development_pipeline",
        {
          execute: async (payload = {}, context = {}) => {
            const pipelineRequest =
              payload &&
              payload.pipelineRequest &&
              typeof payload.pipelineRequest === "object"
                ? payload.pipelineRequest
                : null;

            if (!pipelineRequest) {
              return {
                success: false,
                type: "development_pipeline_request_missing",
                executionAllowed: false,
                failClosed: true
              };
            }

            const approved =
              !!(
                context &&
                context.options &&
                context.options.approved === true
              );

            if (!approved) {
              return {
                success: false,
                type: "approval_required",
                executionAllowed: false,
                failClosed: true
              };
            }

            return this.developmentPipelineExecutor.execute(
              pipelineRequest,
              {
                approved: true,
                approvalId:
                  context &&
                  context.options &&
                  typeof context.options.approvalId === "string"
                    ? context.options.approvalId
                    : null,
                source: "plan_executor"
              }
            );
          }
        },
        {
          enabled: true,
          category: "developer",
          description:
            "Canonical approved development pipeline execution boundary",
          requiresApproval: true
        }
      );

    if (
      !developmentPipelineToolRegistration ||
      developmentPipelineToolRegistration.success !== true
    ) {
      throw new Error(
        "Phase31: development_pipeline tool registration failed."
      );
    }

    const developerPlatform = createDefaultDeveloperPlatform({
      registry: this.developerTools,
      rootDir: projectRoot
    });

    if (!developerPlatform.success) {
      throw new Error(
        `Developer Platform bootstrap failed: ${developerPlatform.type}`
      );
    }

    this.developerPlatform = developerPlatform;

    this.connectorHub = new ConnectorHub();

    this.connectorResolver = new ConnectorResolver(this.connectorHub);
    this.connectorGateway = new ConnectorGateway({
      hub: this.connectorHub,
      resolver: this.connectorResolver,
      policy: this.connectorPolicy,
      executionGate: this.executionGate,
        auditStore: this.auditStore
    });



    // PHASE2_MOCK_BOOTSTRAP
    // PHASE 2 FINAL CONNECTOR BOOTSTRAP
    // Keep Manager, Executor, Hub, Resolver and Policy synchronized.    // Gemini AI Connector
    // Manual model selection is sourced from the validated persistent SettingsService.
    // The Gemini adapter still resolves the selected model through ModelRouter/ModelRegistry.
    const settingsSnapshot =
      this.settings && typeof this.settings.get === "function"
        ? this.settings.get()
        : null;

    const configuredGeminiModel =
      settingsSnapshot &&
      settingsSnapshot.success === true &&
      settingsSnapshot.settings &&
      settingsSnapshot.settings.ai &&
      typeof settingsSnapshot.settings.ai.model === "string"
        ? settingsSnapshot.settings.ai.model
        : null;

    const geminiConnector = new GeminiAdapter({
      defaultModel: configuredGeminiModel
    });
    this.voiceCapability = new VoiceCapability();
    this.ttsProvider = new GeminiTTSAdapter();
    this.voiceCapability.setTTSProvider(this.ttsProvider);
    this.sttProvider = new GeminiSTTAdapter();
    this.voiceCapability.setSTTProvider(this.sttProvider);
    this.geminiResilience = new ResilienceManager(this);
    this.geminiAdapter = geminiConnector;

    // OpenAI Agents SDK orchestration over the existing Gemini + Resilience path.
    this.agentsOrchestrator =
      new AbuBashaAgentsOrchestrator({
        executeModel: async (prompt, request) => {
          const resilienceResult =
            await this.geminiResilience.execute(
              () =>
                this.geminiAdapter.execute(
                  {
                    prompt
                  },
                  {
                    channel: "chat",
                    intent: "conversation",
                    ...(request && request.context
                      ? request.context
                      : {})
                  }
                ),
              {
                channel: "chat",
                intent: "conversation",
                sessionId:
                  request &&
                  request.context &&
                  request.context.sessionId
                    ? request.context.sessionId
                    : null
              }
            );

          if (
            !resilienceResult ||
            resilienceResult.success !== true
          ) {
            return {
              success: false,
              type:
                resilienceResult &&
                resilienceResult.type
                  ? resilienceResult.type
                  : "chat_inference_failed",
              resilience: resilienceResult
            };
          }

          const inferenceResult =
            resilienceResult.result;

          if (
            !inferenceResult ||
            inferenceResult.success !== true
          ) {
            return {
              success: false,
              type:
                inferenceResult &&
                inferenceResult.type
                  ? inferenceResult.type
                  : "chat_inference_failed",
              result: inferenceResult || null,
              resilience: resilienceResult
            };
          }

          return {
            success: true,
            text: inferenceResult.text || "",
            model: inferenceResult.model || null,
            result: inferenceResult,
            resilience: resilienceResult
          };
        }
      });

    this.registerConnector(
      "gemini",
      geminiConnector,
      {
        category: "ai",
        description: "Google Gemini AI connector",
        version: "1.0.0",
        enabled: true,
        requiresApproval: true,
        externalExecution: true
      }
    );



    const mockConnector = new HubMockConnector("mock");

    this.registerConnector(
      "mock",
      mockConnector,
      {
        category: "system",
        description: "Safe simulated connector",
        version: "1.0.0",
        enabled: true,
        requiresApproval: false
      }
    );

    this.connectorResolver.register(
      "plan_execution",
      "mock"
    );

    this.connectorResolver.register(
      "execution",
      "mock"
    );

    this.connectorResolver.register(
      "gemini",
      "gemini"
    );

    // Phase 28: fail-closed developer-platform connector contracts.
    // These definitions do not enable external execution.
    const githubConnector = new DeveloperPlatformConnector("github", {
      provider: "GitHub",
      envKey: "GITHUB_TOKEN"
    });

    const gitlabConnector = new DeveloperPlatformConnector("gitlab", {
      provider: "GitLab",
      envKey: "GITLAB_TOKEN"
    });

    this.registerConnector(
      "github",
      githubConnector,
      {
        category: "developer",
        description: "GitHub developer platform connector contract",
        version: "1.0.0",
        enabled: true,
        requiresApproval: true,
        externalExecution: true
      }
    );

    this.registerConnector(
      "gitlab",
      gitlabConnector,
      {
        category: "developer",
        description: "GitLab developer platform connector contract",
        version: "1.0.0",
        enabled: true,
        requiresApproval: true,
        externalExecution: true
      }
    );

    this.connectorResolver.register("github", "github");
    this.connectorResolver.register("gitlab", "gitlab");

    this.connectorPolicy.allowConnector("gemini");
    // Phase 28: provider connectors are policy-approved for their explicit read-only allowlisted operations; external execution remains gated.
    this.connectorPolicy.allowConnector("github");
    this.connectorPolicy.allowConnector("gitlab");



    this.planExecutor = new PlanExecutor(this);
    this.planExecutor.auditStore = this.auditStore;
    this.planRegistry = new PlanRegistry();
    this.master.attachPlanRegistry(this.planRegistry);

    this.startedAt = new Date().toISOString();
  }

  registerConnector(name, connector, metadata = {}) {
    /*
     * CANONICAL CONNECTOR REGISTRATION
     *
     * ConnectorHub is the single source of truth.
     * Resolver and Gateway consume the same Hub registry.
     */
    if (!this.connectorHub) {
      return {
        success: false,
        type: "connector_hub_unavailable"
      };
    }

    return this.connectorHub.register(
      name,
      connector,
      metadata
    );
  }
  unregisterConnector(name) {
    if (!this.connectorHub) return false;
    return this.connectorHub.unregister(name);
  }

  enableConnector(name) {
    const entry = this.connectorHub
      ? this.connectorHub.get(name)
      : null;

    if (!entry) return false;

    entry.metadata.enabled = true;
    return true;
  }

  disableConnector(name) {
    const entry = this.connectorHub
      ? this.connectorHub.get(name)
      : null;

    if (!entry) return false;

    entry.metadata.enabled = false;
    return true;
  }

  // =================================
  // Revenue Bridge
  // =================================

  listRevenueOpportunities() {
    return this.revenue.listOpportunities();
  }

  createRevenuePlan(opportunityId) {
    const opportunity = this.revenue
      .listOpportunities()
      .find(item => item.id === opportunityId);

    if (!opportunity) {
      return {
        success: false,
        type: "revenue_opportunity_not_found",
        message: "فرصة الربح غير موجودة"
      };
    }

    return this.revenue.createPlan(opportunityId);
  }

  getRevenuePlans() {
    return this.revenue.getPlans();
  }

  getRevenueStatus() {
    return this.revenue.getStatus();
  }


  async execute(action, payload = {}, options = {}) {
    return {
      success: false,
      type: "legacy_runtime_execution_disabled",
      executionAllowed: false,
      message:
        "مسار Runtime.execute القديم مغلق. استخدم المسار الموحد عبر PlanExecutor."
    };
  }
  /**
   * Canonical Control Center chat path.
   *
   * Chat NEVER executes Gemini directly.
   * Flow:
   *   user prompt
   *     -> Chat Plan
   *     -> Approval Queue
   *     -> explicit Runtime.approve()
   *     -> executeApproved()
   *     -> PlanExecutor
   *     -> ExecutionExecutor
   *     -> ConnectorGateway
   *     -> Gemini
   */
  createChatApproval(prompt, options = {}) {
    const text = typeof prompt === "string" ? prompt.trim() : "";

    if (!text) {
      return {
        success: false,
        type: "invalid_chat_prompt",
        message: "طلب الدردشة فارغ."
      };
    }

    const injectionDefense =
      this.injectionDefense ||
      (this.geminiAdapter && this.geminiAdapter.injectionDefense) ||
      null;

    if (
      injectionDefense &&
      typeof injectionDefense.inspect === "function"
    ) {
      const inspection = injectionDefense.inspect(text);

      if (!inspection || inspection.safe !== true) {
        return {
          success: false,
          type: "chat_input_rejected",
          executionAllowed: false,
          approvalRequired: true,
          failClosed: true
        };
      }
    }

    const chatPlanId = "chat_response";

    if (
      !this.planRegistry ||
      typeof this.planRegistry.register !== "function" ||
      typeof this.planRegistry.get !== "function"
    ) {
      return {
        success: false,
        type: "chat_plan_registry_unavailable",
        executionAllowed: false,
        failClosed: true
      };
    }

    if (!this.planRegistry.has(chatPlanId)) {
      const registration = this.planRegistry.register(chatPlanId, {
        name: "Chat Response",
        category: "ai",
        steps: [
          {
            name: "generate_response",
            label: "توليد رد الدردشة",
            type: "execution",
            tool: "gemini"
          }
        ]
      });

      if (!registration || registration.success !== true) {
        return {
          success: false,
          type: "chat_plan_registration_failed",
          executionAllowed: false,
          failClosed: true
        };
      }
    }

    const plan = {
      id: chatPlanId,
      name: "Chat Response",
      category: "ai",
      opportunityId: "chat",
      target: options.target || "user",
      goal: text,
      chatPromptHash: crypto
        .createHash("sha256")
        .update(text, "utf8")
        .digest("hex"),
      steps: this.planRegistry.get(chatPlanId).steps
    };

    const approval = this.createApproval(plan);

    if (!approval || approval.success !== true) {
      return {
        success: false,
        type: "chat_approval_creation_failed",
        executionAllowed: false,
        failClosed: true
      };
    }

    return {
      success: true,
      type: "chat_approval_required",
      approvalRequired: true,
      approved: false,
      executionAllowed: false,
      externalExecution: false,
      autonomousExecution: false,
      approval: approval.item,
      plan,
      message: "تم تجهيز رد الدردشة وينتظر موافقة المستخدم."
    };
  }

  async executeApprovedChat(approvalId, prompt, options = {}) {
    const text = typeof prompt === "string" ? prompt.trim() : "";

    if (!approvalId || !text) {
      return {
        success: false,
        type: "invalid_chat_execution_request",
        executionAllowed: false,
        failClosed: true
      };
    }

    const approval = this.approvals.getAll().find(
      item => item && item.id === approvalId
    );

    if (!approval) {
      return {
        success: false,
        type: "approval_not_found",
        executionAllowed: false
      };
    }

    if (approval.status !== "approved") {
      return {
        success: false,
        type: "approval_required",
        approvalRequired: true,
        approved: false,
        executionAllowed: false,
        failClosed: true
      };
    }

    const approvedChatPromptHash =
      approval.plan &&
      typeof approval.plan.chatPromptHash === "string"
        ? approval.plan.chatPromptHash
        : null;

    const requestedChatPromptHash = crypto
      .createHash("sha256")
      .update(text, "utf8")
      .digest("hex");

    if (
      !approvedChatPromptHash ||
      approvedChatPromptHash !== requestedChatPromptHash
    ) {
      return {
        success: false,
        type: "chat_prompt_mismatch",
        approvalRequired: true,
        approved: false,
        executionAllowed: false,
        failClosed: true
      };
    }

    return this.executeApproved(
      approvalId,
      "chat_response",
      {
        prompt: text
      },
      {
        ...options,
        connector: "gemini",
        requiresApproval: true,
        approved: true
      }
    );
  }

  /**
   * E1.6-A
   * Classify the user's request before choosing a chat path.
   *
   * This classifier is intentionally conservative:
   * - ordinary conversation stays conversation
   * - explicit external-action language becomes an action proposal
   * - proposals never execute by themselves
   */
  classifyChatIntent(prompt) {
    const text = typeof prompt === "string" ? prompt.trim() : "";

    if (!text) {
      return {
        success: false,
        type: "invalid_chat_prompt"
      };
    }

    const normalized = text.toLowerCase();

    const actionVerbs = [
      "انشر",
      "نشر",
      "أرسل",
      "ارسل",
      "إرسال",
      "ارسال",
      "احذف",
      "حذف",
      "عدّل",
      "عدل",
      "تعديل",
      "حدّث",
      "حدث",
      "تحديث",
      "ارفع",
      "رفع",
      "حمّل",
      "حمل",
      "تحميل",
      "publish",
      "post",
      "send",
      "delete",
      "remove",
      "update",
      "upload"
    ];

    const externalTargets = [
      "فيسبوك",
      "facebook",
      "انستغرام",
      "إنستغرام",
      "instagram",
      "واتساب",
      "whatsapp",
      "تيليجرام",
      "telegram",
      "يوتيوب",
      "youtube",
      "تيك توك",
      "tiktok"
    ];

    const hasActionVerb = actionVerbs.some(
      verb => normalized.includes(verb)
    );

    const hasExternalTarget = externalTargets.some(
      target => normalized.includes(target)
    );

    const actionIntent = hasActionVerb && hasExternalTarget;

    if (!actionIntent) {
      return {
        success: true,
        intent: "conversation",
        approvalRequired: false,
        executionAllowed: false,
        externalExecution: false
      };
    }

    return {
      success: true,
      intent: "action",
      approvalRequired: true,
      executionAllowed: false,
      externalExecution: true,
      executable: false,
      proposal: {
        type: "action_proposal",
        prompt: text,
        requiresApproval: true,
        approvalRequired: true,
        executionAllowed: false,
        externalExecution: true,
        executable: false,
        detected: {
          hasActionVerb,
          hasExternalTarget
        }
      }
    };
  }

  /**
   * E1.6-A
   * Direct conversational inference.
   *
   * This is inference only. It does not create approval and does not
   * enter ConnectorGateway / PlanExecutor / external execution.
   */
  async transcribeVoice(audio, context = {}) {
    if (!this.voiceCapability || typeof this.voiceCapability.transcribe !== "function") {
      return {
        success: false,
        type: "stt_capability_unavailable",
        message: "Voice transcription capability is unavailable.",
        executionAllowed: false,
        externalExecution: false,
        actionExecution: "plan_only",
        requiresApproval: true,
        failClosed: true,
      };
    }

    try {
      const result = await this.voiceCapability.transcribe(audio, context);

      return result && typeof result === "object"
        ? result
        : {
            success: false,
            type: "stt_invalid_result",
            message: "Voice transcription returned an invalid result.",
            executionAllowed: false,
            externalExecution: false,
            actionExecution: "plan_only",
            requiresApproval: true,
            failClosed: true,
          };
    } catch (error) {
      return {
        success: false,
        type: "stt_runtime_failed",
        message: error instanceof Error
          ? error.message
          : "Voice transcription failed.",
        executionAllowed: false,
        externalExecution: false,
        actionExecution: "plan_only",
        requiresApproval: true,
        failClosed: true,
      };
    }
  }

async synthesizeVoice(text, options = {}) {
    if (
      !this.voiceCapability ||
      typeof this.voiceCapability.synthesize !== "function"
    ) {
      return {
        success: false,
        type: "voice_capability_unavailable",
        executionAllowed: false,
        externalExecution: false,
        actionExecution: "presentation_only",
        requiresApproval: true,
        failClosed: true
      };
    }

    const result =
      await this.voiceCapability.synthesize(text, options);

    const messageId =
      options &&
      typeof options.messageId === "string"
        ? options.messageId.trim()
        : "";

    if (!messageId) {
      throw new Error("TTS messageId is required");
    }

    if (!result || typeof result !== "object") {
      throw new Error("Invalid TTS synthesis result");
    }

    return {
      ...result,
      messageId
    };
  }

  async cancelChat(requestId) {
    const id =
      typeof requestId === "string"
        ? requestId.trim()
        : "";

    if (!id) {
      return {
        success: false,
        type: "invalid_chat_cancel_request",
        executionAllowed: false,
        externalExecution: false,
        failClosed: true,
        message: "معرّف طلب المحادثة مطلوب."
      };
    }

    this.chatCancellations.set(id, {
      cancelledAt: Date.now()
    });

    while (
      this.chatCancellations.size >
      this.chatCancellationMaxEntries
    ) {
      const oldest =
        this.chatCancellations.keys().next().value;

      if (oldest === undefined) {
        break;
      }

      this.chatCancellations.delete(oldest);
    }

    return {
      success: true,
      type: "chat_generation_cancelled",
      message: "تم إلغاء توليد المحادثة.",
      intent: "conversation",
      approvalRequired: false,
      executionAllowed: false,
      externalExecution: false,
      cancelled: true,
      failClosed: true,
      requestId: id
    };
  }

  async *chatStream(prompt, options = {}) {
    const text =
      typeof prompt === "string"
        ? prompt.trim()
        : "";

    const requestId =
      typeof options.requestId === "string" &&
      options.requestId.trim()
        ? options.requestId.trim()
        : null;

    const sessionId =
      typeof options.sessionId === "string" &&
      options.sessionId.trim()
        ? options.sessionId.trim()
        : null;

    const cancelled = () => ({
      success: false,
      type: "chat_generation_cancelled",
      message: "تم إلغاء توليد المحادثة.",
      intent: "conversation",
      approvalRequired: false,
      executionAllowed: false,
      externalExecution: false,
      cancelled: true,
      failClosed: true,
      requestId
    });

    const isCancelled = () =>
      !!(
        requestId &&
        this.chatCancellations &&
        this.chatCancellations.has(requestId)
      );

    if (!text) {
      yield {
        success: false,
        type: "invalid_chat_prompt",
        executionAllowed: false,
        externalExecution: false,
        failClosed: true
      };
      return;
    }

    if (isCancelled()) {
      yield cancelled();
      return;
    }

    const intent = this.classifyChatIntent(text);

    if (!intent.success) {
      yield {
        success: false,
        type: intent.type,
        executionAllowed: false,
        externalExecution: false,
        failClosed: true
      };
      return;
    }

    // Streaming is informational-chat only.
    // Action proposals remain on the canonical approval path.
    if (intent.intent === "action") {
      yield {
        success: true,
        type: "action_proposal",
        intent: "action",
        approvalRequired: true,
        executionAllowed: false,
        externalExecution: true,
        executable: false,
        proposal: intent.proposal
      };
      return;
    }

    let conversationHistory = [];

    if (sessionId) {
      try {
        this.sessionState.createSession(sessionId, {
          channel: "chat_stream"
        });

        conversationHistory =
          this.sessionState.getConversationHistory(
            sessionId,
            20
          );

        if (!Array.isArray(conversationHistory)) {
          yield {
            success: false,
            type: "conversation_state_unavailable",
            intent: "conversation",
            approvalRequired: false,
            executionAllowed: false,
            externalExecution: false,
            failClosed: true,
            requestId,
            sessionId,
            message: "تعذر تحميل سياق الجلسة."
          };
          return;
        }
      } catch (error) {
        yield {
          success: false,
          type: "conversation_state_load_failed",
          intent: "conversation",
          approvalRequired: false,
          executionAllowed: false,
          externalExecution: false,
          failClosed: true,
          requestId,
          sessionId,
          message:
            error?.message
              ? String(error.message)
              : String(error)
        };
        return;
      }
    }

    if (
      !this.geminiAdapter ||
      typeof this.geminiAdapter.openStream !== "function"
    ) {
      yield {
        success: false,
        type: "streaming_unavailable",
        intent: "conversation",
        approvalRequired: false,
        executionAllowed: false,
        externalExecution: false,
        failClosed: true,
        message: "مسار Streaming غير متاح."
      };
      return;
    }

    let emittedText = "";

    try {
      const resilienceResult =
        await this.geminiResilience.execute(
          () =>
            this.geminiAdapter.openStream(
              {
                prompt: text,
                ...(conversationHistory.length
                  ? { conversationHistory }
                  : {})
              },
              {
                sessionId,
                requestId
              }
            ),
          {
            channel: "chat_stream",
            intent: "conversation",
            sessionId,
            requestId
          }
        );

      if (
        !resilienceResult ||
        resilienceResult.success !== true ||
        !resilienceResult.result ||
        resilienceResult.result.success !== true ||
        !resilienceResult.result.stream
      ) {
        const failed =
          resilienceResult?.result || resilienceResult;

        yield {
          success: false,
          type:
            failed?.type ||
            "chat_stream_failed",
          intent: "conversation",
          approvalRequired: false,
          executionAllowed: false,
          externalExecution: false,
          failClosed: true,
          requestId,
          retryable:
            failed?.retryable === true,
          message:
            failed?.message ||
            "فشل فتح قناة Streaming."
        };
        return;
      }

      for await (const chunk of resilienceResult.result.stream) {
        if (isCancelled()) {
          yield cancelled();
          return;
        }

        if (!chunk || chunk.success !== true) {
          yield {
            success: false,
            type:
              chunk?.type ||
              "chat_stream_failed",
            intent: "conversation",
            approvalRequired: false,
            executionAllowed: false,
            externalExecution: false,
            failClosed: true,
            message:
              chunk?.message ||
              "فشل توليد Streaming."
          };
          return;
        }

        if (chunk.type === "gemini_stream_chunk") {
          const delta =
            typeof chunk.text === "string"
              ? chunk.text
              : "";

          if (!delta) {
            continue;
          }

          emittedText += delta;

          yield {
            success: true,
            type: "conversation_stream_chunk",
            intent: "conversation",
            approvalRequired: false,
            executionAllowed: false,
            externalExecution: false,
            requestId,
            ...(sessionId ? { sessionId } : {}),
            text: delta,
            done: false
          };
          continue;
        }

        if (chunk.type === "gemini_stream_end") {
          if (sessionId) {
            try {
              const userTurn =
                this.sessionState.appendConversationTurn(
                  sessionId,
                  "user",
                  text
                );

              if (!userTurn || userTurn.success !== true) {
                yield {
                  success: false,
                  type: "conversation_state_persistence_failed",
                  intent: "conversation",
                  approvalRequired: false,
                  executionAllowed: false,
                  externalExecution: false,
                  failClosed: true,
                  requestId,
                  sessionId,
                  message: "تعذر حفظ رسالة المستخدم في سياق الجلسة."
                };
                return;
              }

              if (emittedText.trim()) {
                const assistantTurn =
                  this.sessionState.appendConversationTurn(
                    sessionId,
                    "assistant",
                    emittedText
                  );

                if (
                  !assistantTurn ||
                  assistantTurn.success !== true
                ) {
                  yield {
                    success: false,
                    type: "conversation_state_persistence_failed",
                    intent: "conversation",
                    approvalRequired: false,
                    executionAllowed: false,
                    externalExecution: false,
                    failClosed: true,
                    requestId,
                    sessionId,
                    message: "تعذر حفظ رد المساعد في سياق الجلسة."
                  };
                  return;
                }
              }
            } catch (error) {
              yield {
                success: false,
                type: "conversation_state_persistence_failed",
                intent: "conversation",
                approvalRequired: false,
                executionAllowed: false,
                externalExecution: false,
                failClosed: true,
                requestId,
                sessionId,
                message:
                  error?.message
                    ? String(error.message)
                    : String(error)
              };
              return;
            }
          }

          yield {
            success: true,
            type: "conversation_stream_end",
            intent: "conversation",
            approvalRequired: false,
            executionAllowed: false,
            externalExecution: false,
            requestId,
            ...(sessionId ? { sessionId } : {}),
            text: emittedText,
            done: true
          };
          return;
        }
      }
    } catch (error) {
      if (isCancelled()) {
        yield cancelled();
        return;
      }

      yield {
        success: false,
        type: "chat_stream_failed",
        intent: "conversation",
        approvalRequired: false,
        executionAllowed: false,
        externalExecution: false,
        failClosed: true,
        requestId,
        message:
          error?.message
            ? String(error.message)
            : String(error)
      };
    }
  }

  async chat(prompt, options = {}) {
    const text =
      typeof prompt === "string"
        ? prompt.trim()
        : "";

    if (!text) {
      return {
        success: false,
        type: "invalid_chat_prompt",
        message: "طلب الدردشة فارغ.",
        executionAllowed: false,
        externalExecution: false,
        failClosed: true
      };
    }

    const requestId =
      typeof options.requestId === "string"
        ? options.requestId.trim()
        : "";

    const sessionId =
      typeof options.sessionId === "string"
        ? options.sessionId.trim()
        : "";

    const isChatCancelled = () =>
      !!(
        requestId &&
        this.chatCancellations &&
        this.chatCancellations.has(requestId)
      );

    const cancelledResult = () => ({
      success: false,
      type: "chat_generation_cancelled",
      message: "تم إلغاء توليد المحادثة.",
      intent: "conversation",
      approvalRequired: false,
      executionAllowed: false,
      externalExecution: false,
      cancelled: true,
      failClosed: true,
      requestId: requestId || null
    });

    if (isChatCancelled()) {
      return cancelledResult();
    }

    const requestKey =
      requestId
        ? `chat:${requestId}`
        : null;

    const requestFingerprint = requestKey
      ? crypto
          .createHash("sha256")
          .update(
            JSON.stringify({
              prompt: text,
              sessionId,
              options
            })
          )
          .digest("hex")
      : null;

    if (requestKey && this.chatRequests.has(requestKey)) {
      const existing =
        this.chatRequests.get(requestKey);

      if (
        !existing ||
        existing.fingerprint !== requestFingerprint
      ) {
        return {
          success: false,
          type: "chat_request_id_conflict",
          message:
            "تم رفض إعادة استخدام معرّف طلب المحادثة مع بيانات مختلفة.",
          intent: "conversation",
          approvalRequired: false,
          executionAllowed: false,
          externalExecution: false,
          failClosed: true
        };
      }

      if (existing.promise) {
        return existing.promise;
      }

      if (existing.result) {
        return existing.result;
      }
    }

    if (isChatCancelled()) {
      return cancelledResult();
    }

    const executeChat = async () => {
      const intent =
        this.classifyChatIntent(text);

      if (!intent.success) {
        return {
          success: false,
          type: intent.type,
          executionAllowed: false,
          externalExecution: false,
          failClosed: true
        };
      }

      if (intent.intent === "action") {
        return {
          success: true,
          type: "action_proposal",
          intent: "action",
          approvalRequired: true,
          executionAllowed: false,
          externalExecution: true,
          executable: false,
          proposal: intent.proposal
        };
      }

      if (
        !this.geminiAdapter ||
        typeof this.geminiAdapter.execute !== "function"
      ) {
        return {
          success: false,
          type: "ai_inference_unavailable",
          intent: "conversation",
          approvalRequired: false,
          executionAllowed: false,
          externalExecution: false,
          failClosed: true,
          message:
            "مسار استدلال المحادثة غير متاح."
        };
      }

      let conversationHistory = [];

      if (sessionId) {
        const sessionResult =
          this.sessionState.createSession(
            sessionId,
            {
              channel: "chat"
            }
          );

        if (
          !sessionResult ||
          sessionResult.success !== true
        ) {
          return {
            success: false,
            type: "session_state_unavailable",
            intent: "conversation",
            approvalRequired: false,
            executionAllowed: false,
            externalExecution: false,
            failClosed: true
          };
        }

        conversationHistory =
          this.sessionState.getConversationHistory(
            sessionId,
            20
          );
      }

      const agentsResult =
        await this.agentsOrchestrator.run(
          text,
          {
            conversationHistory,
            context: {
              ...(options.context || {}),
              ...(sessionId
                ? { sessionId }
                : {}),
              ...(requestId
                ? { requestId }
                : {})
            }
          }
        );

      if (isChatCancelled()) {
        return cancelledResult();
      }

      if (
        !agentsResult ||
        agentsResult.success !== true
      ) {
        return {
          success: false,
          type:
            agentsResult &&
            agentsResult.type
              ? agentsResult.type
              : "chat_inference_failed",
          intent: "conversation",
          approvalRequired: false,
          executionAllowed: false,
          externalExecution: false,
          failClosed: true,
          result: agentsResult || null
        };
      }

      if (sessionId) {
        const userTurn =
          this.sessionState.appendConversationTurn(
            sessionId,
            "user",
            text
          );

        const assistantText =
          typeof agentsResult.text === "string"
            ? agentsResult.text.trim()
            : "";

        const assistantTurn =
          assistantText
            ? this.sessionState.appendConversationTurn(
                sessionId,
                "assistant",
                assistantText
              )
            : {
                success: false,
                type: "empty_assistant_turn"
              };

        if (
          !userTurn ||
          userTurn.success !== true ||
          !assistantTurn ||
          assistantTurn.success !== true
        ) {
          return {
            success: false,
            type: "conversation_state_persistence_failed",
            intent: "conversation",
            approvalRequired: false,
            executionAllowed: false,
            externalExecution: false,
            failClosed: true
          };
        }
      }

      return {
        success: true,
        type: "conversation_response",
        intent: "conversation",
        approvalRequired: false,
        executionAllowed: false,
        externalExecution: false,
        text: agentsResult.text || "",
        model: agentsResult.model || null,
        result: agentsResult,
        ...(sessionId
          ? { sessionId }
          : {}),
        ...(requestId
          ? { requestId }
          : {})
      };
    };

    if (!requestKey) {
      return executeChat();
    }

    const promise = executeChat();

    this.chatRequests.set(
      requestKey,
      {
        fingerprint: requestFingerprint,
        promise
      }
    );

    try {
      const result = await promise;

      this.chatRequests.set(
        requestKey,
        {
          fingerprint: requestFingerprint,
          result
        }
      );

      while (
        this.chatRequests.size >
        this.chatRequestMaxEntries
      ) {
        const oldestKey =
          this.chatRequests.keys().next().value;

        if (!oldestKey) {
          break;
        }

        this.chatRequests.delete(
          oldestKey
        );
      }

      return result;
    } catch (error) {
      this.chatRequests.delete(
        requestKey
      );
      throw error;
    }
  }

  /**
   * Backward-compatible AI entry point.
   */
  async askAI(prompt, options = {}) {
    return this.chat(prompt, options);
  }


  async executeApproved(approvalId, action, payload = {}, options = {}) {
    const approval = this.approvals.getAll().find(
      item => item.id === approvalId
    );

    if (!approval) {
      return {
        success: false,
        type: "approval_not_found",
        message: `الموافقة "${approvalId}" غير موجودة.`
      };
    }

    if (approval.status !== "approved") {
      return {
        success: false,
        type: "approval_required",
        message: "لا يمكن التنفيذ قبل موافقة المستخدم."
      };
    }

    /*
     * CANONICAL APPROVED EXECUTION PATH
     *
     * Approved execution must enter PlanExecutor.
     * Do not fall back to the legacy Runtime.execute() path.
     */
    const result = await this.planExecutor.execute(
      approvalId,
      payload,
      options
    );

    return {
      success: result.success === true,
      type: "approved_execution",
      approvalId,
      action,
      result
    };
  }

  async delegateToAbuBashaWithApproval(task = {}) {
    const result = await this.master.delegate(
      task,
      { pod: "abu-basha" }
    );

    if (!result || result.success !== true) {
      return result;
    }

    const plan = {
      id: `abu-basha-${Date.now()}`,
      name: "Abu Basha Delegation",
      type: "pod_delegation",
      pod: "abu-basha",
      task,
      proposal: result.proposal,
      executionAllowed: false,
      externalExecution: false,
      simulationOnly: true
    };

    const registration = this.planRegistry.register(plan.id, {
      name: plan.name,
      category: "pod_delegation",
      steps: [
        {
          name: "approved_pod_delegation",
          label: "تنفيذ التفويض بعد الموافقة",
          type: "control"
        }
      ]
    });

    if (!registration || registration.success !== true) {
      return {
        success: false,
        type: "delegation_plan_registration_failed",
        plan,
        registration
      };
    }

    const verification = this.verificationGate.verify(
      {
        goal: plan.name,
        executable: false,
        externalExecution: plan.externalExecution === true,
        steps: [
          {
            name: "approved_pod_delegation",
            type: "control",
            approvalRequired: true,
            executable: false,
            externalExecution: false
          }
        ]
      },
      {
        source: "master-delegation",
        planId: plan.id,
        pod: "abu-basha"
      }
    );

    if (!verification || verification.verified !== true) {
      return {
        success: false,
        type: "delegation_verification_failed",
        plan,
        registration,
        verification
      };
    }

    const coordination = this.master.prepareApproval({
      success: true,
      type: "plan_pod_proposal",
      planId: result.proposal.planId || plan.id,
      pod: "abu-basha",
      requiresApproval: true,
      executable: false,
      proposal: result.proposal
    });

    if (!coordination || coordination.success !== true) {
      return {
        success: false,
        type: "delegation_approval_coordination_failed",
        proposal: result.proposal,
        coordination
      };
    }

    const approvalRequest = this.approvalGate.requestApproval(
      verification,
      {
        planId: plan.id,
        pod: "abu-basha",
        source: "master-delegation"
      }
    );

    if (
      !approvalRequest ||
      approvalRequest.type !== "approval_request"
    ) {
      return {
        success: false,
        type: "approval_request_failed",
        plan,
        registration,
        verification,
        approvalRequest
      };
    }

    const approval = this.createApproval(plan);

    if (!approval || approval.success !== true) {
      return {
        success: false,
        type: "delegation_approval_failed",
        proposal: result.proposal,
        approval
      };
    }

    return {
      success: true,
      type: "delegation_approval_created",
      pod: "abu-basha",
      proposal: result.proposal,
      coordination,
      approval: approval.item
    };
  }

  // =================================
  // Approval Queue
  // =================================

  async executeApprovedDeveloper(approvalId) {
    const approval = this.approvals.getAll().find(
      item => item.id === approvalId
    );

    if (!approval) {
      return {
        success: false,
        type: "approval_not_found",
        executionAllowed: false,
        failClosed: true,
        message: `الموافقة "${approvalId}" غير موجودة.`
      };
    }

    if (approval.status !== "approved") {
      return {
        success: false,
        type: "approval_required",
        executionAllowed: false,
        failClosed: true,
        message: "لا يمكن تنفيذ مهمة التطوير قبل موافقة المستخدم."
      };
    }

    if (approval.planId !== "developer_coding") {
      return {
        success: false,
        type: "developer_plan_mismatch",
        executionAllowed: false,
        failClosed: true,
        message: "الموافقة لا تخص مسار التطوير البرمجي."
      };
    }

    const task =
      approval.plan &&
      typeof approval.plan.task === "string"
        ? approval.plan.task.trim()
        : "";

    if (!task) {
      return {
        success: false,
        type: "developer_task_missing",
        executionAllowed: false,
        failClosed: true,
        message: "مهمة التطوير غير موجودة داخل الموافقة."
      };
    }

    return this.executeApproved(
      approvalId,
      "developer_coding",
      { task },
      { approved: true }
    );
  }

  getProjectWorkspaceStatus() {
    return this.projectWorkspace.getStatus();
  }

  createProjectWorkspace(request = {}) {
    return this.projectWorkspace.createWorkspace(request);
  }

  getProjectWorkspace(id) {
    return this.projectWorkspace.getWorkspace(id);
  }

  listProjectWorkspaces(type = null) {
    return this.projectWorkspace.listWorkspaces(type);
  }

  getDevelopmentPipelineStatus() {
    if (
      !this.developmentPipeline ||
      typeof this.developmentPipeline.getStatus !== "function"
    ) {
      return {
        success: false,
        type: "development_pipeline_unavailable",
        failClosed: true
      };
    }

    return this.developmentPipeline.getStatus();
  }

  getDevelopmentPipelineExecutorStatus() {
    if (
      !this.developmentPipelineExecutor ||
      typeof this.developmentPipelineExecutor.getStatus !== "function"
    ) {
      return {
        success: false,
        type: "development_pipeline_executor_status",
        failClosed: true,
        executable: false,
      };
    }

    return this.developmentPipelineExecutor.getStatus();
  }

  executeDevelopmentPipeline(request = {}, context = {}) {
    if (
      !this.developmentPipelineExecutor ||
      typeof this.developmentPipelineExecutor.execute !== "function"
    ) {
      return Promise.resolve({
        success: false,
        type: "development_pipeline_execution",
        failClosed: true,
        blocked: true,
        reason: "executor_unavailable",
      });
    }

    return this.developmentPipelineExecutor.execute(request, context);
  }

  createDevelopmentPipelineRequest(request = {}) {
    if (
      !this.developmentPipeline ||
      typeof this.developmentPipeline.createRequest !== "function"
    ) {
      return {
        success: false,
        type: "development_pipeline_unavailable",
        failClosed: true
      };
    }

    return this.developmentPipeline.createRequest(request);
  }

  createDevelopmentPipelineApproval(request = {}) {
    if (
      !request ||
      typeof request !== "object" ||
      Array.isArray(request)
    ) {
      return {
        success: false,
        type: "development_pipeline_approval",
        failClosed: true,
        blocked: true,
        reason: "invalid_request",
      };
    }

    const action =
      typeof request.action === "string" ? request.action.trim() : "";
    const workspace =
      typeof request.workspace === "string" ? request.workspace.trim() : "";
    const projectId =
      typeof request.projectId === "string" ? request.projectId.trim() : "";

    const allowedActions = new Set([
      "build",
      "test",
      "debug",
      "release",
    ]);

    const allowedWorkspaces = new Set([
      "coding",
      "editing",
      "studio",
    ]);

    if (!allowedActions.has(action)) {
      return {
        success: false,
        type: "development_pipeline_approval",
        failClosed: true,
        blocked: true,
        reason: "invalid_action",
      };
    }

    if (!allowedWorkspaces.has(workspace)) {
      return {
        success: false,
        type: "development_pipeline_approval",
        failClosed: true,
        blocked: true,
        reason: "invalid_workspace",
      };
    }

    if (!projectId) {
      return {
        success: false,
        type: "development_pipeline_approval",
        failClosed: true,
        blocked: true,
        reason: "project_id_required",
      };
    }

    const pipelineCreated = this.developmentPipeline.createRequest({
      ...request,
      action,
      workspace,
      projectId,
    });

    if (
      !pipelineCreated ||
      pipelineCreated.success !== true ||
      !pipelineCreated.request ||
      typeof pipelineCreated.request.id !== "string"
    ) {
      return {
        success: false,
        type: "development_pipeline_approval",
        failClosed: true,
        blocked: true,
        reason: "pipeline_request_creation_failed",
      };
    }

    const pipelineRequest = pipelineCreated.request;

    const approvalPlan = {
      id: "development_pipeline",
      name: "Development Pipeline",
      category: "development",
      pipelineRequestId: pipelineRequest.id,
      action,
      workspace,
      projectId,
      steps: [
        {
          action,
          workspace,
          projectId,
        },
      ],
    };

    const approval = this.createApproval(approvalPlan);

    if (!approval || approval.success !== true || !approval.item) {
      return {
        success: false,
        type: "development_pipeline_approval",
        failClosed: true,
        blocked: true,
        reason: "approval_creation_failed",
      };
    }

    return {
      success: true,
      type: "development_pipeline_approval",
      failClosed: true,
      requiresApproval: true,
      approved: false,
      request: pipelineRequest,
      approvalId: approval.item.id,
      approval: approval.item,
    };
  }

  async executeApprovedDevelopmentPipeline(approvalId) {
    if (!approvalId || typeof approvalId !== "string") {
      return {
        success: false,
        type: "invalid_approval_id",
        executionAllowed: false,
        failClosed: true
      };
    }

    const approval = this.approvals.getAll().find(
      item => item && item.id === approvalId
    );

    if (!approval) {
      return {
        success: false,
        type: "approval_not_found",
        executionAllowed: false,
        failClosed: true
      };
    }

    if (approval.status !== "approved") {
      return {
        success: false,
        type: "approval_required",
        approvalRequired: true,
        approved: false,
        executionAllowed: false,
        failClosed: true
      };
    }

    if (approval.planId !== "development_pipeline") {
      return {
        success: false,
        type: "invalid_approval_plan",
        executionAllowed: false,
        failClosed: true
      };
    }

    const plan = approval.plan || {};

    const pipelineRequestId =
      typeof plan.pipelineRequestId === "string"
        ? plan.pipelineRequestId.trim()
        : "";

    const action =
      typeof plan.action === "string"
        ? plan.action.trim().toLowerCase()
        : "";

    const workspace =
      typeof plan.workspace === "string"
        ? plan.workspace.trim().toLowerCase()
        : "";

    const projectId =
      typeof plan.projectId === "string"
        ? plan.projectId.trim()
        : "";

    if (!pipelineRequestId || !action || !workspace || !projectId) {
      return {
        success: false,
        type: "invalid_approval_binding",
        executionAllowed: false,
        failClosed: true
      };
    }

    const stored =
      this.developmentPipeline.getRequest(pipelineRequestId);

    if (
      !stored ||
      stored.success !== true ||
      !stored.request
    ) {
      return {
        success: false,
        type: "pipeline_request_not_found",
        executionAllowed: false,
        failClosed: true
      };
    }

    const pipelineRequest = stored.request;

    if (
      pipelineRequest.id !== pipelineRequestId ||
      pipelineRequest.action !== action ||
      pipelineRequest.workspace !== workspace ||
      pipelineRequest.projectId !== projectId
    ) {
      return {
        success: false,
        type: "approval_binding_mismatch",
        executionAllowed: false,
        failClosed: true
      };
    }

    /*
     * CANONICAL PHASE31 EXECUTION:
     *
     * ApprovalQueue
     * -> Runtime.executeApproved()
     * -> PlanExecutor
     * -> DeveloperExecutor
     * -> DeveloperToolRegistry
     * -> DevelopmentPipelineExecutor
     *
     * The exact binding above is checked BEFORE entering PlanExecutor.
     */
    return this.executeApproved(
      approvalId,
      "development_pipeline",
      {
        pipelineRequest
      },
      {
        approved: true,
        requiresApproval: true,
        approvalId,
        source: "development_pipeline_approval"
      }
    );
  }
  getDevelopmentPipelineRequest(id) {
    if (
      !this.developmentPipeline ||
      typeof this.developmentPipeline.getRequest !== "function"
    ) {
      return {
        success: false,
        type: "development_pipeline_unavailable",
        failClosed: true
      };
    }

    return this.developmentPipeline.getRequest(id);
  }

  listDevelopmentPipelineRequests(limit = 50) {
    if (
      !this.developmentPipeline ||
      typeof this.developmentPipeline.listRequests !== "function"
    ) {
      return {
        success: false,
        type: "development_pipeline_unavailable",
        failClosed: true
      };
    }

    return this.developmentPipeline.listRequests(limit);
  }

  createApproval(plan) {
    return this.approvals.create(plan);
  }

  createDeveloperApproval(request = {}) {
    const plan = this.planRegistry.get("developer_coding");

    if (!plan) {
      return {
        success: false,
        type: "developer_plan_unavailable",
        executionAllowed: false,
        failClosed: true
      };
    }

    const task =
      request && typeof request.task === "string"
        ? request.task.trim()
        : "";

    if (!task) {
      return {
        success: false,
        type: "developer_task_required",
        executionAllowed: false,
        failClosed: true
      };
    }

    const approvalPlan = {
      id: plan.id,
      name: plan.name,
      category: plan.category,
      steps: plan.steps.map(step => ({
        ...step
      })),
      task
    };

    const approval = this.createApproval(approvalPlan);

    if (!approval || approval.success !== true) {
      return {
        success: false,
        type: "developer_approval_creation_failed",
        executionAllowed: false,
        failClosed: true,
        approval: approval || null
      };
    }

    return {
      success: true,
      type: "developer_coding_approval_created",
      approved: false,
      approvalRequired: true,
      executionAllowed: false,
      plan: approvalPlan,
      approval: approval.item || null
    };
  }

  createRevenuePlanWithApproval(opportunityId, target = "online") {
    const result = this.revenue.createPlan(
      opportunityId,
      target
    );

    if (!result || result.success === false) {
      return result;
    }

    this.planRegistry.register(result.plan.id, {
      name: result.plan.name,
      category: "revenue",
      steps: result.plan.steps.map((label, index) => ({
        name: [
          "analyze_opportunity",
          "define_requirements",
          "create_prototype",
          "test_prototype",
          "request_approval",
          "execute_after_approval"
        ][index] || `step_${index + 1}`,
        label,
        type: index === 4 ? "control" : "execution"
      }))
    });

    const approval = this.createApproval(result.plan);

    return {
      success: approval.success === true,
      type: "revenue_plan_approval_created",
      plan: result.plan,
      approval: approval.item || null
    };
  }

  approve(id) {
    return this.approvals.approve(id);
  }

  reject(id) {
    return this.approvals.reject(id);
  }

  getPendingApprovals() {
    return this.approvals.getPending();
  }


  getSettings() {
    if (!this.settings || typeof this.settings.get !== "function") {
      return {
        success: false,
        type: "settings_unavailable",
        failClosed: true
      };
    }

    return this.settings.get();
  }

  getSettingsStatus() {
    if (!this.settings || typeof this.settings.getStatus !== "function") {
      return {
        status: "unavailable",
        type: "settings_service",
        failClosed: true
      };
    }

    return this.settings.getStatus();
  }

  updateSettings(patch, context = {}) {
    if (!this.settings || typeof this.settings.update !== "function") {
      return {
        success: false,
        type: "settings_unavailable",
        failClosed: true
      };
    }

    return this.settings.update(patch, {
      ...context,
      approved: context.approved === true,
      externalExecution: false
    });
  }

  getDiagnosticStatus() {
    if (
      !this.diagnosticCenter ||
      typeof this.diagnosticCenter.getStatus !== "function"
    ) {
      return {
        status: "unavailable",
        type: "diagnostic_center"
      };
    }

    return this.diagnosticCenter.getStatus();
  }

  getDiagnosticReport() {
    if (
      !this.diagnosticCenter ||
      typeof this.diagnosticCenter.getReport !== "function"
    ) {
      return {
        success: false,
        status: "FAIL",
        type: "diagnostic_report_unavailable",
        failClosed: true
      };
    }

    return this.diagnosticCenter.getReport();
  }

  async runDiagnostic(options = {}) {
    if (
      !this.diagnosticCenter ||
      typeof this.diagnosticCenter.run !== "function"
    ) {
      return {
        success: false,
        status: "FAIL",
        type: "diagnostic_run_unavailable",
        failClosed: true
      };
    }

    return this.diagnosticCenter.run(options);
  }

  getPlanRegistryStatus() {
    if (
      !this.planRegistry ||
      typeof this.planRegistry.getStatus !== "function"
    ) {
      return {
        status: "unavailable",
        type: "plan_registry"
      };
    }

    return this.planRegistry.getStatus();
  }

  getExecutionStatus() {
    if (
      !this.planExecutor ||
      typeof this.planExecutor.getStatus !== "function"
    ) {
      return {
        status: "unavailable",
        type: "plan_executor"
      };
    }

    return this.planExecutor.getStatus();
  }

  getExecutionHistory(limit = 20) {
    if (
      !this.planExecutor ||
      typeof this.planExecutor.getHistory !== "function"
    ) {
      return [];
    }

    return this.planExecutor.getHistory(limit);
  }


  getApprovalStatus() {
    return this.approvals.getStatus();
  }

  getCentralCoreStatus() {
    return {
      status: "online",
      runtime: "AgentRuntime",
      centralCore: true,
      master: !!this.master,
      executor: false,
      planExecutor: !!this.planExecutor,
      approvals: !!this.approvals,
      connectors: !!this.connectorHub,
      revenue: !!this.revenue,
      delegate: typeof this.delegateToAbuBashaWithApproval === "function",
      executeApproved: typeof this.executeApproved === "function",
      externalExecution: {
        master: this.master
          ? !!this.master.externalExecution
          : false,
        abuBasha: this.abuBashaPod
          ? !!this.abuBashaPod.externalExecution
          : false
      }
    };
  }

  getStatus() {
    return {
      status: "online",
      startedAt: this.startedAt,
      executor: {
        status: "disabled",
        type: "legacy_executor"
      },
      planExecutor: this.planExecutor
        ? {
            status: "online",
            name: this.planExecutor.name,
            version: this.planExecutor.version
          }
        : {
            status: "unavailable",
            type: "plan_executor"
          },
      connectors: this.connectorHub
        ? this.connectorHub.getStatus()
        : {
            status: "unavailable",
            type: "connector_hub"
          }
    };
  }
}

module.exports = AgentRuntime;
