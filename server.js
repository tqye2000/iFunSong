const http = require("node:http");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawn, spawnSync } = require("node:child_process");

const ROOT = __dirname;
loadEnvFile(path.join(ROOT, ".env"));
const FETCH_NETWORK = configureFetchNetwork();
const PUBLIC_DIR = path.join(ROOT, "public");
const PROJECTS_DIR = path.join(ROOT, "projects");
const PORT = Number(process.env.PORT || process.argv.find((arg) => arg.startsWith("--port="))?.split("=")[1] || 4173);
const FFMPEG_PATH = resolveMediaTool("ffmpeg");
const FFPROBE_PATH = resolveMediaTool("ffprobe");
const OPENAI_API_BASE_URL = process.env.OPENAI_API_BASE_URL || "https://api.openai.com/v1";
const OPENAI_TRANSCRIPTION_MODEL = process.env.OPENAI_TRANSCRIPTION_MODEL || "whisper-1";
const OPENAI_TRANSCRIPTION_URL = process.env.OPENAI_TRANSCRIPTION_URL || `${OPENAI_API_BASE_URL}/audio/transcriptions`;
const LOCAL_TRANSCRIPTION_COMMAND = process.env.LOCAL_TRANSCRIPTION_COMMAND || "";
const OPENAI_AUDIO_EXTENSIONS = new Set([".flac", ".mp3", ".mp4", ".mpeg", ".mpga", ".m4a", ".ogg", ".wav", ".webm"]);
const OPENAI_DIRECT_AUDIO_MAX_BYTES = Number(process.env.OPENAI_DIRECT_AUDIO_MAX_BYTES || 24 * 1024 * 1024);

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
  backgroundDim: 0.25,
  karaoke: false,
  karaokeColor: "#ffd54a"
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

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

function loadExtraCaCerts() {
  // NODE_EXTRA_CA_CERTS is only honored by Node at process startup, before .env is
  // loaded. Re-read it here so a CA path set in .env actually takes effect for the
  // outbound dispatcher (the usual fix for "unable to get local issuer certificate").
  const caPath = process.env.OPENAI_CA_CERT || process.env.NODE_EXTRA_CA_CERTS;
  if (!caPath) return { ca: undefined };
  try {
    const ca = fs.readFileSync(caPath, "utf8");
    return { ca, caPath };
  } catch (error) {
    return { ca: undefined, caPath, caError: error.message };
  }
}

function configureFetchNetwork() {
  const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.https_proxy || process.env.http_proxy;
  const rejectUnauthorized = !["0", "false", "no"].includes(String(process.env.OPENAI_TLS_REJECT_UNAUTHORIZED || "true").toLowerCase());
  const { ca, caPath, caError } = loadExtraCaCerts();
  if (!proxyUrl && rejectUnauthorized && !ca) {
    return { proxyConfigured: false, tlsRejectUnauthorized: true, caPath, caError };
  }

  const tls = ca ? { rejectUnauthorized, ca } : { rejectUnauthorized };
  try {
    const { Agent, ProxyAgent, setGlobalDispatcher } = require("undici");
    if (proxyUrl) {
      setGlobalDispatcher(new ProxyAgent({
        uri: proxyUrl,
        requestTls: tls,
        proxyTls: tls
      }));
      return { proxyConfigured: true, proxy: redactUrl(proxyUrl), tlsRejectUnauthorized: rejectUnauthorized, caPath, caError };
    }
    setGlobalDispatcher(new Agent({ connect: tls }));
    return { proxyConfigured: false, tlsRejectUnauthorized: rejectUnauthorized, caPath, caError };
  } catch (error) {
    return {
      proxyConfigured: Boolean(proxyUrl),
      proxy: proxyUrl ? redactUrl(proxyUrl) : undefined,
      tlsRejectUnauthorized: rejectUnauthorized,
      caPath,
      caError,
      error: error.message
    };
  }
}

