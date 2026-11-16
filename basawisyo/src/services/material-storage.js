/* ==========================================================================
   BasaWisyo Material Storage Service
   Local-first IndexedDB storage with localStorage fallback and permission namespaces
   ========================================================================== */

const MATERIAL_STORAGE_KEY = "basa_wisyo_materials_v1";
const DB_NAME = "BasaWisyoMaterialsDB";
const DB_VERSION = 1;
const STORE_NAME = "materials";

/**
 * Returns current actor context (user or guest)
 * @returns {{ id: string, role: string, name: string }}
 */
function getStorageActor() {
  if (typeof AUTH !== "undefined" && AUTH.currentUser) {
    return {
      id: AUTH.currentUser.id,
      role: AUTH.currentUser.role,
      name: AUTH.currentUser.name || "User"
    };
  }
  return {
    id: typeof S !== "undefined" && S.guestToken ? `guest_${S.guestToken}` : "guest",
    role: "guest",
    name: "Guest Explorer"
  };
}

/**
 * Reads all materials from localStorage fallback
 * @returns {Array}
 */
function readLocalMaterials() {
  try {
    const raw = localStorage.getItem(MATERIAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

/**
 * Writes materials array to localStorage fallback
 * @param {Array} materials 
 */
function writeLocalMaterials(materials) {
  try {
    localStorage.setItem(MATERIAL_STORAGE_KEY, JSON.stringify(materials));
  } catch (e) {
    console.warn("Storage quota exceeded in localStorage fallback.");
  }
}

/**
 * Opens or accesses the browser's IndexedDB database
 * @returns {Promise<IDBDatabase|null>}
 */
function openMaterialsDatabase() {
  if (typeof window === "undefined" || !window.indexedDB) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => resolve(null);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          store.createIndex("ownerId", "ownerId", { unique: false });
          store.createIndex("status", "status", { unique: false });
          store.createIndex("visibility", "visibility", { unique: false });
        }
      };
    } catch (e) {
      resolve(null);
    }
  });
}

/**
 * Persists a material object to local-first storage.
 * @param {Object} material 
 * @param {Object} [actor] 
 * @returns {Promise<Object>}
 */
