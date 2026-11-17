/* BasaMesh exchange controls. Camera scanning is optional; files work offline everywhere. */
let MESH_PENDING_INSPECTION = null;
let MESH_CAMERA_STREAM = null;
let MESH_SCAN_RUN = 0;

function meshShareablePassages() {
  const role = AUTH.currentUser?.role;
  const builtIn = [...PRACTICE_DATA.easy, ...PRACTICE_DATA.medium,
    ...PRACTICE_DATA.hard, ...PRACTICE_DATA.extreme];
  const custom = (Array.isArray(AUTH.customPassages) ? AUTH.customPassages : [])
    .filter(item => item?.status === "published" || (role === "teacher" && item?.ownerId === AUTH.currentUser.id)
      || role === "admin");
  const choices = [
    ...builtIn, ...custom,
    ...(!["teacher", "admin"].includes(role) && Array.isArray(S.sh) ? S.sh : [])
  ].flatMap(item => {
    try { return [normalizePassage(item)]; } catch (_) { return []; }
  });
  const allowed = ["teacher", "admin"].includes(role)
    ? choices : choices.filter(item => Array.isArray(S.done) && S.done.includes(item.id));
  return [...new Map(allowed.map(item => [item.id, item])).values()];
}

function renderBasaMeshModal() {
  const choices = meshShareablePassages();
  return `<div class="mesh-modal-head">
      <div><div class="lab">Offline story exchange</div><h2 id="mesh-heading">BasaMesh</h2></div>
      <button class="btn o sm" type="button" data-a="mesh-close" aria-label="Close BasaMesh">Close</button>
    </div>
    <p class="sub">Share a passage with questions between devices. Files work through Bluetooth file transfer, Nearby Share, AirDrop, or USB. No internet or account data is included.</p>
    <div class="mesh-grid">
      <section class="mesh-panel" aria-labelledby="mesh-send-heading">
        <h3 id="mesh-send-heading">Send a story</h3>
        <p class="sub-sm">${["teacher", "admin"].includes(AUTH.currentUser?.role)
          ? "Choose a built-in story or one you manage. Teacher drafts remain drafts when imported by another teacher."
          : "Completed stories can be shared. Finish reading a story first to add it here."}</p>
        <label for="mesh-send-passage">Passage</label>
        <select id="mesh-send-passage" class="auth-input" ${choices.length ? "" : "disabled"}>
          ${choices.length ? choices.map(item => `<option value="${escapeHTML(item.id)}">${escapeHTML(item.t)}</option>`).join("")
            : `<option>No completed passages yet</option>`}
        </select>
        <div class="mesh-actions">
          <button class="btn blue" data-a="mesh-download" ${choices.length ? "" : "disabled"}>Download .basamesh file</button>
          <button class="btn o" data-a="mesh-share-file" ${choices.length ? "" : "disabled"}>Share file on this device</button>
          <button class="btn o" data-a="mesh-show-qr" ${choices.length ? "" : "disabled"}>Show QR code</button>
        </div>
        <div id="mesh-send-result" class="mesh-result" role="status" aria-live="polite"></div>
      </section>
      <section class="mesh-panel" aria-labelledby="mesh-receive-heading">
        <h3 id="mesh-receive-heading">Receive a story</h3>
        <p class="sub-sm">Inspect the story and questions before saving. Received stories do not transfer scores, XP, or class membership.</p>
        <label class="btn o mesh-file-label" for="mesh-file-input">Choose .basamesh file</label>
        <input id="mesh-file-input" type="file" accept=".basamesh,application/json" hidden>
        <label for="mesh-receive-code">Or paste a BasaMesh code</label>
        <textarea id="mesh-receive-code" class="auth-input" rows="3" placeholder="BW1:..."></textarea>
        <div class="mesh-actions">
          <button class="btn blue" data-a="mesh-inspect-code">Preview code</button>
          <button class="btn o" data-a="mesh-scan-qr">Scan QR with camera</button>
        </div>
        <div id="mesh-camera" class="mesh-camera" hidden>
          <video id="mesh-video" autoplay muted playsinline aria-label="QR scanner camera preview"></video>
          <button class="btn o sm" data-a="mesh-stop-camera">Stop camera</button>
        </div>
        <div id="mesh-receive-result" class="mesh-result" role="status" aria-live="polite"></div>
        <div id="mesh-import-preview"></div>
      </section>
    </div>`;
}

function openBasaMeshModal() {
  MESH_PENDING_INSPECTION = null;
  const dialog = document.querySelector("#basamesh-modal");
  const body = document.querySelector("#basamesh-body");
  if (!dialog || !body) return;
  body.innerHTML = renderBasaMeshModal();
  const sendSelect = body.querySelector("#mesh-send-passage");
  showInlineDialog(dialog, sendSelect?.disabled ? body.querySelector("#mesh-receive-code") : sendSelect);
}

function stopBasaMeshCamera() {
  MESH_SCAN_RUN++;
  if (MESH_CAMERA_STREAM) {
    MESH_CAMERA_STREAM.getTracks().forEach(track => track.stop());
    MESH_CAMERA_STREAM = null;
  }
  const video = document.querySelector("#mesh-video");
  if (video) video.srcObject = null;
  const container = document.querySelector("#mesh-camera");
  if (container) container.hidden = true;
}

