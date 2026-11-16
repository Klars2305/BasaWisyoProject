/* ==========================================================================
   BasaWisyo Teacher Classroom Assignments & Content Packaging Service
   Manages class assignments, due dates, practice vs assessment modes,
   and versioned JSON content export/import packages.
   ========================================================================== */

const ASSIGNMENT_PACKAGE_SCHEMA = "basa_wisyo_assignment_v1";

/**
 * Creates a new classroom assignment from a teacher material.
 * @param {Object} params
 * @param {Object} actor
 * @returns {Promise<Object>}
 */
async function createClassAssignment({
  materialId,
  sectionCode,
  dueDate,
  mode = "practice"
}, actor = typeof getStorageActor === "function" ? getStorageActor() : { id: "teacher_1", role: "teacher", name: "Teacher" }) {
  if (actor.role !== "teacher" && actor.role !== "admin") {
    throw new Error("Only teachers and administrators can create class assignments.");
  }

  const passage = typeof getPublishedPassageById === "function" ? getPublishedPassageById(materialId) : null;
  const mat = passage ? {
    id: passage.id,
    title: passage.t,
    author: passage.author || "BasaWisyo",
    difficulty: passage.diff,
    language: { "en-US": "en", "fil-PH": "fil", "ceb-PH": "ceb" }[passage.lang] || "en",
    text: passage.x,
    questions: passage.qs,
    version: 1
  } : await getMaterialById(materialId, actor);
  if (!mat) {
    throw new Error("Material was not found for assignment.");
  }

  if (!sectionCode || !sectionCode.trim()) {
    throw new Error("Please specify a target class section.");
  }

  if (!dueDate || !String(dueDate).trim()) {
    throw new Error("Please set a valid due date for this assignment.");
  }

  // Prevent duplicate assignment submissions for the same passage, section, and mode
  const currentAssignments = typeof listAssignments === "function" ? listAssignments({ role: actor.role, id: actor.id }) : [];
  const cleanSec = sectionCode.trim().toLowerCase();
  const cleanMode = (mode === "assessment" ? "assessment" : "practice").toLowerCase();
  const isDuplicate = currentAssignments.some(a =>
    a.status === "active" &&
    (a.materialId === mat.id || a.passageId === mat.id) &&
    (a.section || a.targetGroup || "").trim().toLowerCase() === cleanSec &&
    (a.mode || "practice").toLowerCase() === cleanMode
  );
  if (isDuplicate) {
    throw new Error(`An active assignment for "${mat.title}" in section "${sectionCode.trim()}" already exists.`);
  }

  const now = Date.now();
  const assignmentId = `ass_${now}_${Math.random().toString(36).slice(2, 7)}`;

  const assignment = {
    id: assignmentId,
    materialId: mat.id,
    materialTitle: mat.title,
    materialVersion: mat.version || 1,
    passageId: mat.id,
    title: mat.title,
    targetGroup: sectionCode.trim(),
    section: sectionCode.trim(),
    teacherId: actor.id,
    teacherName: actor.name,
    dueDate,
    mode: mode === "assessment" ? "assessment" : "practice",
    status: "active",
    createdAt: now,
    material: {
      id: mat.id,
      title: mat.title,
      author: mat.author,
      diff: mat.difficulty,
      lang: mat.language,
      x: mat.text,
      qs: mat.questions
    }
  };

  // 1. Sync with AUTH.assignments if available
  if (typeof AUTH !== "undefined" && Array.isArray(AUTH.assignments)) {
    AUTH.assignments.unshift(assignment);
    if (typeof AUTH.saveAssignments === "function") AUTH.saveAssignments();
  }

  // 2. Also record into localStorage assignments collection
  try {
    const raw = localStorage.getItem("basa_wisyo_assignments_v2");
    const list = raw ? JSON.parse(raw) : [];
    list.unshift(assignment);
    localStorage.setItem("basa_wisyo_assignments_v2", JSON.stringify(list));
  } catch (e) {}

  return assignment;
}

/**
 * Lists assignments relevant to the current user.
 * @param {Object} actor 
 * @returns {Array}
 */
