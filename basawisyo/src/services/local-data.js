/* Localhost relational copy. Browser storage remains available when the server is offline. */
const LOCAL_DATA = {
  timer: null,
  busy: false,
  pending: false,
  available: false,
  lastSyncedAt: null,
  syncError: null,

  async snapshot() {
    const backup = createBackupPayload();
    const states = { ...backup.userStates };
    if (AUTH.currentUser?.role === "student") {
      states[`basa_wisyo_state_${AUTH.currentUser.id}`] = S;
    }
    const materials = new Map([...backup.materials, ...backup.customPassages].map(item => [item.id, item]));
    if (typeof openMaterialsDatabase === "function") {
      try {
        const db = await openMaterialsDatabase();
        if (db) {
          const indexed = await new Promise((resolve, reject) => {
            const request = db.transaction("materials", "readonly").objectStore("materials").getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
          for (const item of indexed) {
            const prior = materials.get(item.id);
            if (!prior || (item.version || 1) >= (prior.version || 1)) materials.set(item.id, item);
          }
          db.close();
        }
      } catch (error) {
        console.warn("IndexedDB materials will retry on the next sync.", error);
      }
    }
    return {
      users: backup.users.map(({ password, passwordHash, ...user }) => user),
      userStates: states,
      assignments: backup.assignments,
      materials: [...materials.values()]
    };
  },

  queue() {
    if (location.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(location.hostname)) return;
    this.pending = true;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 400);
  },

  async flush() {
    if (!this.pending || this.busy) return;
    this.pending = false;
    this.busy = true;
    try {
      const response = await fetch("/api/data/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(await this.snapshot())
      });
      if (!response.ok) throw new Error(`Local data sync failed (${response.status}).`);
      this.available = true;
      this.lastSyncedAt = Date.now();
      this.syncError = null;
    } catch (error) {
      this.available = false;
      this.syncError = error.message;
      this.pending = true;
      console.warn(error.message);
    } finally {
      this.busy = false;
      if (this.pending && this.available) this.queue();
    }
  },

  getSyncStatus() {
    if (this.busy) {
      return { status: "syncing", label: "Syncing changes with school server…" };
    }
    if (this.available && !this.pending) {
      return { status: "synced", label: "Synchronized with school server", lastSyncedAt: this.lastSyncedAt };
    }
    if (!this.available) {
      return { status: "offline", label: "Offline mode — changes saved locally on this device", lastSyncedAt: this.lastSyncedAt, error: this.syncError };
    }
    return { status: "pending", label: "Pending sync to school server…" };
  },

  start() {
    if (location.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(location.hostname)) return;
    this.queue();
    setInterval(() => this.queue(), 10000);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) this.queue();
    });
  }
};