function redactUrl(value) {
  try {
    const url = new URL(value);
    if (url.username) url.username = "***";
    if (url.password) url.password = "***";
    return url.toString();
  } catch {
    return String(value || "").replace(/\/\/[^@\s]+@/, "//***@");
  }
}

function fetchErrorDetails(error) {
  const cause = error?.cause || {};
  return {
    name: error?.name,
    message: error?.message,
    code: cause.code,
    errno: cause.errno,
    syscall: cause.syscall,
    hostname: cause.hostname,
    causeMessage: cause.message
  };
}

function openAINetworkError(error) {
  const details = fetchErrorDetails(error);
  const reason = [details.code, details.causeMessage || details.message].filter(Boolean).join(": ");
  return httpError(
    502,
    `Could not reach the OpenAI API. ${reason || "The network request failed."} Check your internet connection, firewall, or HTTPS_PROXY setting.`,
    {
      openAIBaseUrl: OPENAI_API_BASE_URL,
      network: FETCH_NETWORK,
      cause: details
    }
  );
}

async function fetchOpenAI(url, options) {
  try {
    return await fetch(url, {
      ...options,
      signal: options?.signal || AbortSignal.timeout(Number(process.env.OPENAI_REQUEST_TIMEOUT_MS || 10 * 60 * 1000))
    });
  } catch (error) {
    throw openAINetworkError(error);
  }
}

function parseResponsePayload(responseText) {
  try {
    return JSON.parse(responseText);
  } catch {
    return { text: responseText };
  }
}

function summarizeHtmlOrText(text) {
  const value = String(text || "");
  const title = value.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const description = value.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1];
  const stripped = value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (title || description || stripped || value).slice(0, 500);
}

