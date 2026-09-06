const Memory = require("./memory");
const identity = require("./identity");
const { skills, detectSkill } = require("./skills");
const { detectAction } = require("./actions");
const RevenueEngine = require("./revenue");
const AgentRuntime = require("./core/runtime");

class Agent {
  constructor(options = {}) {
    this.name = identity.name || "وكيل أبو بشة";
    this.status = "online";

    // Runtime المركزي للوكيل
    this.runtime = options.runtime || new AgentRuntime();

    // إبقاء Revenue Engine متاحاً للتوافق مع الكود القديم
    this.revenue = this.runtime.revenue || new RevenueEngine();

    this.memory = new Memory();

    // استرجاع المهام المحفوظة
    this.tasks = this.memory.data.tasks || [];
  }

  // =================================
  // بناء سياق الذاكرة
  // =================================

  buildMemoryContext(text) {
    const results = this.memory.search(text);

    let context = "";

    if (results.length > 0) {
      context +=
        "\n\nمعلومات مرتبطة من ذاكرة الوكيل:\n";

      context += results
        .slice(0, 10)
        .map((result) => {
          if (result.type === "profile") {
            return `${result.key}: ${result.value}`;
          }

          if (result.type === "fact") {
            return result.text;
          }

          if (result.type === "note") {
            return result.text;
          }

          if (result.type === "task") {
            return result.title;
          }

          return "";
        })
        .filter(Boolean)
        .join("\n");
    }

    return context;
  }

  // =================================
  // بناء سياق الوكيل الكامل
  // =================================

  buildAgentContext(text) {
    const identityContext =
      typeof identity.getContext === "function"
        ? identity.getContext()
        : "";

    const memoryContext =
      this.buildMemoryContext(text);

    return `
${identityContext}

${memoryContext}

تعليمات عامة:
- استخدم ذاكرة الوكيل عندما تكون مفيدة للطلب.
- لا تختلق معلومات.
- إذا كان الطلب إخباريًا ولا توجد معلومات أو مصادر كافية، وضّح ذلك.
- حافظ على أسلوب صفحة أبو بشة.
- لا تنفذ أي إجراء خارجي دون موافقة المستخدم.
`.trim();
  }

  // =================================
  // تنفيذ المهارة المناسبة
  // =================================

  async runSkill(skillName, text) {
    const skill = skills[skillName];

    if (!skill) {
      return null;
    }

    const context = {
      pageName:
        identity.pageName || "أبو بشة",

      language:
        identity.language || "اللهجة السودانية",

      style:
        identity.style ||
        "مباشر وواضح ومختصر"
    };

    const result =
      await skill.run(text, context);

    return result;
  }

