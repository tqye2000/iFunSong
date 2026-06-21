const state = {
  project: null,
  projects: []
};

const els = {
  statusText: document.querySelector("#statusText"),
  projectSelect: document.querySelector("#projectSelect"),
  loadProjectBtn: document.querySelector("#loadProjectBtn"),
  newProjectBtn: document.querySelector("#newProjectBtn"),
  projectName: document.querySelector("#projectName"),
  saveProjectBtn: document.querySelector("#saveProjectBtn"),
  healthBtn: document.querySelector("#healthBtn"),
  audioInput: document.querySelector("#audioInput"),
  imageInput: document.querySelector("#imageInput"),
  audioLabel: document.querySelector("#audioLabel"),
  audioPreview: document.querySelector("#audioPreview"),
  audioMeta: document.querySelector("#audioMeta"),
  imageStrip: document.querySelector("#imageStrip"),
  tabs: document.querySelectorAll(".tab"),
  tabPanels: {
    lyrics: document.querySelector("#lyricsTab"),
    style: document.querySelector("#styleTab"),
    render: document.querySelector("#renderTab")
  },
  lyricMode: document.querySelector("#lyricMode"),
  rawLyrics: document.querySelector("#rawLyrics"),
  extractLyricsBtn: document.querySelector("#extractLyricsBtn"),
  draftLyricsBtn: document.querySelector("#draftLyricsBtn"),
  addLyricLineBtn: document.querySelector("#addLyricLineBtn"),
  lyricsTableBody: document.querySelector("#lyricsTableBody"),
  srtLink: document.querySelector("#srtLink"),
  lrcLink: document.querySelector("#lrcLink"),
  layoutMode: document.querySelector("#layoutMode"),
  imageFit: document.querySelector("#imageFit"),
  textPosition: document.querySelector("#textPosition"),
  fontSize: document.querySelector("#fontSize"),
  textColor: document.querySelector("#textColor"),
  outlineColor: document.querySelector("#outlineColor"),
  outlineWidth: document.querySelector("#outlineWidth"),
  backgroundDim: document.querySelector("#backgroundDim"),
  textShadow: document.querySelector("#textShadow"),
  smartStyleBtn: document.querySelector("#smartStyleBtn"),
  previewImage: document.querySelector("#previewImage"),
  previewDim: document.querySelector("#previewDim"),
  previewLyric: document.querySelector("#previewLyric"),
  textOverlays: document.querySelector("#textOverlays"),
  renderBtn: document.querySelector("#renderBtn"),
  renderStatus: document.querySelector("#renderStatus"),
  mp4Link: document.querySelector("#mp4Link")
};

function setStatus(message, isError = false) {
  els.statusText.textContent = message;
  els.statusText.style.color = isError ? "#b42318" : "";
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    const message = payload?.error || payload || `Request failed: ${response.status}`;
    const error = new Error(message);
    error.details = payload?.details;
    throw error;
  }
  return payload;
}

function currentProjectId() {
  return state.project?.id;
}

async function loadProjectList() {
  const payload = await api("/api/projects");
  state.projects = payload.projects || [];
  els.projectSelect.innerHTML = "";
  if (state.projects.length === 0) {
    els.projectSelect.append(new Option("No saved projects", ""));
    return;
  }
  for (const project of state.projects) {
    const label = `${project.name} (${project.imageCount} image${project.imageCount === 1 ? "" : "s"})`;
    els.projectSelect.append(new Option(label, project.id));
  }
  if (state.project) els.projectSelect.value = state.project.id;
}

async function createProject() {
  const name = els.projectName.value.trim() || "Untitled song video";
  const payload = await api("/api/projects", {
    method: "POST",
    body: JSON.stringify({ name })
  });
  setProject(payload.project);
  await loadProjectList();
  setStatus("New project created.");
}

async function openSelectedProject() {
  const id = els.projectSelect.value;
  if (!id) return;
  const payload = await api(`/api/projects/${encodeURIComponent(id)}`);
  setProject(payload.project);
  setStatus("Project loaded.");
}

