const http = require("node:http");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawn, spawnSync } = require("node:child_process");

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const PROJECTS_DIR = path.join(ROOT, "projects");
const PORT = Number(process.env.PORT || process.argv.find((arg) => arg.startsWith("--port="))?.split("=")[1] || 4173);
const FFMPEG_PATH = resolveMediaTool("ffmpeg");
const FFPROBE_PATH = resolveMediaTool("ffprobe");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".srt": "application/x-subrip; charset=utf-8",
  ".lrc": "text/plain; charset=utf-8"
};

const DEFAULT_STYLE = {
  fontFamily: "Arial",
  fontSize: 54,
  color: "#ffffff",
  outlineColor: "#111111",
  outlineWidth: 3,
  shadow: true,
  position: "bottom",
  backgroundDim: 0.25
};

const DEFAULT_LAYOUT = {
  mode: "landscape",
  width: 1920,
  height: 1080,
  imageFit: "cover"
};

const DEFAULT_RENDER = {
  outputName: "ifunsong-video.mp4",
  videoCodec: "libx264",
  audioCodec: "aac",
  preset: "medium",
  crf: 20
};

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix = "id") {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

function resolveMediaTool(tool) {
  const envName = tool === "ffmpeg" ? "FFMPEG_PATH" : "FFPROBE_PATH";
  if (process.env[envName]) return process.env[envName];

  try {
    if (tool === "ffmpeg") {
      const ffmpegStatic = require("ffmpeg-static");
      if (ffmpegStatic) return typeof ffmpegStatic === "string" ? ffmpegStatic : ffmpegStatic.path;
    }
    if (tool === "ffprobe") {
      const ffprobeStatic = require("ffprobe-static");
      if (ffprobeStatic) return typeof ffprobeStatic === "string" ? ffprobeStatic : ffprobeStatic.path;
    }
  } catch {
    // Optional local binaries are not installed yet; fall back to PATH.
  }

  return tool;
}

function safeName(name) {
  const ext = path.extname(name || "").toLowerCase();
  const base = path.basename(name || "file", ext).replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "") || "file";
  return `${base.slice(0, 80)}${ext}`;
}

function projectDir(projectId) {
  return path.join(PROJECTS_DIR, projectId);
}

function projectFile(projectId) {
  return path.join(projectDir(projectId), "project.json");
}

function ensureInside(base, target) {
  const resolvedBase = path.resolve(base);
  const resolvedTarget = path.resolve(target);
  if (resolvedTarget !== resolvedBase && !resolvedTarget.startsWith(`${resolvedBase}${path.sep}`)) {
    throw httpError(400, "Invalid path.");
  }
  return resolvedTarget;
}

function httpError(status, message, details) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}

async function ensureDirs() {
  await fsp.mkdir(PROJECTS_DIR, { recursive: true });
}

function send(res, status, body, headers = {}) {
  const payload = typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body, null, 2);
  res.writeHead(status, {
    "Content-Type": typeof body === "object" && !Buffer.isBuffer(body) ? "application/json; charset=utf-8" : "text/plain; charset=utf-8",
    ...headers
  });
  res.end(payload);
}

function sendJson(res, status, body) {
  send(res, status, body, { "Content-Type": "application/json; charset=utf-8" });
}

async function readJsonBody(req, limitBytes = 180 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limitBytes) {
      throw httpError(413, "Request is too large for this local upload endpoint.");
    }
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw httpError(400, "Request body must be valid JSON.");
  }
}

async function readProject(projectId) {
  const file = ensureInside(PROJECTS_DIR, projectFile(projectId));
  const raw = await fsp.readFile(file, "utf8");
  return JSON.parse(raw);
}

async function writeProject(project) {
  project.updatedAt = nowIso();
  await fsp.mkdir(projectDir(project.id), { recursive: true });
  await fsp.writeFile(projectFile(project.id), `${JSON.stringify(project, null, 2)}\n`, "utf8");
  return project;
}

