/* Offline passage packets. Files and codes contain reading content only, never account data. */
const BASAMESH = {
  PROTOCOL: "BasaMesh-v1",
  MAX_PACKET_CHARS: 120000,
  MAX_QR_CHARS: 2500,

  checksum(value) {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i++) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  },

  content(passage) {
    const normalized = normalizePassage({ ...passage, id: passage.id || "mesh_preview", status: "published" });
    return {
      t: normalized.t, x: normalized.x, diff: normalized.diff,
      ...(normalized.lang ? { lang: normalized.lang } : {}),
      qs: normalized.qs
    };
  },

  createPacket(passage) {
    const content = this.content(passage);
    const data = JSON.stringify(content);
    const packet = {
      protocol: this.PROTOCOL,
      createdAt: new Date().toISOString(),
      passage: content,
      checksum: this.checksum(data)
    };
    if (JSON.stringify(packet).length > this.MAX_PACKET_CHARS) {
      throw new Error("This story is too large for a BasaMesh packet.");
    }
    return packet;
  },

  encode(packet) {
    const json = JSON.stringify(packet);
    if (json.length > this.MAX_PACKET_CHARS) throw new Error("BasaMesh packet is too large.");
    const bytes = typeof TextEncoder !== "undefined" ? new TextEncoder().encode(json)
      : Buffer.from(json, "utf8");
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return "BW1:" + (typeof btoa === "function" ? btoa(binary)
      : Buffer.from(bytes).toString("base64"));
  },

  decode(input) {
    if (typeof input !== "string" || !input.trim()) throw new Error("Choose a BasaMesh file or paste a code.");
    const raw = input.trim();
    if (raw.length > this.MAX_PACKET_CHARS * 2) throw new Error("BasaMesh input is too large.");
    if (raw.startsWith("{")) {
      try { return JSON.parse(raw); } catch (_) { throw new Error("BasaMesh file is not valid JSON."); }
    }
    const code = raw.startsWith("BW1:") ? raw.slice(4) : raw;
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(code) || code.length % 4 !== 0) {
      throw new Error("BasaMesh code is damaged or incomplete.");
    }
    try {
      const binary = typeof atob === "function" ? atob(code) : Buffer.from(code, "base64").toString("binary");
      const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
      const json = typeof TextDecoder !== "undefined" ? new TextDecoder("utf-8", { fatal: true }).decode(bytes)
        : Buffer.from(bytes).toString("utf8");
      return JSON.parse(json);
    } catch (_) {
      throw new Error("BasaMesh code is damaged or incomplete.");
    }
  },

  inspect(input) {
    const packet = typeof input === "string" ? this.decode(input) : input;
    if (!packet || typeof packet !== "object" || Array.isArray(packet)) throw new Error("Invalid BasaMesh packet.");
    if (packet.protocol !== this.PROTOCOL) {
      // Older text codes remain readable, but must still pass the passage contract.
      if (packet.schema !== "basa_mesh_v1") throw new Error("Unsupported BasaMesh packet version.");
      const legacy = validateBasaMeshPackage(this.encodeLegacy(packet));
      return { passage: normalizePassage({ ...legacy, status: "published" }), legacy: true };
    }
    if (!packet.passage || typeof packet.passage !== "object" || Array.isArray(packet.passage)) {
      throw new Error("BasaMesh packet has no passage.");
    }
    const data = JSON.stringify(packet.passage);
    if (data.length > this.MAX_PACKET_CHARS || packet.checksum !== this.checksum(data)) {
      throw new Error("BasaMesh packet failed its integrity check.");
    }
    const passage = normalizePassage({ ...packet.passage, id: "mesh_preview", status: "published" });
    if (passage.x.split(/\s+/).length < 10) throw new Error("A shared passage needs at least 10 words.");
    return { passage, legacy: false };
  },

  encodeLegacy(packet) {
    const json = JSON.stringify(packet);
    const bytes = typeof TextEncoder !== "undefined" ? new TextEncoder().encode(json)
      : Buffer.from(json, "utf8");
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return typeof btoa === "function" ? btoa(binary) : Buffer.from(bytes).toString("base64");
  },

  sameContent(a, b) {
    return String(a?.t || "").trim().toLowerCase() === String(b?.t || "").trim().toLowerCase()
      && String(a?.x || "").trim() === String(b?.x || "").trim();
  },

  importPassage(inspected) {
    const source = inspected?.passage;
    if (!source) throw new Error("Preview the packet before importing it.");
    const passage = normalizePassage({ ...source, id: "mesh_preview", status: "published" });
    const existing = [
      ...getPublishedPassages(),
      ...(Array.isArray(AUTH.customPassages) ? AUTH.customPassages : [])
    ];
    if (existing.some(item => this.sameContent(item, passage))) {
      throw new Error("This story is already in your library.");
    }
    if (["teacher", "admin"].includes(AUTH.currentUser?.role)) {
      const saved = AUTH.savePractice(passage, { submit: false });
      return { passage: saved, destination: AUTH.currentUser.role === "teacher" ? "teacher draft" : "admin curriculum" };
    }
    const previous = Array.isArray(S.sh) ? S.sh : [];
    const stateKeys = ["basa_wisyo_state_v2", getStateStorageKey()];
    const previousState = stateKeys.map(key => [key, localStorage.getItem(key)]);
    const next = normalizePassage({
      ...passage, id: `mesh_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      status: "published"
    });
    S.sh = [...previous, next];
    const saved = save();
    if (!saved?.success) {
      S.sh = previous;
      try {
        for (const [key, value] of previousState) {
          if (value === null) localStorage.removeItem(key);
          else localStorage.setItem(key, value);
        }
      } catch (_) { /* The browser may still be out of storage. */ }
      throw new Error("The story could not be saved in this browser. Check available storage and try again.");
    }
    return { passage: next, destination: "personal reading library" };
  }
};
