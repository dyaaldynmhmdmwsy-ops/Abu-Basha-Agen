"use strict";

/**
 * App Connection Registry
 *
 * مسؤول عن إدارة اتصالات التطبيقات والخدمات.
 * لا يخزن كلمات المرور أو الأسرار داخل هذا الملف.
 */

class ConnectionRegistry {
  constructor() {
    this.connections = new Map();
  }

  add(id, config = {}) {
    if (!id) {
      throw new Error("معرّف الاتصال مطلوب");
    }

    if (this.connections.has(id)) {
      throw new Error(`الاتصال "${id}" موجود بالفعل`);
    }

    const connection = {
      id,
      app: config.app || id,
      provider: config.provider || "unknown",
      category: config.category || "general",
      status: "disconnected",
      permissions: Array.isArray(config.permissions)
        ? config.permissions
        : [],
      metadata: config.metadata || {},
      createdAt: new Date().toISOString(),
      connectedAt: null
    };

    this.connections.set(id, connection);

    return { ...connection };
  }

  remove(id) {
    return this.connections.delete(id);
  }

  get(id) {
    return this.connections.get(id) || null;
  }

  has(id) {
    return this.connections.has(id);
  }

  connect(id) {
    const connection = this.get(id);

    if (!connection) {
      return {
        success: false,
        type: "not_found",
        message: `الاتصال "${id}" غير موجود`
      };
    }

    connection.status = "connected";
    connection.connectedAt = new Date().toISOString();

    return {
      success: true,
      type: "connected",
      connection: { ...connection }
    };
  }

  disconnect(id) {
    const connection = this.get(id);

    if (!connection) {
      return {
        success: false,
        type: "not_found",
        message: `الاتصال "${id}" غير موجود`
      };
    }

    connection.status = "disconnected";
    connection.connectedAt = null;

    return {
      success: true,
      type: "disconnected",
      connection: { ...connection }
    };
  }

  setPermissions(id, permissions = []) {
    const connection = this.get(id);

    if (!connection) {
      return {
        success: false,
        type: "not_found"
      };
    }

    connection.permissions = Array.isArray(permissions)
      ? [...permissions]
      : [];

    return {
      success: true,
      permissions: [...connection.permissions]
    };
  }

  list() {
    return [...this.connections.values()].map(
      connection => ({ ...connection })
    );
  }

  getConnected() {
    return this.list().filter(
      connection => connection.status === "connected"
    );
  }

  getStatus() {
    const all = this.list();

    return {
      total: all.length,
      connected: all.filter(
        item => item.status === "connected"
      ).length,
      disconnected: all.filter(
        item => item.status === "disconnected"
      ).length,
      connections: all
    };
  }
}

module.exports = ConnectionRegistry;