function createProject(name = "Untitled song video") {
  const id = makeId("project");
  const time = nowIso();
  return {
    id,
    name: String(name || "Untitled song video").slice(0, 120),
    createdAt: time,
    updatedAt: time,
    audio: null,
    images: [],
    lyricMode: "none",
    rawLyrics: "",
    timedLyrics: [],
    textOverlays: [],
    layout: { ...DEFAULT_LAYOUT },
    style: { ...DEFAULT_STYLE },
    render: { ...DEFAULT_RENDER }
  };
}

async function listProjects() {
  await ensureDirs();
  const entries = await fsp.readdir(PROJECTS_DIR, { withFileTypes: true });
  const projects = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      const project = await readProject(entry.name);
      projects.push({
        id: project.id,
        name: project.name,
        updatedAt: project.updatedAt,
        audioName: project.audio?.originalName || null,
        imageCount: project.images?.length || 0
      });
    } catch {
      // Ignore folders that are not valid projects.
    }
  }
  projects.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  return projects;
}

function findTool(command) {
  const result = spawnSync(command, ["-version"], { encoding: "utf8", windowsHide: true });
  return {
    available: result.status === 0,
    command,
    message: result.status === 0 ? firstLine(result.stdout) : firstLine(result.stderr) || `${command} is not available on PATH.`
  };
}

function firstLine(value) {
  return String(value || "").split(/\r?\n/).find(Boolean) || "";
}

function runProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { ...options, windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(httpError(500, `${path.basename(command)} failed.`, { code, stdout, stderr }));
    });
  });
}

async function probeMedia(filePath) {
  const tool = findTool(FFPROBE_PATH);
  if (!tool.available) {
    return { available: false, error: tool.message };
  }
  try {
    const result = await runProcess(FFPROBE_PATH, [
      "-v", "quiet",
      "-print_format", "json",
      "-show_format",
      "-show_streams",
      filePath
    ]);
    const json = JSON.parse(result.stdout);
    const duration = Number(json.format?.duration || json.streams?.find((stream) => stream.duration)?.duration || 0);
    return {
      available: true,
      durationMs: Number.isFinite(duration) && duration > 0 ? Math.round(duration * 1000) : null,
      formatName: json.format?.format_name || null,
      tags: json.format?.tags || {},
      streams: json.streams || []
    };
  } catch (error) {
    return { available: false, error: error.message };
  }
}

function detectEmbeddedLyrics(tags = {}) {
  const keys = Object.keys(tags);
  const lyricKey = keys.find((key) => /lyrics|unsyncedlyrics|syncedlyrics|lyricist/i.test(key));
  if (!lyricKey) return null;
  const value = String(tags[lyricKey] || "").trim();
  return value ? { key: lyricKey, text: value } : null;
}

function parseImageDimensions(buffer, extension) {
  const ext = extension.toLowerCase();
  if (ext === ".png" && buffer.length >= 24 && buffer.toString("ascii", 1, 4) === "PNG") {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if ((ext === ".jpg" || ext === ".jpeg") && buffer.length > 4) {
    return parseJpegDimensions(buffer);
  }
  if (ext === ".webp" && buffer.length >= 30 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    return parseWebpDimensions(buffer);
  }
  return { width: null, height: null };
}

function parseJpegDimensions(buffer) {
  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) break;
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xc3) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  return { width: null, height: null };
}

function parseWebpDimensions(buffer) {
  const chunk = buffer.toString("ascii", 12, 16);
  if (chunk === "VP8 " && buffer.length >= 30) {
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff
    };
  }
  if (chunk === "VP8L" && buffer.length >= 25) {
    const bits = buffer.readUInt32LE(21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1
    };
  }
  if (chunk === "VP8X" && buffer.length >= 30) {
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3)
    };
  }
  return { width: null, height: null };
}

