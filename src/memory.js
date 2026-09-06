const fs = require("fs");
const path = require("path");

class Memory {
  constructor() {
    this.filePath = path.join(__dirname, "memory.json");

    this.data = this.load();

    this.data.profile ||= {};
    this.data.tasks ||= [];
    this.data.notes ||= [];
    this.data.history ||= [];
    this.data.facts ||= [];
  }

  createEmptyMemory() {
    return {
      profile: {},
      tasks: [],
      notes: [],
      history: [],
      facts: []
    };
  }

  load() {
    try {
      if (!fs.existsSync(this.filePath)) {
        return this.createEmptyMemory();
      }

      const content = fs.readFileSync(
        this.filePath,
        "utf8"
      );

      if (!content.trim()) {
        return this.createEmptyMemory();
      }

      return JSON.parse(content);
    } catch (error) {
      console.log(
        "Memory Load Error:",
        error.message
      );

      return this.createEmptyMemory();
    }
  }

  save() {
    fs.writeFileSync(
      this.filePath,
      JSON.stringify(this.data, null, 2),
      "utf8"
    );
  }

  // ==============================
  // معلومات المشروع / الملف الشخصي
  // ==============================

  setProfile(key, value) {
    this.data.profile[key] = value;
    this.save();

    return true;
  }

  getProfile(key) {
    return this.data.profile[key] ?? null;
  }

  getProfileAll() {
    return this.data.profile;
  }

  deleteProfile(key) {
    if (!(key in this.data.profile)) {
      return false;
    }

    delete this.data.profile[key];
    this.save();

    return true;
  }

  // ==============================
  // الحقائق والمعلومات المهمة
  // ==============================

  addFact(text, category = "general") {
    const fact = {
      id: Date.now(),
      text,
      category,
      createdAt: new Date().toISOString()
    };

    this.data.facts.push(fact);
    this.save();

    return fact;
  }

  getFacts(category = null) {
    if (!category) {
      return this.data.facts;
    }

    return this.data.facts.filter(
      fact => fact.category === category
    );
  }

  deleteFact(id) {
    const index = this.data.facts.findIndex(
      fact => fact.id === Number(id)
    );

    if (index === -1) {
      return false;
    }

    this.data.facts.splice(index, 1);
    this.save();

    return true;
  }

  // ==============================
  // الملاحظات
  // ==============================

  addNote(note) {
    const newNote = {
      id: Date.now(),
      text: note,
      createdAt: new Date().toISOString()
    };

    this.data.notes.push(newNote);
    this.save();

    return newNote;
  }

  getNotes() {
    return this.data.notes;
  }

  deleteNote(id) {
    const index = this.data.notes.findIndex(
      note => note.id === Number(id)
    );

    if (index === -1) {
      return false;
    }

    this.data.notes.splice(index, 1);
    this.save();

    return true;
  }

  // ==============================
  // سجل المحادثات
  // ==============================

  addHistory(command, response) {
    this.data.history.push({
      command,
      response,
      createdAt: new Date().toISOString()
    });

    // نحتفظ بآخر 200 عملية فقط
    if (this.data.history.length > 200) {
      this.data.history =
        this.data.history.slice(-200);
    }

    this.save();
  }

  getHistory(limit = 20) {
    return this.data.history.slice(-limit);
  }

  clearHistory() {
    this.data.history = [];
    this.save();
  }

  // ==============================
  // البحث في الذاكرة
  // ==============================

  search(query) {
    const text = String(query)
      .trim()
      .toLowerCase();

    if (!text) {
      return [];
    }

    const results = [];

    // البحث في المعلومات الشخصية/المشروع
    for (const [key, value] of Object.entries(
      this.data.profile
    )) {
      const content =
        `${key} ${value}`.toLowerCase();

      if (content.includes(text)) {
        results.push({
          type: "profile",
          key,
          value
        });
      }
    }

    // البحث في الحقائق
    for (const fact of this.data.facts) {
      if (
        fact.text.toLowerCase().includes(text) ||
        fact.category.toLowerCase().includes(text)
      ) {
        results.push({
          type: "fact",
          ...fact
        });
      }
    }

    // البحث في الملاحظات
    for (const note of this.data.notes) {
      if (note.text.toLowerCase().includes(text)) {
        results.push({
          type: "note",
          ...note
        });
      }
    }

    // البحث في المهام
    for (const task of this.data.tasks) {
      if (task.title.toLowerCase().includes(text)) {
        results.push({
          type: "task",
          ...task
        });
      }
    }

    return results;
  }

  // ==============================
  // ملخص الذاكرة
  // ==============================

  getSummary() {
    return {
      profileCount:
        Object.keys(this.data.profile).length,

      factsCount:
        this.data.facts.length,

      notesCount:
        this.data.notes.length,

      tasksCount:
        this.data.tasks.length,

      historyCount:
        this.data.history.length
    };
  }
}

module.exports = Memory;
