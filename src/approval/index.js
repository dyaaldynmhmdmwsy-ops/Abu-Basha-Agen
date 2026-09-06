class ApprovalQueue {
  constructor() {
    this.name = "Approval Queue";
    this.version = "1.0.0";
    this.status = "online";
    this.items = [];
  }

  create(plan) {
    if (!plan || !plan.id) {
      return {
        success: false,
        type: "invalid_plan",
        message: "الخطة غير صالحة"
      };
    }

    const item = {
      id: `approval_${Date.now()}`,
      planId: plan.id,
      planName: plan.name,
      plan: { ...plan },
      status: "pending_approval",
      createdAt: new Date().toISOString(),
      approvedAt: null,
      rejectedAt: null
    };

    this.items.push(item);

    return {
      success: true,
      type: "approval_created",
      item
    };
  }

  approve(id) {
    const item = this.items.find(x => x.id === id);

    if (!item) {
      return {
        success: false,
        type: "approval_not_found"
      };
    }

    if (item.status !== "pending_approval") {
      return {
        success: false,
        type: "invalid_state",
        status: item.status
      };
    }

    item.status = "approved";
    item.approvedAt = new Date().toISOString();

    return {
      success: true,
      type: "approved",
      item
    };
  }

  reject(id) {
    const item = this.items.find(x => x.id === id);

    if (!item) {
      return {
        success: false,
        type: "approval_not_found"
      };
    }

    item.status = "rejected";
    item.rejectedAt = new Date().toISOString();

    return {
      success: true,
      type: "rejected",
      item
    };
  }

  getPending() {
    return this.items.filter(
      item => item.status === "pending_approval"
    );
  }

  getAll() {
    return this.items;
  }

  getStatus() {
    return {
      name: this.name,
      version: this.version,
      status: this.status,
      total: this.items.length,
      pending: this.getPending().length,
      approved: this.items.filter(x => x.status === "approved").length,
      rejected: this.items.filter(x => x.status === "rejected").length
    };
  }
}

module.exports = ApprovalQueue;