function closeBasaMeshModal() {
  stopBasaMeshCamera();
  MESH_PENDING_INSPECTION = null;
  closeInlineDialog(document.querySelector("#basamesh-modal"));
}

function meshSelectedPacket() {
  const id = document.querySelector("#mesh-send-passage")?.value;
  const passage = meshShareablePassages().find(item => item.id === id);
  if (!passage) throw new Error("Choose a passage to share.");
  return BASAMESH.createPacket(passage);
}

function meshDownloadPacket(packet) {
  const filename = packet.passage.t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "story";
  const blob = new Blob([JSON.stringify(packet, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.basamesh`;
  link.click();
  URL.revokeObjectURL(url);
  return blob;
}

function meshShowQr(packet) {
  const code = BASAMESH.encode(packet);
  if (code.length > BASAMESH.MAX_QR_CHARS) {
    throw new Error("This passage is too long for a reliable QR code. Download and share the file instead.");
  }
  if (typeof qrcode !== "function") throw new Error("Offline QR renderer is unavailable. Use the file option.");
  const qr = qrcode(0, "L");
  qr.addData(code, "Byte");
  qr.make();
  const result = document.querySelector("#mesh-send-result");
  if (result) result.innerHTML = `<div class="mesh-qr">${qr.createSvgTag(3, 4)}</div>
    <p class="sub-sm">Scan from another device. If its browser cannot scan QR, share the file instead.</p>
    <label for="mesh-share-code">Copyable code</label>
    <textarea id="mesh-share-code" class="auth-input" rows="3" readonly></textarea>
    <button class="btn o sm" data-a="mesh-copy-code">Copy code</button>`;
  const codeField = document.querySelector("#mesh-share-code");
  if (codeField) codeField.value = code;
}

function meshPreviewPacket(input) {
  MESH_PENDING_INSPECTION = null;
  const previousPreview = document.querySelector("#mesh-import-preview");
  if (previousPreview) previousPreview.innerHTML = "";
  const inspected = BASAMESH.inspect(input);
  MESH_PENDING_INSPECTION = inspected;
  stopBasaMeshCamera();
  const passage = inspected.passage;
  const duplicate = [...getPublishedPassages(), ...(AUTH.customPassages || [])]
    .some(item => BASAMESH.sameContent(item, passage));
  const preview = document.querySelector("#mesh-import-preview");
  if (preview) preview.innerHTML = `<div class="mesh-preview card">
      <div class="lab">Review before saving</div>
      <h4>${escapeHTML(passage.t)}</h4>
      <p class="sub-sm">${escapeHTML(passage.diff)} · ${passage.qs.length} questions · ${passage.x.split(/\s+/).length} words${inspected.legacy ? " · Older code" : ""}</p>
      <p>${escapeHTML(passage.x.slice(0, 360))}${passage.x.length > 360 ? "…" : ""}</p>
      ${passage.x.length > 360 ? `<details><summary>Read the full passage</summary><p>${escapeHTML(passage.x)}</p></details>` : ""}
      <details><summary>View questions</summary><ol>${passage.qs.map(q => `<li>${escapeHTML(q.q)}</li>`).join("")}</ol></details>
      ${duplicate ? `<p class="sub-sm" role="status">This exact story is already in your library.</p>` : ""}
      <button class="btn blue" data-a="mesh-import" ${duplicate ? "disabled" : ""}>Add to ${["teacher", "admin"].includes(AUTH.currentUser?.role) ? "managed passages" : "my library"}</button>
      <button class="btn o" data-a="mesh-cancel-preview">Cancel</button>
    </div>`;
}

async function startBasaMeshCamera() {
  const result = document.querySelector("#mesh-receive-result");
  if (typeof BarcodeDetector === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw new Error("This browser cannot scan QR codes here. Import a .basamesh file or paste a code.");
  }
  stopBasaMeshCamera();
  const run = MESH_SCAN_RUN;
  const detector = new BarcodeDetector({ formats: ["qr_code"] });
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
  if (run !== MESH_SCAN_RUN) { stream.getTracks().forEach(track => track.stop()); return; }
  MESH_CAMERA_STREAM = stream;
  const video = document.querySelector("#mesh-video");
  const container = document.querySelector("#mesh-camera");
  if (!video || !container) { stopBasaMeshCamera(); return; }
  video.srcObject = stream;
  container.hidden = false;
  await video.play();
  if (result) result.textContent = "Point the camera at a BasaMesh QR code.";
  async function scan() {
    if (run !== MESH_SCAN_RUN) return;
    try {
      const found = await detector.detect(video);
      if (found.length) {
        try {
          meshPreviewPacket(found[0].rawValue);
          return;
        } catch (error) {
          if (result) result.textContent = error.message;
        }
      }
    } catch (_) { /* Keep scanning while the camera is settling. */ }
    if (run === MESH_SCAN_RUN) setTimeout(scan, 250);
  }
  scan();
}
