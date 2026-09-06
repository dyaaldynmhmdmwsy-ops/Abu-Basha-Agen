const ACTIONS = {
  publish: {
    name: "publish",
    label: "نشر محتوى",
    requiresApproval: true,
    patterns: [/^انشر/, /^نشر/]
  },

  send: {
    name: "send",
    label: "إرسال رسالة",
    requiresApproval: true,
    patterns: [/^أرسل/, /^ارسل/]
  },

  deletePost: {
    name: "deletePost",
    label: "حذف منشور",
    requiresApproval: true,
    patterns: [/^احذف منشور/]
  },

  edit: {
    name: "edit",
    label: "تعديل محتوى",
    requiresApproval: true,
    patterns: [/^عدّل/, /^عدل/]
  },

  booking: {
    name: "booking",
    label: "حجز موعد",
    requiresApproval: true,
    patterns: [/^احجز/]
  }
};

function detectAction(text = "") {
  const value = String(text).trim();

  for (const action of Object.values(ACTIONS)) {
    if (action.patterns.some(pattern => pattern.test(value))) {
      return action;
    }
  }

  return null;
}

function getAction(name) {
  return ACTIONS[name] || null;
}

function listActions() {
  return Object.values(ACTIONS).map(action => ({
    name: action.name,
    label: action.label,
    requiresApproval: action.requiresApproval
  }));
}

module.exports = {
  ACTIONS,
  detectAction,
  getAction,
  listActions
};