async function saveDataFile(project, kind, file) {
  if (!file?.name || !file?.data) {
    throw httpError(400, "Each uploaded file needs a name and base64 data.");
  }
  const assetDir = path.join(projectDir(project.id), "assets", kind);
  await fsp.mkdir(assetDir, { recursive: true });
  const originalName = safeName(file.name);
  const ext = path.extname(originalName).toLowerCase();
  const storedName = `${makeId(kind)}-${originalName}`;
  const target = ensureInside(assetDir, path.join(assetDir, storedName));
  const buffer = Buffer.from(String(file.data), "base64");
  await fsp.writeFile(target, buffer);
  return {
    id: makeId(kind),
    originalName,
    storedName,
    path: path.relative(projectDir(project.id), target).replace(/\\/g, "/"),
    mimeType: file.mimeType || "",
    size: buffer.length,
    extension: ext,
    buffer
  };
}

function publicProjectAssetPath(projectId, relativePath) {
  return `/api/projects/${encodeURIComponent(projectId)}/asset/${relativePath.split("/").map(encodeURIComponent).join("/")}`;
}

function msToClock(ms, separator = ",") {
  const totalMs = Math.max(0, Math.round(Number(ms) || 0));
  const hours = Math.floor(totalMs / 3600000);
  const minutes = Math.floor((totalMs % 3600000) / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const millis = totalMs % 1000;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}${separator}${String(millis).padStart(3, "0")}`;
}

function msToLrc(ms) {
  const totalCs = Math.max(0, Math.round((Number(ms) || 0) / 10));
  const minutes = Math.floor(totalCs / 6000);
  const seconds = Math.floor((totalCs % 6000) / 100);
  const centis = totalCs % 100;
  return `${pad(minutes)}:${pad(seconds)}.${String(centis).padStart(2, "0")}`;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function lyricsToSrt(lines = []) {
  return lines
    .filter((line) => String(line.text || "").trim())
    .map((line, index) => {
      const start = msToClock(line.startMs);
      const end = msToClock(Math.max(Number(line.endMs) || 0, Number(line.startMs) + 500));
      return `${index + 1}\n${start} --> ${end}\n${String(line.text || "").trim()}`;
    })
    .join("\n\n")
    .concat("\n");
}

function lyricsToLrc(lines = []) {
  return lines
    .filter((line) => String(line.text || "").trim())
    .map((line) => `[${msToLrc(line.startMs)}]${String(line.text || "").trim()}`)
    .join("\n")
    .concat("\n");
}

function normalizeTimedLyrics(lines) {
  if (!Array.isArray(lines)) return [];
  return lines.map((line, index) => ({
    id: line.id || makeId("line"),
    index,
    startMs: Math.max(0, Math.round(Number(line.startMs) || 0)),
    endMs: Math.max(0, Math.round(Number(line.endMs) || 0)),
    text: String(line.text || "")
  }));
}

function splitLyricsToTimedLines(text, durationMs) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];
  const usableDuration = Math.max(1000, Number(durationMs) || lines.length * 3500);
  const segment = Math.max(1200, Math.floor(usableDuration / lines.length));
  return lines.map((line, index) => ({
    id: makeId("line"),
    index,
    startMs: index * segment,
    endMs: index === lines.length - 1 ? usableDuration : (index + 1) * segment - 120,
    text: line
  }));
}

async function writeSubtitleFiles(project) {
  const outDir = path.join(projectDir(project.id), "exports");
  await fsp.mkdir(outDir, { recursive: true });
  const srt = lyricsToSrt(project.timedLyrics);
  const lrc = lyricsToLrc(project.timedLyrics);
  await fsp.writeFile(path.join(outDir, "lyrics.srt"), srt, "utf8");
  await fsp.writeFile(path.join(outDir, "lyrics.lrc"), lrc, "utf8");
  return { srtPath: path.join(outDir, "lyrics.srt"), lrcPath: path.join(outDir, "lyrics.lrc") };
}

function assColor(hex, alpha = 0) {
  const match = String(hex || "#ffffff").match(/^#?([0-9a-f]{6})$/i);
  const value = match ? match[1] : "ffffff";
  const r = value.slice(0, 2);
  const g = value.slice(2, 4);
  const b = value.slice(4, 6);
  const a = Math.max(0, Math.min(255, Math.round(alpha))).toString(16).padStart(2, "0");
  return `&H${a}${b}${g}${r}`;
}

function escapeAss(text) {
  return String(text || "").replace(/[{}]/g, "").replace(/\r?\n/g, "\\N");
}

function lyricsToAss(project) {
  const layout = project.layout || DEFAULT_LAYOUT;
  const style = project.style || DEFAULT_STYLE;
  const durationMs = project.audio?.durationMs || Math.max(...(project.timedLyrics || []).map((line) => line.endMs), 30000);
  const alignment = style.position === "top" ? 8 : style.position === "center" ? 5 : 2;
  const marginV = style.position === "bottom" ? Math.round(layout.height * 0.11) : Math.round(layout.height * 0.08);
  const shadow = style.shadow ? 2 : 0;
  const fontSize = Math.max(18, Number(style.fontSize) || DEFAULT_STYLE.fontSize);
  const outlineWidth = Math.max(0, Number(style.outlineWidth) || 0);
  const lines = [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${layout.width}`,
    `PlayResY: ${layout.height}`,
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    `Style: Default,${style.fontFamily || "Arial"},${fontSize},${assColor(style.color)},${assColor(style.color)},${assColor(style.outlineColor)},&H80000000,0,0,0,0,100,100,0,0,1,${outlineWidth},${shadow},${alignment},80,80,${marginV},1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"
  ];
  const lyricLines = project.timedLyrics || [];
  for (const line of lyricLines) {
    if (!String(line.text || "").trim()) continue;
    lines.push(`Dialogue: 0,${msToClock(line.startMs, ".").slice(0, -1)},${msToClock(line.endMs, ".").slice(0, -1)},Default,,0,0,0,,${escapeAss(line.text)}`);
  }
  if (lyricLines.length === 0 && Array.isArray(project.textOverlays) && project.textOverlays.length > 0) {
    const text = project.textOverlays.map((overlay) => overlay.text).filter(Boolean).join("\\N");
    if (text) {
      lines.push(`Dialogue: 0,0:00:00.00,${msToClock(durationMs, ".").slice(0, -1)},Default,,0,0,0,,${escapeAss(text).replace(/\\\\N/g, "\\N")}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

async function writeAssFile(project) {
  const outDir = path.join(projectDir(project.id), "exports");
  await fsp.mkdir(outDir, { recursive: true });
  const assPath = path.join(outDir, "lyrics.ass");
  await fsp.writeFile(assPath, lyricsToAss(project), "utf8");
  return assPath;
}

function ffmpegPathValue(filePath) {
  return filePath.replace(/\\/g, "/").replace(/:/g, "\\:");
}

function makeScaleFilter(layout, fit) {
  const width = Number(layout.width) || 1920;
  const height = Number(layout.height) || 1080;
  if (fit === "contain") {
    return `scale=w=${width}:h=${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1`;
  }
  return `scale=w=${width}:h=${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1`;
}

function buildRenderArgs(project, assPath, outputPath) {
  const audioPath = path.join(projectDir(project.id), project.audio.path);
  const images = project.images || [];
  const layout = project.layout || DEFAULT_LAYOUT;
  const durationMs = project.audio?.durationMs || Math.max(...(project.timedLyrics || []).map((line) => line.endMs), 30000);
  const imageDuration = Math.max(1, (durationMs / 1000) / Math.max(1, images.length));
  const args = ["-y"];
  for (const image of images) {
    args.push("-loop", "1", "-t", String(imageDuration), "-i", path.join(projectDir(project.id), image.path));
  }
  args.push("-i", audioPath);

  const scaleFilter = makeScaleFilter(layout, layout.imageFit);
  const pieces = [];
  for (let index = 0; index < images.length; index += 1) {
    const dim = Math.max(0, Math.min(1, Number(project.style?.backgroundDim ?? DEFAULT_STYLE.backgroundDim)));
    pieces.push(`[${index}:v]${scaleFilter},format=rgba,colorchannelmixer=aa=1,drawbox=x=0:y=0:w=iw:h=ih:color=black@${dim}:t=fill[v${index}]`);
  }
  const concatInputs = images.map((_, index) => `[v${index}]`).join("");
  const hasText = (project.timedLyrics || []).length > 0 || (project.textOverlays || []).some((overlay) => String(overlay.text || "").trim());
  const subtitleFilter = hasText ? `,ass='${ffmpegPathValue(assPath)}'` : "";
  pieces.push(`${concatInputs}concat=n=${images.length}:v=1:a=0,format=yuv420p${subtitleFilter}[vout]`);

  args.push(
    "-filter_complex", pieces.join(";"),
    "-map", "[vout]",
    "-map", `${images.length}:a`,
    "-shortest",
    "-c:v", project.render?.videoCodec || DEFAULT_RENDER.videoCodec,
    "-preset", project.render?.preset || DEFAULT_RENDER.preset,
    "-crf", String(project.render?.crf || DEFAULT_RENDER.crf),
    "-c:a", project.render?.audioCodec || DEFAULT_RENDER.audioCodec,
    "-movflags", "+faststart",
    outputPath
  );
  return args;
}

async function renderProject(project) {
  if (!project.audio) throw httpError(400, "Upload an audio file before rendering.");
  if (!project.images || project.images.length === 0) throw httpError(400, "Upload at least one image before rendering.");
  const ffmpeg = findTool(FFMPEG_PATH);
  if (!ffmpeg.available) {
    throw httpError(400, "FFmpeg is not available. Install FFmpeg or set FFMPEG_PATH before rendering.", { ffmpeg });
  }
  await writeSubtitleFiles(project);
  const assPath = await writeAssFile(project);
  const rendersDir = path.join(projectDir(project.id), "renders");
  await fsp.mkdir(rendersDir, { recursive: true });
  const outputName = safeName(project.render?.outputName || DEFAULT_RENDER.outputName).replace(/\.[^.]+$/, "") + ".mp4";
  const outputPath = path.join(rendersDir, outputName);
  const args = buildRenderArgs(project, assPath, outputPath);
  await runProcess(FFMPEG_PATH, args, { cwd: projectDir(project.id) });
  project.lastRender = {
    outputName,
    path: path.relative(projectDir(project.id), outputPath).replace(/\\/g, "/"),
    createdAt: nowIso()
  };
  await writeProject(project);
  return project.lastRender;
}

async function handleApi(req, res, url) {
  const segments = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);

  if (req.method === "GET" && url.pathname === "/api/health") {
    return sendJson(res, 200, {
      ok: true,
      ffmpeg: findTool(FFMPEG_PATH),
      ffprobe: findTool(FFPROBE_PATH)
    });
  }

  if (req.method === "GET" && url.pathname === "/api/projects") {
    return sendJson(res, 200, { projects: await listProjects() });
  }

  if (req.method === "POST" && url.pathname === "/api/projects") {
    const body = await readJsonBody(req, 1024 * 1024);
    const project = createProject(body.name);
    await writeProject(project);
    return sendJson(res, 201, { project });
  }

  if (segments[0] !== "api" || segments[1] !== "projects" || !segments[2]) {
    throw httpError(404, "API route not found.");
  }

  const projectId = segments[2];
  const project = await readProject(projectId);

  if (req.method === "GET" && segments.length === 3) {
    return sendJson(res, 200, { project });
  }

  if (req.method === "PUT" && segments.length === 3) {
    const body = await readJsonBody(req);
    const incoming = body.project || {};
    const next = {
      ...project,
      name: String(incoming.name || project.name).slice(0, 120),
      lyricMode: incoming.lyricMode || project.lyricMode,
      rawLyrics: String(incoming.rawLyrics || ""),
      timedLyrics: normalizeTimedLyrics(incoming.timedLyrics),
      textOverlays: Array.isArray(incoming.textOverlays) ? incoming.textOverlays : [],
      layout: { ...DEFAULT_LAYOUT, ...incoming.layout },
      style: { ...DEFAULT_STYLE, ...incoming.style },
      render: { ...DEFAULT_RENDER, ...incoming.render }
    };
    await writeProject(next);
    return sendJson(res, 200, { project: next });
  }

  if (req.method === "POST" && segments[3] === "audio") {
    const body = await readJsonBody(req);
    const file = body.file;
    const saved = await saveDataFile(project, "audio", file);
    const probe = await probeMedia(path.join(projectDir(project.id), saved.path));
    project.audio = {
      id: saved.id,
      originalName: saved.originalName,
      storedName: saved.storedName,
      path: saved.path,
      url: publicProjectAssetPath(project.id, saved.path),
      mimeType: saved.mimeType,
      size: saved.size,
      durationMs: probe.durationMs || null,
      formatName: probe.formatName || null,
      metadataProbeAvailable: probe.available,
      metadataError: probe.error || null,
      embeddedLyrics: probe.available ? detectEmbeddedLyrics(probe.tags) : null
    };
    await writeProject(project);
    return sendJson(res, 200, { project, audio: project.audio });
  }

  if (req.method === "POST" && segments[3] === "images") {
    const body = await readJsonBody(req);
    const files = Array.isArray(body.files) ? body.files : [];
    if (files.length === 0) throw httpError(400, "Upload at least one image.");
    const savedImages = [];
    for (const file of files) {
      const saved = await saveDataFile(project, "images", file);
      const dimensions = parseImageDimensions(saved.buffer, saved.extension);
      savedImages.push({
        id: saved.id,
        originalName: saved.originalName,
        storedName: saved.storedName,
        path: saved.path,
        url: publicProjectAssetPath(project.id, saved.path),
        mimeType: saved.mimeType,
        size: saved.size,
        width: dimensions.width,
        height: dimensions.height
      });
    }
    project.images = [...(project.images || []), ...savedImages];
    if (project.layout?.mode === "auto") {
      project.layout = suggestAutoLayout(project);
    }
    await writeProject(project);
    return sendJson(res, 200, { project, images: savedImages });
  }

  if (req.method === "GET" && segments[3] === "asset") {
    const relativePath = segments.slice(4).join("/");
    const assetPath = ensureInside(projectDir(project.id), path.join(projectDir(project.id), relativePath));
    const ext = path.extname(assetPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    const content = await fsp.readFile(assetPath);
    res.writeHead(200, { "Content-Type": contentType });
    return res.end(content);
  }

  if (req.method === "POST" && segments[3] === "lyrics" && segments[4] === "draft") {
    const body = await readJsonBody(req, 5 * 1024 * 1024);
    const rawLyrics = String(body.rawLyrics || project.rawLyrics || "");
    project.rawLyrics = rawLyrics;
    project.lyricMode = rawLyrics.trim() ? "align" : "none";
    project.timedLyrics = splitLyricsToTimedLines(rawLyrics, project.audio?.durationMs);
    await writeProject(project);
    await writeSubtitleFiles(project);
    return sendJson(res, 200, {
      project,
      note: "Draft timings were spread evenly across the audio. AI transcription/alignment provider integration is planned for the next phase."
    });
  }

  if (req.method === "POST" && segments[3] === "lyrics" && segments[4] === "extract") {
    if (project.audio?.embeddedLyrics?.text) {
      project.rawLyrics = project.audio.embeddedLyrics.text;
      project.lyricMode = "auto";
      project.timedLyrics = splitLyricsToTimedLines(project.rawLyrics, project.audio.durationMs);
      await writeProject(project);
      await writeSubtitleFiles(project);
      return sendJson(res, 200, {
        project,
        source: "embedded-metadata",
        note: "Embedded lyrics were found. Timings were spread evenly because embedded timing was not detected."
      });
    }
    throw httpError(501, "Automatic transcription is not implemented yet. Add lyrics manually for now, or configure an AI/local provider in the next phase.");
  }

  if (req.method === "PUT" && segments[3] === "lyrics") {
    const body = await readJsonBody(req);
    project.timedLyrics = normalizeTimedLyrics(body.timedLyrics);
    await writeProject(project);
    await writeSubtitleFiles(project);
    return sendJson(res, 200, { project });
  }

  if (req.method === "GET" && segments[3] === "lyrics.srt") {
    const srt = lyricsToSrt(project.timedLyrics);
    return send(res, 200, srt, {
      "Content-Type": MIME_TYPES[".srt"],
      "Content-Disposition": `attachment; filename="${safeName(project.name)}.srt"`
    });
  }

  if (req.method === "GET" && segments[3] === "lyrics.lrc") {
    const lrc = lyricsToLrc(project.timedLyrics);
    return send(res, 200, lrc, {
      "Content-Type": MIME_TYPES[".lrc"],
      "Content-Disposition": `attachment; filename="${safeName(project.name)}.lrc"`
    });
  }

  if (req.method === "POST" && segments[3] === "render") {
    const lastRender = await renderProject(project);
    return sendJson(res, 200, { project, lastRender });
  }

  if (req.method === "GET" && segments[3] === "render" && segments[4] === "output") {
    if (!project.lastRender?.path) throw httpError(404, "This project does not have a rendered MP4 yet.");
    const outputPath = ensureInside(projectDir(project.id), path.join(projectDir(project.id), project.lastRender.path));
    const content = await fsp.readFile(outputPath);
    res.writeHead(200, {
      "Content-Type": "video/mp4",
      "Content-Disposition": `attachment; filename="${project.lastRender.outputName}"`
    });
    return res.end(content);
  }

  throw httpError(404, "API route not found.");
}

function suggestAutoLayout(project) {
  const images = project.images || [];
  const ratios = images
    .filter((image) => image.width && image.height)
    .map((image) => image.width / image.height);
  if (ratios.length === 0) return { ...DEFAULT_LAYOUT, mode: "auto" };
  const avg = ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length;
  if (avg < 0.85) return { ...DEFAULT_LAYOUT, mode: "auto", width: 1080, height: 1920 };
  if (avg > 1.2) return { ...DEFAULT_LAYOUT, mode: "auto", width: 1920, height: 1080 };
  return { ...DEFAULT_LAYOUT, mode: "auto", width: 1080, height: 1080 };
}

async function serveStatic(req, res, url) {
  const requested = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
  const filePath = ensureInside(PUBLIC_DIR, path.join(PUBLIC_DIR, requested));
  try {
    const stat = await fsp.stat(filePath);
    if (!stat.isFile()) throw httpError(404, "Not found.");
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
    fs.createReadStream(filePath).pipe(res);
  } catch {
    const indexPath = path.join(PUBLIC_DIR, "index.html");
    res.writeHead(200, { "Content-Type": MIME_TYPES[".html"] });
    fs.createReadStream(indexPath).pipe(res);
  }
}

async function handleRequest(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
    } else {
      await serveStatic(req, res, url);
    }
  } catch (error) {
    const status = error.status || 500;
    sendJson(res, status, {
      error: error.message || "Unexpected server error.",
      details: error.details
    });
  }
}

ensureDirs()
  .then(() => {
    http.createServer(handleRequest).listen(PORT, () => {
      console.log(`iFunSong local app running at http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