async function saveProject() {
  if (!state.project) return createProject();
  pullFormIntoProject();
  const payload = await api(`/api/projects/${encodeURIComponent(state.project.id)}`, {
    method: "PUT",
    body: JSON.stringify({ project: state.project })
  });
  setProject(payload.project);
  await loadProjectList();
  setStatus("Project saved.");
}

function setProject(project) {
  state.project = project;
  els.projectName.value = project.name || "";
  els.lyricMode.value = project.lyricMode || "none";
  els.rawLyrics.value = project.rawLyrics || "";
  els.textOverlays.value = (project.textOverlays || []).map((item) => item.text).join("\n");
  fillStyleForm(project);
  renderMediaSummary();
  renderLyricsTable();
  updateDownloadLinks();
  updatePreview();
  updateRenderLink();
}

function pullFormIntoProject() {
  if (!state.project) return;
  state.project.name = els.projectName.value.trim() || "Untitled song video";
  state.project.lyricMode = els.lyricMode.value;
  state.project.rawLyrics = els.rawLyrics.value;
  state.project.timedLyrics = readLyricsTable();
  state.project.textOverlays = els.textOverlays.value
    .split(/\r?\n/)
    .map((text) => text.trim())
    .filter(Boolean)
    .map((text, index) => ({ id: `overlay_${index}`, text }));
  state.project.layout = layoutFromForm();
  state.project.style = styleFromForm();
}

function fillStyleForm(project) {
  const layout = project.layout || {};
  const style = project.style || {};
  els.layoutMode.value = layout.mode || "landscape";
  els.imageFit.value = layout.imageFit || "cover";
  els.textPosition.value = style.position || "bottom";
  els.fontSize.value = style.fontSize || 54;
  els.textColor.value = style.color || "#ffffff";
  els.outlineColor.value = style.outlineColor || "#111111";
  els.outlineWidth.value = style.outlineWidth ?? 3;
  els.backgroundDim.value = style.backgroundDim ?? 0.25;
  els.textShadow.checked = style.shadow !== false;
}

function layoutFromForm() {
  const mode = els.layoutMode.value;
  const presets = {
    landscape: { width: 1920, height: 1080 },
    portrait: { width: 1080, height: 1920 },
    square: { width: 1080, height: 1080 },
    auto: suggestAutoLayout()
  };
  return {
    mode,
    ...(presets[mode] || presets.landscape),
    imageFit: els.imageFit.value
  };
}

function suggestAutoLayout() {
  const images = state.project?.images || [];
  const ratios = images.filter((image) => image.width && image.height).map((image) => image.width / image.height);
  if (!ratios.length) return { width: 1920, height: 1080 };
  const average = ratios.reduce((sum, value) => sum + value, 0) / ratios.length;
  if (average < 0.85) return { width: 1080, height: 1920 };
  if (average > 1.2) return { width: 1920, height: 1080 };
  return { width: 1080, height: 1080 };
}

function styleFromForm() {
  return {
    fontFamily: "Arial",
    fontSize: Number(els.fontSize.value) || 54,
    color: els.textColor.value,
    outlineColor: els.outlineColor.value,
    outlineWidth: Number(els.outlineWidth.value) || 0,
    shadow: els.textShadow.checked,
    position: els.textPosition.value,
    backgroundDim: Number(els.backgroundDim.value) || 0
  };
}

function renderMediaSummary() {
  const project = state.project;
  if (!project) return;

  if (project.audio) {
    els.audioLabel.textContent = project.audio.originalName;
    els.audioPreview.src = project.audio.url;
    const duration = project.audio.durationMs ? formatMs(project.audio.durationMs) : "duration unknown";
    const probeNote = project.audio.metadataProbeAvailable ? "" : " FFprobe is not available, so metadata is limited.";
    els.audioMeta.textContent = `${duration}. ${formatBytes(project.audio.size)}.${probeNote}`;
  } else {
    els.audioLabel.textContent = "Choose MP3, WAV, or FFmpeg-readable audio";
    els.audioPreview.removeAttribute("src");
    els.audioMeta.textContent = "No audio uploaded yet.";
  }

  els.imageStrip.innerHTML = "";
  for (const image of project.images || []) {
    const img = document.createElement("img");
    img.src = image.url;
    img.alt = image.originalName;
    img.title = `${image.originalName}${image.width ? ` (${image.width}x${image.height})` : ""}`;
    els.imageStrip.append(img);
  }
}