function openAIResponseError(status, fallback, payload) {
  const apiMessage = payload?.error?.message;
  if (apiMessage) return httpError(status, apiMessage, payload);
  if (payload?.text && /<html|<!doctype/i.test(payload.text)) {
    return httpError(
      status,
      `OpenAI API request was intercepted or blocked by a web security page: ${summarizeHtmlOrText(payload.text)}`,
      { textSummary: summarizeHtmlOrText(payload.text) }
    );
  }
  if (payload?.text) {
    return httpError(status, `${fallback}: ${summarizeHtmlOrText(payload.text)}`, { textSummary: summarizeHtmlOrText(payload.text) });
  }
  return httpError(status, fallback, payload);
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

function normalizeWordTimings(words) {
  if (!Array.isArray(words)) return undefined;
  const normalized = words
    .map((word) => {
      const startMs = Math.max(0, Math.round(Number(word.startMs) || Number(word.start) * 1000 || 0));
      const endMs = Math.max(0, Math.round(Number(word.endMs) || Number(word.end) * 1000 || 0));
      return { text: String(word.text || word.word || ""), startMs, endMs };
    })
    .filter((word) => word.text.trim() && word.endMs > word.startMs);
  return normalized.length ? normalized : undefined;
}

function normalizeTimedLyrics(lines) {
  if (!Array.isArray(lines)) return [];
  return lines.map((line, index) => {
    const normalized = {
      id: line.id || makeId("line"),
      index,
      startMs: Math.max(0, Math.round(Number(line.startMs) || 0)),
      endMs: Math.max(0, Math.round(Number(line.endMs) || 0)),
      text: String(line.text || "")
    };
    const words = normalizeWordTimings(line.words);
    if (words) normalized.words = words;
    return normalized;
  });
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

function getLyricTextLines(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function countWords(text) {
  const words = String(text || "").toLowerCase().match(/[a-z0-9'’]+/gi);
  return words ? words.length : 0;
}

function attachWordTimings(lines, words) {
  const normalized = normalizeWordTimings(words);
  if (!normalized) return lines;
  return lines.map((line) => {
    const inside = normalized.filter((word) => word.startMs >= line.startMs - 250 && word.startMs < line.endMs + 250);
    if (inside.length === 0) return line;
    return { ...line, words: inside };
  });
}

function segmentsToTimedLyrics(segments, fallbackDurationMs) {
  const normalized = (segments || [])
    .map((segment, index) => {
      const startMs = Math.max(0, Math.round(Number(segment.start) * 1000 || Number(segment.startMs) || 0));
      const endMs = Math.max(startMs + 500, Math.round(Number(segment.end) * 1000 || Number(segment.endMs) || startMs + 3000));
      return {
        id: makeId("line"),
        index,
        startMs,
        endMs,
        text: String(segment.text || "").trim()
      };
    })
    .filter((line) => line.text);

  if (normalized.length > 0) return normalized;
  return splitLyricsToTimedLines("", fallbackDurationMs);
}

function alignLyricLinesToSegments(rawLyrics, segments, fallbackDurationMs) {
  const lyricLines = getLyricTextLines(rawLyrics);
  if (lyricLines.length === 0) return segmentsToTimedLyrics(segments, fallbackDurationMs);

  const usableSegments = (segments || [])
    .map((segment) => ({
      startMs: Math.max(0, Math.round(Number(segment.start) * 1000 || Number(segment.startMs) || 0)),
      endMs: Math.max(0, Math.round(Number(segment.end) * 1000 || Number(segment.endMs) || 0)),
      text: String(segment.text || "").trim(),
      wordCount: Math.max(1, countWords(segment.text))
    }))
    .filter((segment) => segment.text && segment.endMs > segment.startMs);

  if (usableSegments.length === 0) {
    return splitLyricsToTimedLines(rawLyrics, fallbackDurationMs);
  }

  const totalSegmentWords = usableSegments.reduce((sum, segment) => sum + segment.wordCount, 0);
  const totalLyricWords = lyricLines.reduce((sum, line) => sum + Math.max(1, countWords(line)), 0);
  const result = [];
  let segmentIndex = 0;
  let consumedSegmentWords = 0;

  for (let lineIndex = 0; lineIndex < lyricLines.length; lineIndex += 1) {
    const line = lyricLines[lineIndex];
    const lineWordCount = Math.max(1, countWords(line));
    const targetSegmentWords = Math.max(1, Math.round((lineWordCount / totalLyricWords) * totalSegmentWords));
    const startSegment = usableSegments[Math.min(segmentIndex, usableSegments.length - 1)];
    let endSegment = startSegment;
    let gathered = 0;

    while (segmentIndex < usableSegments.length) {
      endSegment = usableSegments[segmentIndex];
      const remainingInSegment = endSegment.wordCount - consumedSegmentWords;
      gathered += Math.max(1, remainingInSegment);
      segmentIndex += 1;
      consumedSegmentWords = 0;
      if (gathered >= targetSegmentWords && lineIndex < lyricLines.length - 1) break;
    }

    if (lineIndex === lyricLines.length - 1) {
      endSegment = usableSegments[usableSegments.length - 1];
    }

    const previous = result[result.length - 1];
    const startMs = Math.max(previous ? previous.endMs + 20 : 0, startSegment.startMs);
    const endMs = Math.max(startMs + 600, endSegment.endMs);
    result.push({
      id: makeId("line"),
      index: lineIndex,
      startMs,
      endMs,
      text: line
    });
  }

  return result;
}

async function prepareAudioForOpenAI(project) {
  if (!project.audio) throw httpError(400, "Upload an audio file before extracting lyrics.");
  const originalPath = path.join(projectDir(project.id), project.audio.path);
  const ext = path.extname(originalPath).toLowerCase();
  const stat = await fsp.stat(originalPath);
  if (OPENAI_AUDIO_EXTENSIONS.has(ext) && stat.size <= OPENAI_DIRECT_AUDIO_MAX_BYTES) {
    return {
      path: originalPath,
      filename: project.audio.originalName || path.basename(originalPath),
      cleanup: null
    };
  }

  const ffmpeg = findTool(FFMPEG_PATH);
  if (!ffmpeg.available) {
    throw httpError(400, "This audio format needs FFmpeg conversion before OpenAI transcription, but FFmpeg is not available.", { ffmpeg });
  }

  const tempDir = path.join(projectDir(project.id), "tmp");
  await fsp.mkdir(tempDir, { recursive: true });
  const convertedPath = path.join(tempDir, `${makeId("transcribe")}.mp3`);
  await runProcess(FFMPEG_PATH, [
    "-y",
    "-i", originalPath,
    "-vn",
    "-acodec", "libmp3lame",
    "-ar", "44100",
    "-ac", "2",
    "-b:a", "192k",
    convertedPath
  ]);
  return {
    path: convertedPath,
    filename: `${safeName(project.audio.originalName || "audio").replace(/\.[^.]+$/, "")}.mp3`,
    cleanup: convertedPath
  };
}

async function transcribeWithOpenAI(project, options = {}) {
  const apiKey = String(options.apiKey || process.env.OPENAI_API_KEY || "").trim();
  if (!apiKey) {
    throw httpError(400, "No OpenAI API key was provided. Enter one in the UI or set OPENAI_API_KEY.");
  }

  const prepared = await prepareAudioForOpenAI(project);
  try {
    const audio = await fsp.readFile(prepared.path);
    const form = new FormData();
    form.append("file", new Blob([audio]), prepared.filename);
    form.append("model", options.model || OPENAI_TRANSCRIPTION_MODEL);
    form.append("response_format", "verbose_json");
    form.append("timestamp_granularities[]", "segment");
    form.append("timestamp_granularities[]", "word");

    const response = await fetchOpenAI(OPENAI_TRANSCRIPTION_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`
      },
      body: form
    });

    const responseText = await response.text();
    const payload = parseResponsePayload(responseText);

    if (!response.ok) {
      throw openAIResponseError(response.status, "OpenAI transcription request failed", payload);
    }

    const segments = Array.isArray(payload.segments) ? payload.segments : [];
    return {
      provider: "openai",
      model: options.model || OPENAI_TRANSCRIPTION_MODEL,
      text: String(payload.text || segments.map((segment) => segment.text).join("\n")).trim(),
      segments,
      words: Array.isArray(payload.words) ? payload.words : []
    };
  } finally {
    if (prepared.cleanup) {
      await fsp.rm(prepared.cleanup, { force: true }).catch(() => {});
    }
  }
}

async function checkOpenAIConnection(apiKey) {
  const key = String(apiKey || process.env.OPENAI_API_KEY || "").trim();
  if (!key) {
    throw httpError(400, "No OpenAI API key was provided. Enter one in the UI or set OPENAI_API_KEY.");
  }

  const response = await fetchOpenAI(`${OPENAI_API_BASE_URL}/models`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${key}`
    }
  });
  const responseText = await response.text();
  const payload = parseResponsePayload(responseText);
  if (!response.ok) {
    throw openAIResponseError(response.status, "OpenAI API key check failed", payload);
  }
  return {
    ok: true,
    modelCount: Array.isArray(payload.data) ? payload.data.length : null
  };
}

function parseCommandLine(commandLine) {
  const args = [];
  const pattern = /"([^"]*)"|'([^']*)'|([^\s]+)/g;
  let match;
  while ((match = pattern.exec(commandLine))) {
    args.push(match[1] ?? match[2] ?? match[3]);
  }
  return args;
}

async function transcribeWithLocalCommand(project) {
  if (!LOCAL_TRANSCRIPTION_COMMAND.trim()) {
    throw httpError(400, "No local transcription command is configured. Set LOCAL_TRANSCRIPTION_COMMAND to enable local fallback.");
  }
  if (!project.audio) throw httpError(400, "Upload an audio file before extracting lyrics.");

  const audioPath = path.join(projectDir(project.id), project.audio.path);
  const outDir = path.join(projectDir(project.id), "tmp");
  await fsp.mkdir(outDir, { recursive: true });
  const outputPath = path.join(outDir, `${makeId("local-transcript")}.json`);
  const commandLine = LOCAL_TRANSCRIPTION_COMMAND
    .replaceAll("{audio}", audioPath)
    .replaceAll("{output}", outputPath);
  const [command, ...args] = parseCommandLine(commandLine);
  if (!command) throw httpError(400, "LOCAL_TRANSCRIPTION_COMMAND is empty.");

  try {
    await runProcess(command, args, { cwd: projectDir(project.id) });
    const raw = await fsp.readFile(outputPath, "utf8");
    const payload = JSON.parse(raw);
    const segments = Array.isArray(payload.segments) ? payload.segments : [];
    return {
      provider: "local",
      model: command,
      text: String(payload.text || segments.map((segment) => segment.text).join("\n")).trim(),
      segments,
      words: Array.isArray(payload.words) ? payload.words : []
    };
  } finally {
    await fsp.rm(outputPath, { force: true }).catch(() => {});
  }
}

async function transcribeAudio(project, options = {}) {
  const provider = options.provider || "auto";
  const errors = [];

  const openAiFirst = provider === "openai" || (provider === "auto" && String(options.apiKey || process.env.OPENAI_API_KEY || "").trim());
  if (openAiFirst) {
    try {
      return await transcribeWithOpenAI(project, options);
    } catch (error) {
      errors.push(error.message);
      if (provider === "openai") throw error;
    }
  }

  if (provider === "local" || provider === "auto") {
    try {
      return await transcribeWithLocalCommand(project);
    } catch (error) {
      errors.push(error.message);
      if (provider === "local") throw error;
    }
  }

  if (!openAiFirst && (provider === "openai" || provider === "auto")) {
    try {
      return await transcribeWithOpenAI(project, options);
    } catch (error) {
      errors.push(error.message);
      if (provider === "openai") throw error;
    }
  }

  throw httpError(400, `No transcription provider succeeded. ${errors.join(" ")}`.trim());
}

async function saveTranscriptArtifacts(project, transcript, mode) {
  project.lyricMode = mode;
  project.transcription = {
    provider: transcript.provider,
    model: transcript.model,
    createdAt: nowIso(),
    segmentCount: transcript.segments?.length || 0
  };
  await writeProject(project);
  await writeSubtitleFiles(project);
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

function splitKaraokeTokens(text) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return [];
  if (clean.includes(" ")) {
    const parts = clean.split(" ");
    return parts.map((word, index) => (index < parts.length - 1 ? `${word} ` : word));
  }
  return Array.from(clean);
}

function karaokeSegments(line) {
  if (Array.isArray(line.words) && line.words.length > 0) {
    const segments = [];
    if (Number(line.words[0].startMs) > Number(line.startMs)) {
      segments.push({ text: "", durMs: Number(line.words[0].startMs) - Number(line.startMs) });
    }
    for (const word of line.words) {
      const durMs = Math.max(60, Number(word.endMs) - Number(word.startMs));
      const spaced = /[A-Za-z0-9]$/.test(word.text) ? `${word.text} ` : word.text;
      segments.push({ text: spaced, durMs });
    }
    return segments;
  }
  const tokens = splitKaraokeTokens(line.text);
  if (tokens.length === 0) return [];
  const totalMs = Math.max(200, Number(line.endMs) - Number(line.startMs));
  const perToken = totalMs / tokens.length;
  return tokens.map((token) => ({ text: token, durMs: perToken }));
}

function lyricLineToAssText(line, style) {
  if (!style.karaoke) return escapeAss(line.text);
  const segments = karaokeSegments(line);
  if (segments.length === 0) return escapeAss(line.text);
  return segments
    .map((segment) => `{\\kf${Math.max(1, Math.round(segment.durMs / 10))}}${escapeAss(segment.text)}`)
    .join("");
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
  const sungColor = style.karaoke ? (style.karaokeColor || DEFAULT_STYLE.karaokeColor) : style.color;
  const unsungColor = style.color;
  const lines = [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${layout.width}`,
    `PlayResY: ${layout.height}`,
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    `Style: Default,${style.fontFamily || "Arial"},${fontSize},${assColor(sungColor)},${assColor(unsungColor)},${assColor(style.outlineColor)},&H80000000,0,0,0,0,100,100,0,0,1,${outlineWidth},${shadow},${alignment},80,80,${marginV},1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"
  ];
  const lyricLines = project.timedLyrics || [];
  for (const line of lyricLines) {
    if (!String(line.text || "").trim()) continue;
    lines.push(`Dialogue: 0,${msToClock(line.startMs, ".").slice(0, -1)},${msToClock(line.endMs, ".").slice(0, -1)},Default,,0,0,0,,${lyricLineToAssText(line, style)}`);
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
      ffprobe: findTool(FFPROBE_PATH),
      transcription: {
        openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
        defaultOpenAIModel: OPENAI_TRANSCRIPTION_MODEL,
        localCommandConfigured: Boolean(LOCAL_TRANSCRIPTION_COMMAND),
        network: FETCH_NETWORK
      }
    });
  }

  if (req.method === "POST" && url.pathname === "/api/openai/check") {
    const body = await readJsonBody(req, 1024 * 1024);
    const result = await checkOpenAIConnection(body.apiKey);
    return sendJson(res, 200, result);
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

  if (req.method === "DELETE" && segments[3] === "images" && segments[4]) {
    const imageId = segments[4];
    const images = project.images || [];
    const target = images.find((image) => image.id === imageId);
    if (!target) throw httpError(404, "Image not found.");
    if (target.path) {
      const assetPath = ensureInside(projectDir(project.id), path.join(projectDir(project.id), target.path));
      await fsp.rm(assetPath, { force: true });
    }
    project.images = images.filter((image) => image.id !== imageId);
    if (project.layout?.mode === "auto") {
      project.layout = suggestAutoLayout(project);
    }
    await writeProject(project);
    return sendJson(res, 200, { project });
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
      source: "even-draft",
      note: "Draft timings were spread evenly across the audio."
    });
  }

  if (req.method === "POST" && segments[3] === "lyrics" && segments[4] === "extract") {
    const body = await readJsonBody(req, 5 * 1024 * 1024);
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

    const transcript = await transcribeAudio(project, {
      provider: body.provider || "auto",
      apiKey: body.apiKey,
      model: body.model || OPENAI_TRANSCRIPTION_MODEL
    });
    project.rawLyrics = transcript.text;
    project.timedLyrics = attachWordTimings(
      segmentsToTimedLyrics(transcript.segments, project.audio?.durationMs),
      transcript.words
    );
    await saveTranscriptArtifacts(project, transcript, "auto");
    return sendJson(res, 200, {
      project,
      source: transcript.provider,
      note: `Lyrics were transcribed with ${transcript.provider}${transcript.model ? ` (${transcript.model})` : ""}. Review timings before rendering.`
    });
  }

  if (req.method === "POST" && segments[3] === "lyrics" && segments[4] === "align") {
    const body = await readJsonBody(req, 5 * 1024 * 1024);
    const rawLyrics = String(body.rawLyrics || project.rawLyrics || "");
    if (!rawLyrics.trim()) {
      throw httpError(400, "Paste lyric text before aligning it to the song.");
    }
    const transcript = await transcribeAudio(project, {
      provider: body.provider || "auto",
      apiKey: body.apiKey,
      model: body.model || OPENAI_TRANSCRIPTION_MODEL
    });
    project.rawLyrics = rawLyrics;
    project.timedLyrics = alignLyricLinesToSegments(rawLyrics, transcript.segments, project.audio?.durationMs);
    await saveTranscriptArtifacts(project, transcript, "align");
    return sendJson(res, 200, {
      project,
      source: transcript.provider,
      note: `Pasted lyrics were aligned using ${transcript.provider}${transcript.model ? ` (${transcript.model})` : ""}. Review timings before rendering.`
    });
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

module.exports = { lyricsToAss, attachWordTimings, normalizeTimedLyrics };