  async run(command) {
    if (!command || !command.trim()) {
      return {
        type: "response",
        message: "أرسل أمرًا للوكيل."
      };
    }

    const text = command.trim();

    // =================================
    // حالة الوكيل
    // =================================

    if (
      text === "حالة الوكيل" ||
      text === "الحالة" ||
      text === "status"
    ) {
      const summary =
        this.memory.getSummary();

      return {
        type: "status",
        message:
          "🤖 " +
          this.name +
          "\n" +
          "الحالة: 🟢 Online\n" +
          "Gemini: 🟢 Connected\n" +
          "الموافقة: 🛡️ مفعّلة\n" +
          "المهارات: 🧩 " +
          Object.keys(skills).length +
          "\n" +
          "المهام: " +
          summary.tasksCount +
          "\n" +
          "الذاكرة: 🧠 Connected\n" +
          "المعلومات المحفوظة: " +
          summary.factsCount
      };
    }

    // =================================
    // المساعدة
    // =================================

    if (
      text === "مساعدة" ||
      text === "help"
    ) {
      return {
        type: "help",
        message:
          "🤖 أوامر وكيل أبو بشة:\n\n" +

          "• حالة الوكيل\n" +
          "• مساعدة\n" +
          "• اقتراح محتوى\n" +
          "• خطة فيديو\n" +
          "• تصميم صورة مصغرة\n\n" +

          "🧠 أوامر الذاكرة:\n" +
          "• احفظ في الذاكرة: النص\n" +
          "• أضف ملاحظة: النص\n" +
          "• اعرض الذاكرة\n" +
          "• ابحث في الذاكرة: كلمة\n" +
          "• سجل المحادثات\n\n" +

          "📋 أوامر المهام:\n" +
          "• أضف مهمة: اسم المهمة\n" +
          "• قائمة المهام\n" +
          "• أنهى مهمة: رقم المهمة\n" +
          "• احذف مهمة: رقم المهمة\n\n" +

          "🧩 المهارات:\n" +
          "• صناعة المحتوى\n" +
          "• صناعة الفيديو والمونتاج\n" +
          "• الصور المصغرة والتصميم\n\n" +

          "🛡️ أي إجراء خارجي يحتاج موافقتك أولًا."
      };
    }

    // =================================
    // أوامر المهارات المباشرة
    // =================================

    if (
      text === "اقتراح محتوى" ||
      text === "صناعة محتوى"
    ) {
      const result =
        await this.runSkill(
          "content",
          text
        );

      const prompt =
        this.buildAgentContext(text) +
        "\n\n" +
        (result && result.prompt ? result.prompt : text);

      const approval =
        this.runtime.createChatApproval(
          prompt,
          {
            target: "user",
            skill: "content"
          }
        );

      return {
        type: approval && approval.success
          ? "chat_approval_required"
          : "chat_approval_error",
        message:
          approval && approval.message
            ? approval.message
            : JSON.stringify(approval, null, 2),
        approval: approval && approval.approval
          ? approval.approval
          : null,
        plan: approval && approval.plan
          ? approval.plan
          : null
      };
    }

    if (
      text === "خطة فيديو" ||
      text === "صناعة فيديو" ||
      text === "مونتاج"
    ) {
      const result =
        await this.runSkill(
          "video",
          text
        );

      const prompt =
        this.buildAgentContext(text) +
        "\n\n" +
        (result && result.prompt ? result.prompt : text);

      const approval =
        this.runtime.createChatApproval(
          prompt,
          {
            target: "user",
            skill: "video"
          }
        );

      return {
        type: approval && approval.success
          ? "chat_approval_required"
          : "chat_approval_error",
        message:
          approval && approval.message
            ? approval.message
            : JSON.stringify(approval, null, 2),
        approval: approval && approval.approval
          ? approval.approval
          : null,
        plan: approval && approval.plan
          ? approval.plan
          : null
      };
    }

    if (
      text === "تصميم صورة مصغرة" ||
      text === "صورة مصغرة" ||
      text === "Thumbnail"
    ) {
      const result =
        await this.runSkill(
          "thumbnail",
          text
        );

      const prompt =
        this.buildAgentContext(text) +
        "\n\n" +
        (result && result.prompt ? result.prompt : text);

      const approval =
        this.runtime.createChatApproval(
          prompt,
          {
            target: "user",
            skill: "thumbnail"
          }
        );

      return {
        type: approval && approval.success
          ? "chat_approval_required"
          : "chat_approval_error",
        message:
          approval && approval.message
            ? approval.message
            : JSON.stringify(approval, null, 2),
        approval: approval && approval.approval
          ? approval.approval
          : null,
        plan: approval && approval.plan
          ? approval.plan
          : null
      };
    }

    // =================================
    // حفظ معلومة في الذاكرة
    // =================================

    if (
      text.startsWith(
        "احفظ في الذاكرة:"
      )
    ) {
      const value =
        text
          .substring(
            "احفظ في الذاكرة:".length
          )
          .trim();

      if (!value) {
        return {
          type: "response",
          message:
            "اكتب المعلومة بعد: احفظ في الذاكرة:"
        };
      }

      const fact =
        this.memory.addFact(
          value,
          "project"
        );

      return {
        type: "memory_saved",
        message:
          "🧠 تم حفظ المعلومة في الذاكرة.\n\n" +
          fact.text
      };
    }

    // =================================
    // إضافة ملاحظة
    // =================================

    if (
      text.startsWith(
        "أضف ملاحظة:"
      )
    ) {
      const note =
        text
          .substring(
            "أضف ملاحظة:".length
          )
          .trim();

      if (!note) {
        return {
          type: "response",
          message:
            "اكتب الملاحظة بعد: أضف ملاحظة:"
        };
      }

      this.memory.addNote(note);

      return {
        type: "note_added",
        message:
          "📝 تمت إضافة الملاحظة إلى الذاكرة:\n\n" +
          note
      };
    }

    // =================================
    // عرض الذاكرة
    // =================================

    if (
      text === "اعرض الذاكرة" ||
      text === "ذاكرتي"
    ) {
      const profile =
        this.memory.getProfileAll();

      const facts =
        this.memory.getFacts();

      const notes =
        this.memory.getNotes();

      let message =
        "🧠 ذاكرة وكيل أبو بشة\n\n";

      message +=
        "📌 معلومات المشروع:\n";

      const profileEntries =
        Object.entries(profile);

      if (
        profileEntries.length === 0
      ) {
        message +=
          "لا توجد معلومات.\n";
      } else {
        for (
          const [key, value]
          of profileEntries
        ) {
          message +=
            "• " +
            key +
            ": " +
            value +
            "\n";
        }
      }

      message +=
        "\n📚 المعلومات المحفوظة:\n";

      if (facts.length === 0) {
        message +=
          "لا توجد معلومات محفوظة.\n";
      } else {
        for (const fact of facts) {
          message +=
            "• " +
            fact.text +
            "\n";
        }
      }

      message +=
        "\n📝 الملاحظات:\n";

      if (notes.length === 0) {
        message +=
          "لا توجد ملاحظات.\n";
      } else {
        for (const note of notes) {
          message +=
            "• " +
            note.text +
            "\n";
        }
      }

      return {
        type: "memory",
        message
      };
    }

    // =================================
    // البحث في الذاكرة
    // =================================

    if (
      text.startsWith(
        "ابحث في الذاكرة:"
      )
    ) {
      const query =
        text
          .substring(
            "ابحث في الذاكرة:".length
          )
          .trim();

      if (!query) {
        return {
          type: "response",
          message:
            "اكتب كلمة البحث بعد: ابحث في الذاكرة:"
        };
      }

      const results =
        this.memory.search(query);

      if (results.length === 0) {
        return {
          type: "memory_search",
          message:
            "🔎 لم أجد شيئًا في الذاكرة عن: " +
            query
        };
      }

      let message =
        "🔎 نتائج البحث عن: " +
        query +
        "\n\n";

      for (const result of results) {
        if (result.type === "profile") {
          message +=
            "📌 " +
            result.key +
            ": " +
            result.value +
            "\n";
        }

        if (result.type === "fact") {
          message +=
            "📚 " +
            result.text +
            "\n";
        }

        if (result.type === "note") {
          message +=
            "📝 " +
            result.text +
            "\n";
        }

        if (result.type === "task") {
          message +=
            "📋 " +
            result.title +
            "\n";
        }
      }

      return {
        type: "memory_search",
        message
      };
    }

    // =================================
    // سجل المحادثات
    // =================================

    if (
      text === "سجل المحادثات"
    ) {
      const history =
        this.memory.getHistory(10);

      if (history.length === 0) {
        return {
          type: "history",
          message:
            "🕘 لا يوجد سجل محادثات."
        };
      }

      let message =
        "🕘 آخر المحادثات:\n\n";

      for (const item of history) {
        message +=
          "أنت: " +
          item.command +
          "\n";

        message +=
          "الوكيل: " +
          item.response +
          "\n\n";
      }

      return {
        type: "history",
        message
      };
    }

    // =================================
    // إضافة مهمة
    // =================================

    if (
      text.startsWith("أضف مهمة:")
    ) {
      const taskName =
        text
          .substring(
            "أضف مهمة:".length
          )
          .trim();

      if (!taskName) {
        return {
          type: "response",
          message:
            "اكتب اسم المهمة بعد: أضف مهمة:"
        };
      }

      const nextId =
        this.tasks.length > 0
          ? Math.max(
              ...this.tasks.map(
                task => task.id
              )
            ) + 1
          : 1;

      const task = {
        id: nextId,
        title: taskName,
        status: "pending",
        createdAt:
          new Date().toISOString()
      };

      this.tasks.push(task);

      this.memory.data.tasks =
        this.tasks;

      this.memory.save();

      return {
        type: "task_added",
        message:
          "✅ تمت إضافة المهمة بنجاح.\n\n" +
          "رقم المهمة: " +
          task.id +
          "\n" +
          "المهمة: " +
          task.title +
          "\n" +
          "الحالة: ⏳ قيد الانتظار"
      };
    }

    // =================================
    // قائمة المهام
    // =================================

    if (
      text === "قائمة المهام" ||
      text === "المهام"
    ) {
      if (this.tasks.length === 0) {
        return {
          type: "tasks",
          message:
            "📋 لا توجد مهام حاليًا."
        };
      }

      const list =
        this.tasks
          .map(
            task =>
              task.id +
              ". " +
              task.title +
              " — " +
              (
                task.status ===
                "pending"
                  ? "⏳ قيد الانتظار"
                  : "✅ مكتملة"
              )
          )
          .join("\n");

      return {
        type: "tasks",
        message:
          "📋 قائمة مهام وكيل أبو بشة:\n\n" +
          list
      };
    }

    // =================================
    // إنهاء مهمة
    // =================================

    if (
      text.startsWith(
        "أنهى مهمة:"
      ) ||
      text.startsWith(
        "انهى مهمة:"
      )
    ) {
      const number =
        parseInt(
          text
            .split(":")[1]
            ?.trim(),
          10
        );

      const task =
        this.tasks.find(
          task =>
            task.id === number
        );

      if (!task) {
        return {
          type: "response",
          message:
            "لم أجد مهمة بهذا الرقم."
        };
      }

      task.status =
        "completed";

      task.completedAt =
        new Date().toISOString();

      this.memory.data.tasks =
        this.tasks;

      this.memory.save();

      return {
        type: "task_completed",
        message:
          "✅ تم إنهاء المهمة:\n\n" +
          task.id +
          ". " +
          task.title
      };
    }

    // =================================
    // حذف مهمة
    // =================================

    if (
      text.startsWith(
        "احذف مهمة:"
      )
    ) {
      const number =
        parseInt(
          text
            .split(":")[1]
            ?.trim(),
          10
        );

      const index =
        this.tasks.findIndex(
          task =>
            task.id === number
        );

      if (index === -1) {
        return {
          type: "response",
          message:
            "لم أجد مهمة بهذا الرقم."
        };
      }

      const removed =
        this.tasks.splice(
          index,
          1
        )[0];

      this.memory.data.tasks =
        this.tasks;

      this.memory.save();

      return {
        type: "task_deleted",
        message:
          "🗑️ تم حذف المهمة:\n\n" +
          removed.id +
          ". " +
          removed.title
      };
    }

    // =================================
    // نظام الإجراءات + الموافقة
    // =================================

    // =================================
    // Canonical Action Approval
    // =================================
    const detectedAction = detectAction(text);
    if (detectedAction) {
      const approval = this.runtime.createChatApproval(
        text,
        {
          target: "user",
          action: detectedAction.name
        }
      );

      if (!approval || !approval.success || !approval.approval) {
        return {
          type: "chat_approval_error",
          action: detectedAction.name,
          message:
            approval && approval.message
              ? approval.message
              : JSON.stringify(approval, null, 2)
        };
      }

      return {
        type: "chat_approval_required",
        action: detectedAction.name,
        message: approval.message,
        approval: approval.approval,
        plan: approval.plan
      };
    }

    // =================================
    // Gemini + الهوية + الذاكرة + المهارات
    // =================================


    // =================================
    // Revenue Engine
    // =================================

    const revenueText = String(text).trim();

    if (
      /^اقترح طريقة ربح/.test(revenueText) ||
      /^اقترح طرق ربح/.test(revenueText) ||
      /^ابحث عن فرص ربح/.test(revenueText)
    ) {
      const opportunities = this.runtime.listRevenueOpportunities();

      return {
        type: "revenue_opportunities",
        message:
          opportunities.length
            ? opportunities.map((item, index) =>
                `${index + 1}. ${item.name}\n` +
                `الوصف: ${item.description}\n` +
                `طريقة الربح: ${item.monetization.join("، ")}\n` +
                `الحالة: ${item.status}`
              ).join("\n\n")
            : "حالياً ما عندنا فرص ربح مسجلة. نقدر نضيف فرص قانونية جديدة ونعمل لها خطة."
      };
    }


    // =================================
    // Create Revenue Plan + Approval
    // =================================

    const createPlanMatch = revenueText.match(
      /^أنشئ خطة ربح\s+(.+)$/
    );

    if (createPlanMatch) {
      const opportunityId = createPlanMatch[1].trim();

      const result =
        this.runtime.createRevenuePlanWithApproval(
          opportunityId,
          "online"
        );

      return {
        type: "revenue_plan_created",
        message: JSON.stringify(
          result,
          null,
          2
        )
      };
    }

    if (/^اعرض خطط الربح/.test(revenueText)) {
      const plans = this.runtime.getRevenuePlans();

      return {
        type: "revenue_plans",
        message:
          plans.length
            ? plans.map((plan, index) =>
                `${index + 1}. ${plan.name}\n` +
                `الحالة: ${plan.status}\n` +
                `الموافقة مطلوبة: ${plan.requiresApproval ? "نعم" : "لا"}`
              ).join("\n\n")
            : "ما عندنا خطط ربح حالياً."
      };
    }

    if (/^حالة الأرباح/.test(revenueText)) {
      return {
        type: "revenue_status",
        message: JSON.stringify(
          this.runtime.getRevenueStatus(),
          null,
          2
        )
      };
    }


    // =================================
    // Approval Queue Commands
    // =================================

    const approvalText = String(text).trim();

    if (
      /^اعرض الموافقات/.test(approvalText) ||
      /^قائمة الموافقات/.test(approvalText)
    ) {
      const approvals =
        this.runtime.getPendingApprovals();

      return {
        type: "approval_list",
        message:
          approvals.length
            ? approvals.map((item, index) =>
                `${index + 1}. ${item.planName}\n` +
                `المعرف: ${item.id}\n` +
                `الحالة: ${item.status}`
              ).join("\n\n")
            : "لا توجد خطط بانتظار الموافقة حالياً."
      };
    }

    if (/^حالة الموافقات/.test(approvalText)) {
      return {
        type: "approval_status",
        message: JSON.stringify(
          this.runtime.getApprovalStatus(),
          null,
          2
        )
      };
    }

    const approveMatch =
      approvalText.match(/^وافق على\s+(.+)$/);

    if (approveMatch) {
      const approvalId =
        approveMatch[1].trim();

      const pendingApprovals =
        typeof this.runtime.getPendingApprovals === "function"
          ? this.runtime.getPendingApprovals()
          : [];

      const pendingApproval =
        Array.isArray(pendingApprovals)
          ? pendingApprovals.find(
              item =>
                item &&
                item.id === approvalId
            )
          : null;

      const approvedPrompt =
        pendingApproval &&
        pendingApproval.plan &&
        typeof pendingApproval.plan.goal === "string"
          ? pendingApproval.plan.goal.trim()
          : "";

      if (!approvedPrompt) {
        return {
          type: "approval_result",
          message: JSON.stringify(
            {
              success: false,
              type: "approved_chat_prompt_unavailable",
              executionAllowed: false,
              failClosed: true
            },
            null,
            2
          )
        };
      }

      const approvalResult =
        this.runtime.approve(approvalId);

      if (
        !approvalResult ||
        approvalResult.success !== true
      ) {
        return {
          type: "approval_result",
          message: JSON.stringify(
            approvalResult,
            null,
            2
          )
        };
      }

      const executionResult =
        await this.runtime.executeApprovedChat(
          approvalId,
          approvedPrompt
        );

      if (
        executionResult &&
        executionResult.success === true &&
        typeof executionResult.text === "string"
      ) {
        this.memory.addHistory(
          approvedPrompt,
          executionResult.text
        );
      }

      return {
        type: executionResult &&
          executionResult.success === true
          ? "response"
          : "approval_result",
        message:
          executionResult &&
          executionResult.success === true
            ? executionResult.text || ""
            : JSON.stringify(
                executionResult,
                null,
                2
              ),
        approval: approvalResult,
        execution: executionResult
      };
    }

    const rejectMatch =
      approvalText.match(/^ارفض\s+(.+)$/);

    if (rejectMatch) {
      const approvalId =
        rejectMatch[1].trim();

      return {
        type: "approval_result",
        message: JSON.stringify(
          this.runtime.reject(approvalId),
          null,
          2
        )
      };
    }

    const skillName =
      detectSkill(text);

    let skillPrompt = "";

    if (skillName) {
      const skillResult =
        await this.runSkill(
          skillName,
          text
        );

      if (skillResult) {
        skillPrompt =
          "\n\nالمهارة المختارة: " +
          skillName +
          "\n\n" +
          skillResult.prompt;
      }
    }

    const agentContext =
      this.buildAgentContext(text);

    const prompt =
      agentContext +
      skillPrompt +
      "\n\nطلب المستخدم:\n" +
      text;

    const approval =
      this.runtime.createChatApproval(
        prompt,
        {
          target: "user",
          skill: skillName || null
        }
      );

    return {
      type: approval && approval.success
        ? "chat_approval_required"
        : "chat_approval_error",
      message:
        approval && approval.message
          ? approval.message
          : JSON.stringify(approval, null, 2),
      approval: approval && approval.approval
        ? approval.approval
        : null,
      plan: approval && approval.plan
        ? approval.plan
        : null
    };
  }
}

module.exports = Agent;