function renderLyricsTable() {
  const lines = state.project?.timedLyrics || [];
  els.lyricsTableBody.innerHTML = "";
  for (const line of lines) {
    addLyricRow(line);
  }
  if (!lines.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 4;
    cell.className = "muted";
    cell.textContent = "No timed lyrics yet.";
    row.append(cell);
    els.lyricsTableBody.append(row);
  }
}

function addLyricRow(line = {}) {
  const empty = els.lyricsTableBody.querySelector("td[colspan]");
  if (empty) els.lyricsTableBody.innerHTML = "";

  const row = document.createElement("tr");
  row.dataset.id = line.id || crypto.randomUUID();

  const startCell = document.createElement("td");
  const startInput = document.createElement("input");
  startInput.type = "text";
  startInput.value = msToInput(line.startMs || 0);
  startInput.ariaLabel = "Start time";
  startCell.append(startInput);

  const endCell = document.createElement("td");
  const endInput = document.createElement("input");
  endInput.type = "text";
  endInput.value = msToInput(line.endMs || (line.startMs || 0) + 3000);
  endInput.ariaLabel = "End time";
  endCell.append(endInput);

  const textCell = document.createElement("td");
  const textInput = document.createElement("textarea");
  textInput.rows = 1;
  textInput.value = line.text || "";
  textInput.ariaLabel = "Lyric text";
  textCell.append(textInput);

  const actionCell = document.createElement("td");
  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "line-remove";
  removeBtn.textContent = "X";
  removeBtn.title = "Remove line";
  removeBtn.addEventListener("click", () => {
    row.remove();
    pullFormIntoProject();
    updatePreview();
  });
  actionCell.append(removeBtn);

  for (const input of [startInput, endInput, textInput]) {
    input.addEventListener("input", () => {
      pullFormIntoProject();
      updatePreview();
    });
  }

  row.append(startCell, endCell, textCell, actionCell);
  els.lyricsTableBody.append(row);
}

function readLyricsTable() {
  return [...els.lyricsTableBody.querySelectorAll("tr")]
    .filter((row) => !row.querySelector("td[colspan]"))
    .map((row, index) => {
      const [startInput, endInput, textInput] = row.querySelectorAll("input, textarea");
      return {
        id: row.dataset.id || `line_${index}`,
        index,
        startMs: inputToMs(startInput.value),
        endMs: inputToMs(endInput.value),
        text: textInput.value
      };
    });
}

async function uploadAudio() {
  if (!state.project) await createProject();
  const file = els.audioInput.files?.[0];
  if (!file) return;
  setStatus("Uploading audio...");
  const payload = await api(`/api/projects/${encodeURIComponent(currentProjectId())}/audio`, {
    method: "POST",
    body: JSON.stringify({ file: await fileToPayload(file) })
  });
  setProject(payload.project);
  await loadProjectList();
  setStatus("Audio uploaded.");
}

async function uploadImages() {
  if (!state.project) await createProject();
  const files = [...(els.imageInput.files || [])];
  if (!files.length) return;
  setStatus(`Uploading ${files.length} image${files.length === 1 ? "" : "s"}...`);
  const payload = await api(`/api/projects/${encodeURIComponent(currentProjectId())}/images`, {
    method: "POST",
    body: JSON.stringify({ files: await Promise.all(files.map(fileToPayload)) })
  });
  setProject(payload.project);
  await loadProjectList();
  setStatus("Images uploaded.");
}

function fileToPayload(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const result = String(reader.result || "");
      resolve({
        name: file.name,
        mimeType: file.type,
        data: result.split(",")[1] || ""
      });
    });
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