function listAssignments(actor = typeof getStorageActor === "function" ? getStorageActor() : { id: "guest", role: "guest" }) {
  let list = [];
  try {
    const raw = localStorage.getItem("basa_wisyo_assignments_v2");
    list = raw ? JSON.parse(raw) : [];
  } catch (e) {
    list = [];
  }

  if (typeof AUTH !== "undefined" && Array.isArray(AUTH.assignments) && AUTH.assignments.length > 0) {
    // Merge without duplicates
    const ids = new Set(list.map(a => a.id));
    AUTH.assignments.forEach(a => {
      if (!ids.has(a.id)) list.push(a);
    });
  }

  if (actor.role === "admin") return list;
  if (actor.role === "teacher") {
    return list.filter(a => a.teacherId === actor.id);
  }
  
  // Student: assignments matching student's section or all active
  const studentSection = typeof AUTH !== "undefined" && AUTH.currentUser?.section;
  return list.filter(a => {
    if (!studentSection) return true;
    return a.targetGroup === studentSection || a.section === studentSection || a.targetGroup === "All Students";
  });
}

/**
 * Removes or archives an assignment.
 * @param {string} assignmentId 
 * @param {Object} actor 
 * @returns {boolean}
 */
function removeAssignment(assignmentId, actor = typeof getStorageActor === "function" ? getStorageActor() : { id: "teacher", role: "teacher" }) {
  if (typeof AUTH !== "undefined" && Array.isArray(AUTH.assignments)) {
    AUTH.assignments = AUTH.assignments.filter(a => a.id !== assignmentId);
    if (typeof AUTH.saveAssignments === "function") AUTH.saveAssignments();
  }

  try {
    const raw = localStorage.getItem("basa_wisyo_assignments_v2");
    if (raw) {
      const list = JSON.parse(raw).filter(a => a.id !== assignmentId);
      localStorage.setItem("basa_wisyo_assignments_v2", JSON.stringify(list));
    }
  } catch (e) {}

  return true;
}

/**
 * Exports an assignment and its reading material as a versioned JSON content package.
 * Enables local-first distribution across school devices.
 * @param {string} assignmentId 
 * @returns {string} JSON package
 */
function exportAssignmentPackage(assignmentId) {
  const assignments = listAssignments({ role: "admin" });
  const a = assignments.find(item => item.id === assignmentId);
  if (!a) {
    throw new Error("Assignment not found for export.");
  }

  const pkg = {
    schemaVersion: ASSIGNMENT_PACKAGE_SCHEMA,
    exportedAt: Date.now(),
    assignment: {
      id: a.id,
      title: a.title,
      targetGroup: a.targetGroup,
      dueDate: a.dueDate,
      mode: a.mode,
      teacherName: a.teacherName,
      material: a.material
    }
  };

  return JSON.stringify(pkg, null, 2);
}

/**
 * Imports an assignment JSON package into this browser.
 * @param {string|Object} packageData 
 * @param {Object} actor 
 * @returns {Object}
 */
function importAssignmentPackage(packageData, actor = typeof getStorageActor === "function" ? getStorageActor() : { id: "guest", role: "guest" }) {
  let pkg = packageData;
  if (typeof pkg === "string") {
    try {
      pkg = JSON.parse(packageData);
    } catch (e) {
      throw new Error("Invalid assignment package: JSON parsing failed.");
    }
  }

  if (!pkg || pkg.schemaVersion !== ASSIGNMENT_PACKAGE_SCHEMA || !pkg.assignment) {
    throw new Error("Unsupported assignment package format or missing assignment content.");
  }

  const a = pkg.assignment;
  if (!a.material || !a.material.x || !Array.isArray(a.material.qs)) {
    throw new Error("Corrupted assignment package: Missing passage text or questions.");
  }

  const importedAssignment = {
    id: `ass_imp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    materialId: a.material.id,
    materialTitle: a.title || a.material.t,
    materialVersion: a.material.version || 1,
    passageId: a.material.id,
    title: a.title || a.material.t,
    targetGroup: a.targetGroup || "General",
    section: a.targetGroup || "General",
    teacherId: "imported",
    teacherName: a.teacherName || "Assigned by Teacher",
    dueDate: a.dueDate || "Flexible",
    mode: a.mode || "practice",
    status: "active",
    createdAt: Date.now(),
    material: a.material
  };

  if (typeof AUTH !== "undefined" && Array.isArray(AUTH.assignments)) {
    AUTH.assignments.unshift(importedAssignment);
    if (typeof AUTH.saveAssignments === "function") AUTH.saveAssignments();
  }

  try {
    const raw = localStorage.getItem("basa_wisyo_assignments_v2");
    const list = raw ? JSON.parse(raw) : [];
    list.unshift(importedAssignment);
    localStorage.setItem("basa_wisyo_assignments_v2", JSON.stringify(list));
  } catch (e) {}

  return importedAssignment;
}