async function saveMaterial(material, actor = getStorageActor()) {
  if (!material || typeof material !== "object") {
    throw new Error("Invalid material object.");
  }

  const isStudentOrGuest = actor.role === "student" || actor.role === "guest";
  const now = Date.now();

  const id = material.id || `mat_${now}_${Math.random().toString(36).slice(2, 7)}`;
  const title = (material.title || "Untitled Reading Material").trim();
  const text = (material.text || "").trim();

  if (!text) {
    throw new Error("Material must contain passage text.");
  }

  // Enforce role-based status and visibility
  let status = material.status || (isStudentOrGuest ? "personal" : "draft");
  if (isStudentOrGuest) {
    // Students can NEVER save materials as approved or published
    status = "personal";
  }

  let visibility = material.visibility || (isStudentOrGuest ? "private" : "private");
  if (isStudentOrGuest) {
    visibility = "private";
  }

  const existing = await getMaterialById(id, actor);

  if (isStudentOrGuest && !existing) {
    const isPrem = typeof isUserPremium === "function" && isUserPremium();
    if (!isPrem) {
      const existingPersonal = (await listMaterials(actor)).filter(m => m.ownerId === actor.id && m.status === "personal");
      if (existingPersonal.length >= 2) {
        if (typeof openUpgradeModal === "function") {
          openUpgradeModal("imports", `You have reached the free personal import limit (2 stories). Upgrade to Wisyo Plus for expanded reading material imports!`);
        }
        throw new Error("Free personal story import limit (2) reached. Upgrade to Wisyo Plus for expanded imports!");
      }
    }
  }

  let version = existing ? (existing.version || 1) : 1;
  if (existing && (existing.status === "approved" || existing.status === "published") && actor.role === "teacher") {
    // Editing an approved or published material increments version and resets to draft
    version += 1;
    status = "draft";
  }

  const normalized = {
    id,
    ownerId: existing ? existing.ownerId : actor.id,
    ownerRole: existing ? existing.ownerRole : actor.role,
    ownerName: existing ? existing.ownerName : actor.name,
    title,
    author: (material.author || "Imported Material").trim(),
    sourceType: material.sourceType || "paste",
    language: ["en", "fil", "ceb"].includes(material.language) ? material.language : "en",
    text,
    wordCount: typeof wordCount === "function" ? wordCount(text) : text.split(/\s+/).filter(Boolean).length,
    difficulty: ["easy", "medium", "hard"].includes(material.difficulty) ? material.difficulty : "medium",
    status,
    visibility,
    version,
    questions: Array.isArray(material.questions) ? material.questions : [],
    vocabulary: Array.isArray(material.vocabulary) ? material.vocabulary : [],
    reviewNote: material.reviewNote || "",
    createdAt: existing ? existing.createdAt : now,
    updatedAt: now
  };

  // 1. Try IndexedDB
  const db = await openMaterialsDatabase();
  if (db) {
    await new Promise((resolve, reject) => {
      try {
        const tx = db.transaction([STORE_NAME], "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(normalized);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      } catch (err) {
        resolve(false);
      }
    });
  }

  // 2. Always mirror to localStorage fallback for immediate synchronous retrieval & export safety
  const all = readLocalMaterials();
  const idx = all.findIndex(m => m.id === id);
  if (idx >= 0) all[idx] = normalized;
  else all.unshift(normalized);
  writeLocalMaterials(all);

  return normalized;
}

/**
 * Retrieves a material by ID, enforcing role-based privacy.
 * @param {string} id 
 * @param {Object} [actor] 
 * @returns {Promise<Object|null>}
 */
async function getMaterialById(id, actor = getStorageActor()) {
  if (!id) return null;

  let item = null;

  // 1. Try IndexedDB
  const db = await openMaterialsDatabase();
  if (db) {
    item = await new Promise((resolve) => {
      try {
        const tx = db.transaction([STORE_NAME], "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  }

  // 2. Check localStorage fallback if not found in IndexedDB
  if (!item) {
    const all = readLocalMaterials();
    item = all.find(m => m.id === id) || null;
  }

  if (!item) return null;

  // Role privacy check:
  // - Students/guests cannot see another user's private/personal materials
  if (item.visibility === "private" && item.ownerId !== actor.id && actor.role !== "admin") {
    return null;
  }

  return item;
}

/**
 * Lists materials owned by the current actor, or published materials.
 * @param {Object} [actor] 
 * @returns {Promise<Array>}
 */
async function listMaterials(actor = getStorageActor()) {
  let items = [];

  const db = await openMaterialsDatabase();
  if (db) {
    items = await new Promise((resolve) => {
      try {
        const tx = db.transaction([STORE_NAME], "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      } catch (e) {
        resolve([]);
      }
    });
  }

  if (!items || items.length === 0) {
    items = readLocalMaterials();
  }

  // Filter based on actor permissions:
  // - Admin sees all
  // - Teacher sees their own drafts/materials + approved/published materials
  // - Student/guest sees their own personal materials + approved/published materials
  if (actor.role === "admin") {
    return items;
  }

  return items.filter(m => {
    if (m.ownerId === actor.id) return true;
    if (m.status === "published" || m.status === "approved") return true;
    return false;
  });
}

/**
 * Deletes a material if the actor is authorized.
 * @param {string} id 
 * @param {Object} [actor] 
 * @returns {Promise<boolean>}
 */
async function deleteMaterial(id, actor = getStorageActor()) {
  const item = await getMaterialById(id, actor);
  if (!item) {
    throw new Error("Material not found.");
  }

  // Authorization: Owner or Admin
  if (item.ownerId !== actor.id && actor.role !== "admin") {
    throw new Error("You do not have permission to delete this material.");
  }

  // Teacher cannot delete approved or published materials directly if students are reading them
  if (actor.role === "teacher" && (item.status === "approved" || item.status === "published")) {
    throw new Error("Cannot delete approved or published materials. You can archive or withdraw them to draft instead.");
  }

  // 1. Remove from IndexedDB
  const db = await openMaterialsDatabase();
  if (db) {
    await new Promise((resolve) => {
      try {
        const tx = db.transaction([STORE_NAME], "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(id);
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  }

  // 2. Remove from localStorage
  const all = readLocalMaterials().filter(m => m.id !== id);
  writeLocalMaterials(all);

  return true;
}

/**
 * Updates the approval lifecycle status (Draft -> Pending -> Approved -> Published).
 * @param {string} id 
 * @param {string} newStatus 
 * @param {string} [reviewNote] 
 * @param {Object} [actor] 
 * @returns {Promise<Object>}
 */
async function updateMaterialStatus(id, newStatus, reviewNote = "", actor = getStorageActor()) {
  const item = await getMaterialById(id, actor);
  if (!item) {
    throw new Error("Material not found.");
  }

  const validStatuses = ["personal", "draft", "pending", "approved", "published", "rejected"];
  if (!validStatuses.includes(newStatus)) {
    throw new Error(`Invalid status: ${newStatus}`);
  }

  // Permissions:
  // - Students can ONLY have "personal"
  if (actor.role === "student" || actor.role === "guest") {
    throw new Error("Students cannot change publication or approval statuses.");
  }

  // - Teachers can submit their drafts to "pending" or withdraw to "draft"
  if (actor.role === "teacher") {
    if (newStatus === "approved" || newStatus === "published") {
      throw new Error("Teachers cannot self-approve materials. Please submit for Admin Review.");
    }
    if (item.ownerId !== actor.id) {
      throw new Error("Teachers can only update their own materials.");
    }
  }

  // - Admins can approve, publish, reject
  item.status = newStatus;
  if (reviewNote) item.reviewNote = reviewNote;
  item.updatedAt = Date.now();

  return await saveMaterial(item, actor);
}

/**
 * Exports a material as a portable versioned JSON content package.
 * @param {string} id 
 * @param {Object} [actor] 
 * @returns {Promise<string>}
 */
async function exportMaterialPackage(id, actor = getStorageActor()) {
  const item = await getMaterialById(id, actor);
  if (!item) {
    throw new Error("Material not found for export.");
  }

  const pkg = {
    schemaVersion: "basa_wisyo_material_v1",
    exportedAt: Date.now(),
    exportedBy: actor.name,
    material: {
      id: item.id,
      title: item.title,
      author: item.author,
      language: item.language,
      difficulty: item.difficulty,
      sourceType: item.sourceType,
      text: item.text,
      version: item.version,
      questions: item.questions,
      vocabulary: item.vocabulary
    }
  };

  return JSON.stringify(pkg, null, 2);
}

/**
 * Imports a versioned JSON content package into local storage.
 * @param {string|Object} packageData 
 * @param {Object} [actor] 
 * @returns {Promise<Object>}
 */
async function importMaterialPackage(packageData, actor = getStorageActor()) {
  let pkg = packageData;
  if (typeof pkg === "string") {
    try {
      pkg = JSON.parse(packageData);
    } catch (e) {
      throw new Error("Invalid content package: JSON parsing failed.");
    }
  }

  if (!pkg || pkg.schemaVersion !== "basa_wisyo_material_v1" || !pkg.material) {
    throw new Error("Unsupported content package format or missing material data.");
  }

  const m = pkg.material;
  if (!m.text || !m.title) {
    throw new Error("Corrupted package: Missing title or passage text.");
  }

  // If importing as student, store as personal
  const isStudent = actor.role === "student" || actor.role === "guest";
  const newMaterial = {
    id: `mat_imp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    title: m.title,
    author: m.author || "Imported Package",
    language: m.language || "en",
    difficulty: m.difficulty || "medium",
    sourceType: m.sourceType || "package",
    text: m.text,
    version: 1,
    status: isStudent ? "personal" : "draft",
    visibility: "private",
    questions: Array.isArray(m.questions) ? m.questions : [],
    vocabulary: Array.isArray(m.vocabulary) ? m.vocabulary : []
  };

  return await saveMaterial(newMaterial, actor);
}