async function draftLyrics() {
  if (!state.project) await createProject();
  setStatus("Creating draft timings...");
  const payload = await api(`/api/projects/${encodeURIComponent(currentProjectId())}/lyrics/draft`, {
    method: "POST",
    body: JSON.stringify({ rawLyrics: els.rawLyrics.value })
  });
  setProject(payload.project);
  setStatus(payload.note || "Draft timings created.");
}

async function extractLyrics() {
  if (!state.project) await createProject();
  setStatus("Checking embedded lyrics...");
  try {
    const payload = await api(`/api/projects/${encodeURIComponent(currentProjectId())}/lyrics/extract`, {
      method: "POST",
      body: JSON.stringify({})
    });
    setProject(payload.project);
    setStatus(payload.note || "Lyrics extracted.");
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function saveLyricsOnly() {
  if (!state.project) return;
  pullFormIntoProject();
  const payload = await api(`/api/projects/${encodeURIComponent(currentProjectId())}/lyrics`, {
    method: "PUT",
    body: JSON.stringify({ timedLyrics: state.project.timedLyrics })
  });
  setProject(payload.project);
}

async function renderVideo() {
  if (!state.project) await createProject();
  pullFormIntoProject();
  await saveProject();
  els.renderBtn.disabled = true;
  els.renderStatus.textContent = "Rendering. FFmpeg can take a while for full-length songs.";
  setStatus("Rendering MP4...");
  try {
    const payload = await api(`/api/projects/${encodeURIComponent(currentProjectId())}/render`, {
      method: "POST",
      body: JSON.stringify({})
    });
    setProject(payload.project);
    els.renderStatus.textContent = "Render complete.";
    setStatus("MP4 render complete.");
  } catch (error) {
    els.renderStatus.textContent = error.message;
    setStatus(error.message, true);
  } finally {
    els.renderBtn.disabled = false;
  }
}

function updateDownloadLinks() {
  if (!state.project) return;
  const id = encodeURIComponent(state.project.id);
  els.srtLink.href = `/api/projects/${id}/lyrics.srt`;
  els.lrcLink.href = `/api/projects/${id}/lyrics.lrc`;
}

function updateRenderLink() {
  if (!state.project?.lastRender) {
    els.mp4Link.classList.add("hidden");
    els.mp4Link.href = "#";
    els.renderStatus.textContent = "No render yet.";
    return;
  }
  els.mp4Link.classList.remove("hidden");
  els.mp4Link.href = `/api/projects/${encodeURIComponent(state.project.id)}/render/output`;
  els.renderStatus.textContent = `Last render: ${state.project.lastRender.outputName}`;
}

function updatePreview() {
  if (!state.project) return;
  const layout = layoutFromForm();
  const style = styleFromForm();
  const firstImage = state.project.images?.[0];
  if (firstImage) {
    els.previewImage.src = firstImage.url;
    els.previewImage.style.objectFit = layout.imageFit;
  } else {
    els.previewImage.removeAttribute("src");
  }

  const stage = document.querySelector(".preview-stage");
  stage.style.aspectRatio = `${layout.width} / ${layout.height}`;
  els.previewDim.style.background = `rgba(0, 0, 0, ${style.backgroundDim})`;
  els.previewLyric.style.color = style.color;
  els.previewLyric.style.fontSize = `${Math.max(18, Math.round(style.fontSize * 0.62))}px`;
  els.previewLyric.style.textShadow = style.shadow
    ? `0 2px 10px rgba(0,0,0,0.9), 0 0 2px ${style.outlineColor}`
    : `0 0 ${style.outlineWidth}px ${style.outlineColor}`;
  els.previewLyric.style.top = "";
  els.previewLyric.style.bottom = "";
  els.previewLyric.style.transform = "";
  if (style.position === "top") {
    els.previewLyric.style.top = "9%";
  } else if (style.position === "center") {
    els.previewLyric.style.top = "50%";
    els.previewLyric.style.transform = "translateY(-50%)";
  } else {
    els.previewLyric.style.bottom = "10%";
  }
  const firstLine = readLyricsTable().find((line) => line.text.trim())?.text;
  const overlayText = els.textOverlays.value.split(/\r?\n/).find(Boolean);
  els.previewLyric.textContent = firstLine || overlayText || "Your lyric preview appears here";
}

async function checkTools() {
  const payload = await api("/api/health");
  const ffmpeg = payload.ffmpeg.available ? "FFmpeg available" : "FFmpeg missing";
  const ffprobe = payload.ffprobe.available ? "FFprobe available" : "FFprobe missing";
  setStatus(`${ffmpeg}. ${ffprobe}.`, !payload.ffmpeg.available || !payload.ffprobe.available);
}

function applySmartStyle() {
  els.textPosition.value = "bottom";
  els.fontSize.value = 54;
  els.textColor.value = "#ffffff";
  els.outlineColor.value = "#111111";
  els.outlineWidth.value = 3;
  els.backgroundDim.value = 0.25;
  els.textShadow.checked = true;
  pullFormIntoProject();
  updatePreview();
}

function msToInput(ms) {
  const value = Math.max(0, Math.round(Number(ms) || 0));
  const minutes = Math.floor(value / 60000);
  const seconds = Math.floor((value % 60000) / 1000);
  const millis = value % 1000;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

function inputToMs(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(?:(\d+):)?(\d{1,2})(?:[.,](\d{1,3}))?$/);
  if (!match) return Math.max(0, Math.round(Number(text) || 0));
  const minutes = Number(match[1] || 0);
  const seconds = Number(match[2] || 0);
  const millis = Number(String(match[3] || "0").padEnd(3, "0"));
  return minutes * 60000 + seconds * 1000 + millis;
}

function formatMs(ms) {
  const total = Math.max(0, Math.round(Number(ms) || 0));
  const minutes = Math.floor(total / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function switchTab(name) {
  for (const tab of els.tabs) {
    tab.classList.toggle("active", tab.dataset.tab === name);
  }
  for (const [key, panel] of Object.entries(els.tabPanels)) {
    panel.classList.toggle("active", key === name);
  }
  updatePreview();
}

function bindEvents() {
  els.newProjectBtn.addEventListener("click", () => createProject().catch(showError));
  els.loadProjectBtn.addEventListener("click", () => openSelectedProject().catch(showError));
  els.saveProjectBtn.addEventListener("click", () => saveProject().catch(showError));
  els.healthBtn.addEventListener("click", () => checkTools().catch(showError));
  els.audioInput.addEventListener("change", () => uploadAudio().catch(showError));
  els.imageInput.addEventListener("change", () => uploadImages().catch(showError));
  els.extractLyricsBtn.addEventListener("click", () => extractLyrics().catch(showError));
  els.draftLyricsBtn.addEventListener("click", () => draftLyrics().catch(showError));
  els.addLyricLineBtn.addEventListener("click", () => {
    const lines = readLyricsTable();
    const lastEnd = lines.at(-1)?.endMs || 0;
    addLyricRow({ startMs: lastEnd, endMs: lastEnd + 3000, text: "" });
    pullFormIntoProject();
  });
  els.renderBtn.addEventListener("click", () => renderVideo().catch(showError));
  els.smartStyleBtn.addEventListener("click", applySmartStyle);
  for (const tab of els.tabs) {
    tab.addEventListener("click", () => switchTab(tab.dataset.tab));
  }
  for (const input of [
    els.projectName,
    els.lyricMode,
    els.rawLyrics,
    els.layoutMode,
    els.imageFit,
    els.textPosition,
    els.fontSize,
    els.textColor,
    els.outlineColor,
    els.outlineWidth,
    els.backgroundDim,
    els.textShadow,
    els.textOverlays
  ]) {
    input.addEventListener("input", () => {
      pullFormIntoProject();
      updatePreview();
    });
  }
  window.addEventListener("beforeunload", () => {
    pullFormIntoProject();
  });
}

function showError(error) {
  console.error(error);
  setStatus(error.message || "Something went wrong.", true);
}

async function init() {
  bindEvents();
  await loadProjectList();
  if (state.projects[0]) {
    els.projectSelect.value = state.projects[0].id;
    await openSelectedProject();
  } else {
    await createProject();
  }
  await checkTools().catch(() => {});
}

init().catch(showError);
