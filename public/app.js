// iFunSong frontend controller: manages project state, uploads, lyrics, preview, and rendering.
const state = {
  project: null,
  projects: [],
  language: localStorage.getItem("ifunsong.uiLanguage") || "en"
};

const I18N = {
  en: {
    "aria.interfaceLanguage": "Interface language",
    "aria.savedProjects": "Saved projects",
    "aria.projectSetup": "Project setup",
    "aria.lyricsRendering": "Lyrics and rendering",
    "aria.imagePreviews": "Uploaded image previews",
    "aria.workflowSections": "Workflow sections",
    "aria.lyricMode": "Lyric mode",
    "aria.startTime": "Start time",
    "aria.endTime": "End time",
    "aria.lyricText": "Lyric text",
    "status.default": "Create a local lyric video project.",
    "status.languageUpdated": "Interface language updated.",
    "status.newProjectCreated": "New project created.",
    "status.projectLoaded": "Project loaded.",
    "status.projectSaved": "Project saved.",
    "status.uploadingAudio": "Uploading audio...",
    "status.audioUploaded": "Audio uploaded.",
    "status.uploadingImages": ({ count }) => `Uploading ${count} image${count === 1 ? "" : "s"}...`,
    "status.imagesUploaded": "Images uploaded.",
    "status.generatingImage": "Generating an image with OpenAI...",
    "status.imageGenerated": "AI image generated.",
    "status.removingImage": ({ name }) => `Removing ${name}...`,
    "status.imageRemoved": "Image removed.",
    "status.importingFile": ({ name }) => `Importing ${name}...`,
    "status.noTimedLinesFound": "No timed lyric lines were found in that LRC file.",
    "status.importedLines": ({ count, name }) => `Imported ${count} lyric line${count === 1 ? "" : "s"} from ${name}.`,
    "status.creatingDraft": "Creating draft timings...",
    "status.draftCreated": "Draft timings created.",
    "status.checkingLyrics": "Checking embedded lyrics, then transcription providers...",
    "status.lyricsExtracted": "Lyrics extracted.",
    "status.aligningLyrics": "Transcribing audio and aligning pasted lyrics...",
    "status.lyricsAligned": "Lyrics aligned.",
    "status.testingOpenAI": "Testing OpenAI connection...",
    "status.openAIWorks": ({ count }) => `OpenAI connection works${count ? ` (${count} models visible)` : ""}.`,
    "status.renderingDetail": "Rendering. FFmpeg can take a while for full-length songs.",
    "status.renderingMp4": "Rendering MP4...",
    "status.renderComplete": "Render complete.",
    "status.mp4Complete": "MP4 render complete.",
    "status.genericError": "Something went wrong.",
    "status.tools": ({ ffmpeg, ffprobe, openai, local, proxy, tls }) => `${ffmpeg}. ${ffprobe}. ${openai}; ${local}; ${proxy}; ${tls}.`,
    "note.draftSpread": "Draft timings were spread evenly across the audio.",
    "note.embeddedLyrics": "Embedded lyrics were found. Timings were spread evenly because embedded timing was not detected.",
    "note.transcribed": ({ provider, model }) => `Lyrics were transcribed with ${provider}${model ? ` (${model})` : ""}. Review timings before rendering.`,
    "note.aligned": ({ provider, model }) => `Pasted lyrics were aligned using ${provider}${model ? ` (${model})` : ""}. Review timings before rendering.`,
    "health.ffmpegAvailable": "FFmpeg available",
    "health.ffmpegMissing": "FFmpeg missing",
    "health.ffprobeAvailable": "FFprobe available",
    "health.ffprobeMissing": "FFprobe missing",
    "health.openAIConfigured": "OpenAI key on server",
    "health.openAIMissing": "OpenAI key not on server",
    "health.localConfigured": "local transcription configured",
    "health.localMissing": "local transcription not configured",
    "health.proxyConfigured": "proxy configured",
    "health.proxyMissing": "proxy not configured",
    "health.tlsDisabled": "TLS verification disabled",
    "health.tlsOn": "TLS verification on",
    "button.open": "Open",
    "button.new": "New",
    "button.saveProject": "Save Project",
    "button.checkTools": "Check Tools",
    "button.tryAutoExtract": "Try Auto Extract",
    "button.alignWithAudio": "Align With Audio",
    "button.testOpenAI": "Test OpenAI",
    "button.createDraftTimings": "Create Draft Timings",
    "button.addLine": "Add Line",
    "button.importLrcFile": "Import LRC File",
    "button.generateImage": "Generate Image",
    "button.generatingImage": "Generating...",
    "button.downloadSrt": "Download SRT",
    "button.downloadLrc": "Download LRC",
    "button.smartStyle": "Smart Style",
    "button.renderMp4": "Render MP4",
    "button.downloadMp4": "Download MP4",
    "label.projectName": "Project name",
    "label.audio": "Audio",
    "label.images": "Images",
    "label.lyricText": "Lyric text",
    "label.transcriptionProvider": "Transcription provider",
    "label.openAIModel": "OpenAI model",
    "label.openAIKey": "OpenAI API key",
    "label.aiImageSource": "AI image source",
    "label.aiImagePrompt": "Visual direction",
    "label.layout": "Layout",
    "label.imageFit": "Image fit",
    "label.textPosition": "Text position",
    "label.fontSize": "Font size",
    "label.textColor": "Text color",
    "label.outlineColor": "Outline color",
    "label.outlineWidth": "Outline width",
    "label.backgroundDim": "Background dim",
    "label.shadow": "Shadow",
    "label.karaoke": "Karaoke word highlight",
    "label.karaokeColor": "Karaoke highlight color",
    "label.textOverlays": "No-lyrics text overlays",
    "placeholder.projectName": "Untitled song video",
    "placeholder.rawLyrics": "Paste lyrics here, one line per lyric line.",
    "placeholder.aiImagePrompt": "Optional style, mood, setting, colors, or scene ideas",
    "placeholder.textOverlays": "Song title\nArtist\nDedication or other free text",
    "upload.audioChoice": "Choose MP3, WAV, or FFmpeg-readable audio",
    "upload.imageChoice": "Choose JPG, PNG, or WEBP backgrounds",
    "audio.none": "No audio uploaded yet.",
    "audio.durationUnknown": "duration unknown",
    "audio.probeNote": " FFprobe is not available, so metadata is limited.",
    "tab.lyrics": "Lyrics",
    "tab.style": "Style",
    "tab.render": "Render",
    "section.lyricsTitle": "Lyrics",
    "section.lyricsDescription": "Use embedded lyrics, draft timings from pasted lyrics, or continue with no lyrics.",
    "section.styleTitle": "Layout And Style",
    "section.styleDescription": "Pick the frame shape and readable burned-in lyric styling.",
    "section.renderTitle": "Render",
    "section.renderDescription": "Generate the MP4 with rotating images, audio, and burned-in lyrics.",
    "option.noSavedProjects": "No saved projects",
    "option.lyric.auto": "Auto extract/transcribe",
    "option.lyric.align": "Align pasted lyrics",
    "option.lyric.none": "No lyrics",
    "option.provider.auto": "Auto",
    "option.provider.openai": "OpenAI",
    "option.provider.local": "Local command",
    "option.aiSource.both": "Project title and lyrics",
    "option.aiSource.title": "Project title",
    "option.aiSource.lyrics": "Lyrics",
    "option.layout.landscape": "Landscape 16:9",
    "option.layout.portrait": "Portrait 9:16",
    "option.layout.square": "Square 1:1",
    "option.layout.auto": "Auto from images",
    "option.fit.cover": "Cover",
    "option.fit.contain": "Contain",
    "option.position.bottom": "Bottom",
    "option.position.center": "Center",
    "option.position.top": "Top",
    "table.start": "Start",
    "table.end": "End",
    "table.text": "Text",
    "table.noTimedLyrics": "No timed lyrics yet.",
    "table.removeLine": "Remove line",
    "preview.defaultLyric": "Your lyric preview appears here",
    "render.noRender": "No render yet.",
    "render.lastRender": ({ name }) => `Last render: ${name}`,
    "project.defaultName": "Untitled song video",
    "project.listLabel": ({ name, count }) => `${name} (${count} image${count === 1 ? "" : "s"})`,
    "image.removeButton": "X",
    "image.removeTitle": ({ name }) => `Remove ${name}`,
    "image.removeConfirm": ({ name }) => `Remove "${name}"?`
  },
  "zh-CN": {
    "aria.interfaceLanguage": "界面语言",
    "aria.savedProjects": "已保存项目",
    "aria.projectSetup": "项目设置",
    "aria.lyricsRendering": "歌词和渲染",
    "aria.imagePreviews": "已上传图片预览",
    "aria.workflowSections": "工作流程区域",
    "aria.lyricMode": "歌词模式",
    "aria.startTime": "开始时间",
    "aria.endTime": "结束时间",
    "aria.lyricText": "歌词文本",
    "status.default": "创建本地歌词视频项目。",
    "status.languageUpdated": "界面语言已更新。",
    "status.newProjectCreated": "已创建新项目。",
    "status.projectLoaded": "项目已加载。",
    "status.projectSaved": "项目已保存。",
    "status.uploadingAudio": "正在上传音频...",
    "status.audioUploaded": "音频已上传。",
    "status.uploadingImages": ({ count }) => `正在上传 ${count} 张图片...`,
    "status.imagesUploaded": "图片已上传。",
    "status.removingImage": ({ name }) => `正在移除 ${name}...`,
    "status.imageRemoved": "图片已移除。",
    "status.importingFile": ({ name }) => `正在导入 ${name}...`,
    "status.noTimedLinesFound": "没有在该 LRC 文件中找到带时间的歌词行。",
    "status.importedLines": ({ count, name }) => `已从 ${name} 导入 ${count} 行歌词。`,
    "status.creatingDraft": "正在创建草稿时间轴...",
    "status.draftCreated": "草稿时间轴已创建。",
    "status.checkingLyrics": "正在检查内嵌歌词，然后尝试转写提供方...",
    "status.lyricsExtracted": "歌词已提取。",
    "status.aligningLyrics": "正在转写音频并对齐粘贴的歌词...",
    "status.lyricsAligned": "歌词已对齐。",
    "status.testingOpenAI": "正在测试 OpenAI 连接...",
    "status.openAIWorks": ({ count }) => `OpenAI 连接正常${count ? `（可见 ${count} 个模型）` : ""}。`,
    "status.renderingDetail": "正在渲染。完整歌曲可能需要 FFmpeg 运行一段时间。",
    "status.renderingMp4": "正在渲染 MP4...",
    "status.renderComplete": "渲染完成。",
    "status.mp4Complete": "MP4 渲染完成。",
    "status.genericError": "出现错误。",
    "status.tools": ({ ffmpeg, ffprobe, openai, local, proxy, tls }) => `${ffmpeg}。${ffprobe}。${openai}；${local}；${proxy}；${tls}。`,
    "note.draftSpread": "草稿时间轴已按音频时长平均分布。",
    "note.embeddedLyrics": "已找到内嵌歌词。由于未检测到内嵌时间轴，时间已平均分布。",
    "note.transcribed": ({ provider, model }) => `歌词已使用 ${provider}${model ? `（${model}）` : ""} 转写。渲染前请检查时间轴。`,
    "note.aligned": ({ provider, model }) => `粘贴的歌词已使用 ${provider}${model ? `（${model}）` : ""} 对齐。渲染前请检查时间轴。`,
    "health.ffmpegAvailable": "FFmpeg 可用",
    "health.ffmpegMissing": "缺少 FFmpeg",
    "health.ffprobeAvailable": "FFprobe 可用",
    "health.ffprobeMissing": "缺少 FFprobe",
    "health.openAIConfigured": "服务器已配置 OpenAI 密钥",
    "health.openAIMissing": "服务器未配置 OpenAI 密钥",
    "health.localConfigured": "已配置本地转写命令",
    "health.localMissing": "未配置本地转写命令",
    "health.proxyConfigured": "已配置代理",
    "health.proxyMissing": "未配置代理",
    "health.tlsDisabled": "TLS 验证已关闭",
    "health.tlsOn": "TLS 验证已开启",
    "button.open": "打开",
    "button.new": "新建",
    "button.saveProject": "保存项目",
    "button.checkTools": "检查工具",
    "button.tryAutoExtract": "自动提取",
    "button.alignWithAudio": "按音频对齐",
    "button.testOpenAI": "测试 OpenAI",
    "button.createDraftTimings": "创建草稿时间轴",
    "button.addLine": "添加行",
    "button.importLrcFile": "导入 LRC 文件",
    "button.downloadSrt": "下载 SRT",
    "button.downloadLrc": "下载 LRC",
    "button.smartStyle": "智能样式",
    "button.renderMp4": "渲染 MP4",
    "button.downloadMp4": "下载 MP4",
    "label.projectName": "项目名称",
    "label.audio": "音频",
    "label.images": "图片",
    "label.lyricText": "歌词文本",
    "label.transcriptionProvider": "转写提供方",
    "label.openAIModel": "OpenAI 模型",
    "label.openAIKey": "OpenAI API 密钥",
    "label.layout": "画面比例",
    "label.imageFit": "图片适配",
    "label.textPosition": "文字位置",
    "label.fontSize": "字号",
    "label.textColor": "文字颜色",
    "label.outlineColor": "描边颜色",
    "label.outlineWidth": "描边宽度",
    "label.backgroundDim": "背景变暗",
    "label.shadow": "阴影",
    "label.karaoke": "卡拉 OK 逐词高亮",
    "label.karaokeColor": "卡拉 OK 高亮颜色",
    "label.textOverlays": "无歌词文字叠加",
    "placeholder.projectName": "未命名歌曲视频",
    "placeholder.rawLyrics": "在此粘贴歌词，每行一句。",
    "placeholder.textOverlays": "歌曲标题\n歌手\n献词或其他文字",
    "upload.audioChoice": "选择 MP3、WAV 或 FFmpeg 可读取的音频",
    "upload.imageChoice": "选择 JPG、PNG 或 WEBP 背景图",
    "audio.none": "尚未上传音频。",
    "audio.durationUnknown": "时长未知",
    "audio.probeNote": " FFprobe 不可用，因此元数据有限。",
    "tab.lyrics": "歌词",
    "tab.style": "样式",
    "tab.render": "渲染",
    "section.lyricsTitle": "歌词",
    "section.lyricsDescription": "使用内嵌歌词、从粘贴歌词生成草稿时间轴，或不使用歌词继续。",
    "section.styleTitle": "画面与样式",
    "section.styleDescription": "选择画面比例和清晰易读的烧录歌词样式。",
    "section.renderTitle": "渲染",
    "section.renderDescription": "生成包含轮播图片、音频和烧录歌词的 MP4。",
    "option.noSavedProjects": "没有已保存项目",
    "option.lyric.auto": "自动提取/转写",
    "option.lyric.align": "对齐粘贴歌词",
    "option.lyric.none": "无歌词",
    "option.provider.auto": "自动",
    "option.provider.openai": "OpenAI",
    "option.provider.local": "本地命令",
    "option.layout.landscape": "横屏 16:9",
    "option.layout.portrait": "竖屏 9:16",
    "option.layout.square": "方形 1:1",
    "option.layout.auto": "根据图片自动选择",
    "option.fit.cover": "裁切填满",
    "option.fit.contain": "完整包含",
    "option.position.bottom": "底部",
    "option.position.center": "居中",
    "option.position.top": "顶部",
    "table.start": "开始",
    "table.end": "结束",
    "table.text": "文本",
    "table.noTimedLyrics": "还没有带时间的歌词。",
    "table.removeLine": "移除歌词行",
    "preview.defaultLyric": "歌词预览会显示在这里",
    "render.noRender": "尚未渲染。",
    "render.lastRender": ({ name }) => `上次渲染：${name}`,
    "project.defaultName": "未命名歌曲视频",
    "project.listLabel": ({ name, count }) => `${name}（${count} 张图片）`,
    "image.removeButton": "X",
    "image.removeTitle": ({ name }) => `移除 ${name}`,
    "image.removeConfirm": ({ name }) => `移除“${name}”？`
  }
};

const els = {
  languageSwitch: document.querySelector(".language-switch"),
  languageLinks: document.querySelectorAll(".language-link"),
  statusText: document.querySelector("#statusText"),
  projectSelect: document.querySelector("#projectSelect"),
  loadProjectBtn: document.querySelector("#loadProjectBtn"),
  newProjectBtn: document.querySelector("#newProjectBtn"),
  projectName: document.querySelector("#projectName"),
  saveProjectBtn: document.querySelector("#saveProjectBtn"),
  healthBtn: document.querySelector("#healthBtn"),
  audioInput: document.querySelector("#audioInput"),
  imageInput: document.querySelector("#imageInput"),
  aiImageSource: document.querySelector("#aiImageSource"),
  aiImagePrompt: document.querySelector("#aiImagePrompt"),
  generateImageBtn: document.querySelector("#generateImageBtn"),
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
  transcriptionProvider: document.querySelector("#transcriptionProvider"),
  openAIModel: document.querySelector("#openAIModel"),
  openAIKey: document.querySelector("#openAIKey"),
  extractLyricsBtn: document.querySelector("#extractLyricsBtn"),
  alignLyricsBtn: document.querySelector("#alignLyricsBtn"),
  testOpenAIBtn: document.querySelector("#testOpenAIBtn"),
  draftLyricsBtn: document.querySelector("#draftLyricsBtn"),
  addLyricLineBtn: document.querySelector("#addLyricLineBtn"),
  importLrcBtn: document.querySelector("#importLrcBtn"),
  lrcInput: document.querySelector("#lrcInput"),
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
  karaokeMode: document.querySelector("#karaokeMode"),
  karaokeColor: document.querySelector("#karaokeColor"),
  smartStyleBtn: document.querySelector("#smartStyleBtn"),
  previewImage: document.querySelector("#previewImage"),
  previewDim: document.querySelector("#previewDim"),
  previewLyric: document.querySelector("#previewLyric"),
  textOverlays: document.querySelector("#textOverlays"),
  renderBtn: document.querySelector("#renderBtn"),
  renderStatus: document.querySelector("#renderStatus"),
  mp4Link: document.querySelector("#mp4Link")
};

function t(key, vars = {}) {
  const locale = I18N[state.language] ? state.language : "en";
  const value = I18N[locale][key] ?? I18N.en[key] ?? key;
  const template = typeof value === "function" ? value(vars) : value;
  return String(template).replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? "");
}

function setText(element, key, vars) {
  if (element) element.textContent = t(key, vars);
}

function setPlaceholder(element, key) {
  if (element) element.placeholder = t(key);
}

function setLabel(input, key) {
  setText(input?.closest("label")?.querySelector("span"), key);
}

function setSelectOption(select, value, key) {
  const option = select?.querySelector(`option[value="${value}"]`);
  if (option) option.textContent = t(key);
}

// Applies the selected UI language to static controls and current project summaries.
function applyTranslations() {
  document.documentElement.lang = state.language;
  els.languageSwitch.setAttribute("aria-label", t("aria.interfaceLanguage"));
  for (const link of els.languageLinks) {
    const isActive = link.dataset.language === state.language;
    link.classList.toggle("active", isActive);
    link.setAttribute("aria-current", isActive ? "true" : "false");
  }
  els.projectSelect.setAttribute("aria-label", t("aria.savedProjects"));
  document.querySelector(".sidebar")?.setAttribute("aria-label", t("aria.projectSetup"));
  document.querySelector(".main-panel")?.setAttribute("aria-label", t("aria.lyricsRendering"));
  els.imageStrip.setAttribute("aria-label", t("aria.imagePreviews"));
  document.querySelector(".tabs")?.setAttribute("aria-label", t("aria.workflowSections"));
  els.lyricMode.setAttribute("aria-label", t("aria.lyricMode"));

  setText(els.statusText, "status.default");
  setText(els.loadProjectBtn, "button.open");
  setText(els.newProjectBtn, "button.new");
  setText(els.saveProjectBtn, "button.saveProject");
  setText(els.healthBtn, "button.checkTools");
  setText(els.extractLyricsBtn, "button.tryAutoExtract");
  setText(els.alignLyricsBtn, "button.alignWithAudio");
  setText(els.testOpenAIBtn, "button.testOpenAI");
  setText(els.draftLyricsBtn, "button.createDraftTimings");
  setText(els.addLyricLineBtn, "button.addLine");
  setText(els.importLrcBtn, "button.importLrcFile");
  setText(els.generateImageBtn, "button.generateImage");
  setText(els.srtLink, "button.downloadSrt");
  setText(els.lrcLink, "button.downloadLrc");
  setText(els.smartStyleBtn, "button.smartStyle");
  setText(els.renderBtn, "button.renderMp4");
  setText(els.mp4Link, "button.downloadMp4");

  setLabel(els.projectName, "label.projectName");
  setLabel(els.lyricMode, "label.lyricText");
  setLabel(els.rawLyrics, "label.lyricText");
  setLabel(els.transcriptionProvider, "label.transcriptionProvider");
  setLabel(els.openAIModel, "label.openAIModel");
  setLabel(els.openAIKey, "label.openAIKey");
  setLabel(els.aiImageSource, "label.aiImageSource");
  setLabel(els.aiImagePrompt, "label.aiImagePrompt");
  setLabel(els.layoutMode, "label.layout");
  setLabel(els.imageFit, "label.imageFit");
  setLabel(els.textPosition, "label.textPosition");
  setLabel(els.fontSize, "label.fontSize");
  setLabel(els.textColor, "label.textColor");
  setLabel(els.outlineColor, "label.outlineColor");
  setLabel(els.outlineWidth, "label.outlineWidth");
  setLabel(els.backgroundDim, "label.backgroundDim");
  setLabel(els.karaokeColor, "label.karaokeColor");
  setLabel(els.textOverlays, "label.textOverlays");
  setText(document.querySelector(".upload-group:nth-of-type(1) .upload-box span"), "label.audio");
  setText(document.querySelector(".upload-group:nth-of-type(2) .upload-box span"), "label.images");
  setText(document.querySelector(".upload-group:nth-of-type(1) .upload-box strong"), "upload.audioChoice");
  setText(document.querySelector(".upload-group:nth-of-type(2) .upload-box strong"), "upload.imageChoice");
  setText(document.querySelector('label[for="textShadow"] span'), "label.shadow");
  setText(els.textShadow?.closest("label")?.querySelector("span"), "label.shadow");
  setText(els.karaokeMode?.closest("label")?.querySelector("span"), "label.karaoke");

  setPlaceholder(els.projectName, "placeholder.projectName");
  setPlaceholder(els.rawLyrics, "placeholder.rawLyrics");
  setPlaceholder(els.aiImagePrompt, "placeholder.aiImagePrompt");
  setPlaceholder(els.textOverlays, "placeholder.textOverlays");

  setText(document.querySelector('.tab[data-tab="lyrics"]'), "tab.lyrics");
  setText(document.querySelector('.tab[data-tab="style"]'), "tab.style");
  setText(document.querySelector('.tab[data-tab="render"]'), "tab.render");
  setText(document.querySelector("#lyricsTab .section-heading h2"), "section.lyricsTitle");
  setText(document.querySelector("#lyricsTab .section-heading p"), "section.lyricsDescription");
  setText(document.querySelector("#styleTab .section-heading h2"), "section.styleTitle");
  setText(document.querySelector("#styleTab .section-heading p"), "section.styleDescription");
  setText(document.querySelector("#renderTab .section-heading h2"), "section.renderTitle");
  setText(document.querySelector("#renderTab .section-heading p"), "section.renderDescription");

  setSelectOption(els.lyricMode, "auto", "option.lyric.auto");
  setSelectOption(els.lyricMode, "align", "option.lyric.align");
  setSelectOption(els.lyricMode, "none", "option.lyric.none");
  setSelectOption(els.transcriptionProvider, "auto", "option.provider.auto");
  setSelectOption(els.transcriptionProvider, "openai", "option.provider.openai");
  setSelectOption(els.transcriptionProvider, "local", "option.provider.local");
  setSelectOption(els.aiImageSource, "both", "option.aiSource.both");
  setSelectOption(els.aiImageSource, "title", "option.aiSource.title");
  setSelectOption(els.aiImageSource, "lyrics", "option.aiSource.lyrics");
  setSelectOption(els.layoutMode, "landscape", "option.layout.landscape");
  setSelectOption(els.layoutMode, "portrait", "option.layout.portrait");
  setSelectOption(els.layoutMode, "square", "option.layout.square");
  setSelectOption(els.layoutMode, "auto", "option.layout.auto");
  setSelectOption(els.imageFit, "cover", "option.fit.cover");
  setSelectOption(els.imageFit, "contain", "option.fit.contain");
  setSelectOption(els.textPosition, "bottom", "option.position.bottom");
  setSelectOption(els.textPosition, "center", "option.position.center");
  setSelectOption(els.textPosition, "top", "option.position.top");

  const headers = document.querySelectorAll(".lyrics-table th");
  setText(headers[0], "table.start");
  setText(headers[1], "table.end");
  setText(headers[2], "table.text");

  renderMediaSummary();
  renderLyricsTable();
  updatePreview();
  updateRenderLink();
  renderProjectOptions();
}

function setLanguage(language) {
  state.language = I18N[language] ? language : "en";
  localStorage.setItem("ifunsong.uiLanguage", state.language);
  applyTranslations();
  setStatus(t("status.languageUpdated"));
}

function localizeServerNote(note) {
  if (!note) return "";
  if (note === I18N.en["note.draftSpread"]) return t("note.draftSpread");
  if (note === I18N.en["note.embeddedLyrics"]) return t("note.embeddedLyrics");

  const transcribed = String(note).match(/^Lyrics were transcribed with ([^(]+?)(?: \(([^)]+)\))?\. Review timings before rendering\.$/);
  if (transcribed) return t("note.transcribed", { provider: transcribed[1], model: transcribed[2] || "" });

  const aligned = String(note).match(/^Pasted lyrics were aligned using ([^(]+?)(?: \(([^)]+)\))?\. Review timings before rendering\.$/);
  if (aligned) return t("note.aligned", { provider: aligned[1], model: aligned[2] || "" });

  return note;
}

// Shows a status message in the app header.
function setStatus(message, isError = false) {
  els.statusText.textContent = message;
  els.statusText.style.color = isError ? "#b42318" : "";
}

// Sends a JSON API request and normalizes errors.
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

// Returns the active project ID when one is loaded.
function currentProjectId() {
  return state.project?.id;
}

// Loads saved projects into the project selector.
async function loadProjectList() {
  const payload = await api("/api/projects");
  state.projects = payload.projects || [];
  renderProjectOptions();
}

// Renders saved projects using the active UI language.
function renderProjectOptions() {
  els.projectSelect.innerHTML = "";
  if (state.projects.length === 0) {
    els.projectSelect.append(new Option(t("option.noSavedProjects"), ""));
    return;
  }
  for (const project of state.projects) {
    const label = t("project.listLabel", { name: project.name, count: project.imageCount });
    els.projectSelect.append(new Option(label, project.id));
  }
  if (state.project) els.projectSelect.value = state.project.id;
}

// Creates a new project on the server.
async function createProject() {
  const name = els.projectName.value.trim() || t("project.defaultName");
  const payload = await api("/api/projects", {
    method: "POST",
    body: JSON.stringify({ name })
  });
  setProject(payload.project);
  await loadProjectList();
  setStatus(t("status.newProjectCreated"));
}

// Opens the project currently selected in the dropdown.
async function openSelectedProject() {
  const id = els.projectSelect.value;
  if (!id) return;
  const payload = await api(`/api/projects/${encodeURIComponent(id)}`);
  setProject(payload.project);
  setStatus(t("status.projectLoaded"));
}

// Saves the current project state to the server.
async function saveProject() {
  if (!state.project) return createProject();
  pullFormIntoProject();
  const payload = await api(`/api/projects/${encodeURIComponent(state.project.id)}`, {
    method: "PUT",
    body: JSON.stringify({ project: state.project })
  });
  setProject(payload.project);
  await loadProjectList();
  setStatus(t("status.projectSaved"));
}

// Applies a project model to local state and the UI.
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

// Copies current form values into the project model.
function pullFormIntoProject() {
  if (!state.project) return;
  state.project.name = els.projectName.value.trim() || t("project.defaultName");
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

// Reads and persists transcription settings from the form.
function transcriptionOptions() {
  const apiKey = els.openAIKey.value.trim();
  if (apiKey) {
    localStorage.setItem("ifunsong.openaiKey", apiKey);
  } else {
    localStorage.removeItem("ifunsong.openaiKey");
  }
  localStorage.setItem("ifunsong.openaiModel", els.openAIModel.value.trim() || "whisper-1");
  localStorage.setItem("ifunsong.transcriptionProvider", els.transcriptionProvider.value || "auto");
  return {
    provider: els.transcriptionProvider.value || "auto",
    model: els.openAIModel.value.trim() || "whisper-1",
    apiKey
  };
}

// Reads and persists image generation settings from the form.
function imageGenerationOptions() {
  const apiKey = els.openAIKey.value.trim();
  if (apiKey) {
    localStorage.setItem("ifunsong.openaiKey", apiKey);
  } else {
    localStorage.removeItem("ifunsong.openaiKey");
  }
  localStorage.setItem("ifunsong.aiImageSource", els.aiImageSource.value || "both");
  return {
    apiKey,
    source: els.aiImageSource.value || "both",
    prompt: els.aiImagePrompt.value.trim(),
    title: els.projectName.value.trim(),
    rawLyrics: els.rawLyrics.value,
    layout: layoutFromForm()
  };
}

// Restores saved transcription preferences from local storage.
function loadTranscriptionPrefs() {
  els.openAIKey.value = localStorage.getItem("ifunsong.openaiKey") || "";
  els.openAIModel.value = localStorage.getItem("ifunsong.openaiModel") || "whisper-1";
  els.transcriptionProvider.value = localStorage.getItem("ifunsong.transcriptionProvider") || "auto";
  els.aiImageSource.value = localStorage.getItem("ifunsong.aiImageSource") || "both";
}

// Populates layout and style controls from a project.
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
  els.karaokeMode.checked = style.karaoke === true;
  els.karaokeColor.value = style.karaokeColor || "#ffd54a";
}

// Builds a render layout object from form controls.
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

// Suggests a layout based on uploaded image aspect ratios.
function suggestAutoLayout() {
  const images = state.project?.images || [];
  const ratios = images.filter((image) => image.width && image.height).map((image) => image.width / image.height);
  if (!ratios.length) return { width: 1920, height: 1080 };
  const average = ratios.reduce((sum, value) => sum + value, 0) / ratios.length;
  if (average < 0.85) return { width: 1080, height: 1920 };
  if (average > 1.2) return { width: 1920, height: 1080 };
  return { width: 1080, height: 1080 };
}

// Builds a subtitle style object from form controls.
function styleFromForm() {
  return {
    fontFamily: "Arial",
    fontSize: Number(els.fontSize.value) || 54,
    color: els.textColor.value,
    outlineColor: els.outlineColor.value,
    outlineWidth: Number(els.outlineWidth.value) || 0,
    shadow: els.textShadow.checked,
    position: els.textPosition.value,
    backgroundDim: Number(els.backgroundDim.value) || 0,
    karaoke: els.karaokeMode.checked,
    karaokeColor: els.karaokeColor.value
  };
}

// Renders audio and image upload summaries.
function renderMediaSummary() {
  const project = state.project;
  if (!project) return;

  if (project.audio) {
    els.audioLabel.textContent = project.audio.originalName;
    els.audioPreview.src = project.audio.url;
    const duration = project.audio.durationMs ? formatMs(project.audio.durationMs) : t("audio.durationUnknown");
    const probeNote = project.audio.metadataProbeAvailable ? "" : t("audio.probeNote");
    els.audioMeta.textContent = `${duration}. ${formatBytes(project.audio.size)}.${probeNote}`;
  } else {
    els.audioLabel.textContent = t("upload.audioChoice");
    els.audioPreview.removeAttribute("src");
    els.audioMeta.textContent = t("audio.none");
  }

  els.imageStrip.innerHTML = "";
  for (const image of project.images || []) {
    const figure = document.createElement("figure");
    figure.className = "image-thumb";

    const img = document.createElement("img");
    img.src = image.url;
    img.alt = image.originalName;
    img.title = `${image.originalName}${image.width ? ` (${image.width}x${image.height})` : ""}`;
    figure.append(img);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "image-remove";
    removeBtn.textContent = "×";
    removeBtn.title = t("image.removeTitle", { name: image.originalName });
    removeBtn.setAttribute("aria-label", t("image.removeTitle", { name: image.originalName }));
    removeBtn.addEventListener("click", () => removeImage(image).catch(showError));
    figure.append(removeBtn);

    els.imageStrip.append(figure);
  }
}

// Renders the editable timed lyrics table.
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
    cell.textContent = t("table.noTimedLyrics");
    row.append(cell);
    els.lyricsTableBody.append(row);
  }
}

// Adds one editable lyric row to the table.
function addLyricRow(line = {}) {
  const empty = els.lyricsTableBody.querySelector("td[colspan]");
  if (empty) els.lyricsTableBody.innerHTML = "";

  const row = document.createElement("tr");
  row.dataset.id = line.id || crypto.randomUUID();

  const startCell = document.createElement("td");
  const startInput = document.createElement("input");
  startInput.type = "text";
  startInput.value = msToInput(line.startMs || 0);
  startInput.ariaLabel = t("aria.startTime");
  startCell.append(startInput);

  const endCell = document.createElement("td");
  const endInput = document.createElement("input");
  endInput.type = "text";
  endInput.value = msToInput(line.endMs || (line.startMs || 0) + 3000);
  endInput.ariaLabel = t("aria.endTime");
  endCell.append(endInput);

  const textCell = document.createElement("td");
  const textInput = document.createElement("textarea");
  textInput.rows = 1;
  textInput.value = line.text || "";
  textInput.ariaLabel = t("aria.lyricText");
  textCell.append(textInput);

  const actionCell = document.createElement("td");
  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "line-remove";
  removeBtn.textContent = "X";
  removeBtn.title = t("table.removeLine");
  removeBtn.setAttribute("aria-label", t("table.removeLine"));
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

// Reads timed lyric rows from the table.
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

// Uploads the selected audio file to the active project.
async function uploadAudio() {
  if (!state.project) await createProject();
  const file = els.audioInput.files?.[0];
  if (!file) return;
  setStatus(t("status.uploadingAudio"));
  const payload = await api(`/api/projects/${encodeURIComponent(currentProjectId())}/audio`, {
    method: "POST",
    body: JSON.stringify({ file: await fileToPayload(file) })
  });
  setProject(payload.project);
  await loadProjectList();
  setStatus(t("status.audioUploaded"));
}

// Uploads selected image files to the active project.
async function uploadImages() {
  if (!state.project) await createProject();
  const files = [...(els.imageInput.files || [])];
  if (!files.length) return;
  setStatus(t("status.uploadingImages", { count: files.length }));
  const payload = await api(`/api/projects/${encodeURIComponent(currentProjectId())}/images`, {
    method: "POST",
    body: JSON.stringify({ files: await Promise.all(files.map(fileToPayload)) })
  });
  setProject(payload.project);
  await loadProjectList();
  setStatus(t("status.imagesUploaded"));
}

// Generates an OpenAI image from the project title and/or lyrics.
async function generateImage() {
  if (els.generateImageBtn.disabled) return;
  els.generateImageBtn.disabled = true;
  els.generateImageBtn.textContent = t("button.generatingImage");
  setStatus(t("status.generatingImage"));
  try {
    if (!state.project) await createProject();
    pullFormIntoProject();
    const payload = await api(`/api/projects/${encodeURIComponent(currentProjectId())}/images/generate`, {
      method: "POST",
      body: JSON.stringify(imageGenerationOptions())
    });
    setProject(payload.project);
    await loadProjectList();
    setStatus(payload.note || t("status.imageGenerated"));
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    els.generateImageBtn.disabled = false;
    els.generateImageBtn.textContent = t("button.generateImage");
  }
}

// Removes an image asset from the active project.
async function removeImage(image) {
  if (!state.project || !image?.id) return;
  if (!confirm(t("image.removeConfirm", { name: image.originalName }))) return;
  setStatus(t("status.removingImage", { name: image.originalName }));
  const payload = await api(
    `/api/projects/${encodeURIComponent(currentProjectId())}/images/${encodeURIComponent(image.id)}`,
    { method: "DELETE" }
  );
  setProject(payload.project);
  await loadProjectList();
  setStatus(t("status.imageRemoved"));
}

// Converts a browser File into a base64 API payload.
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

// Parses LRC lyric text into timed lyric entries.
function parseLrc(text) {
  const timeTag = /\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
  const entries = [];
  let offsetMs = 0;
  for (const raw of String(text || "").split(/\r?\n/)) {
    const offsetMatch = raw.match(/^\s*\[offset:\s*([+-]?\d+)\s*\]/i);
    if (offsetMatch) {
      offsetMs = Number(offsetMatch[1]) || 0;
      continue;
    }
    const times = [];
    let match;
    timeTag.lastIndex = 0;
    while ((match = timeTag.exec(raw))) {
      const minutes = Number(match[1]);
      const seconds = Number(match[2]);
      const fraction = match[3] ? Number(String(match[3]).padEnd(3, "0").slice(0, 3)) : 0;
      times.push(minutes * 60000 + seconds * 1000 + fraction);
    }
    if (!times.length) continue;
    const content = raw.replace(timeTag, "").trim();
    if (!content) continue;
    for (const start of times) {
      entries.push({ startMs: Math.max(0, start + offsetMs), text: content });
    }
  }
  entries.sort((a, b) => a.startMs - b.startMs);
  return entries.map((entry, index) => {
    const next = entries[index + 1];
    const endMs = next ? Math.max(entry.startMs + 500, next.startMs) : entry.startMs + 4000;
    return { startMs: entry.startMs, endMs, text: entry.text };
  });
}

// Imports timed lyrics from a selected LRC file.
async function importLrcFile() {
  const file = els.lrcInput.files?.[0];
  els.lrcInput.value = "";
  if (!file) return;
  if (!state.project) await createProject();
  setStatus(t("status.importingFile", { name: file.name }));
  const parsed = parseLrc(await file.text());
  if (!parsed.length) {
    setStatus(t("status.noTimedLinesFound"), true);
    return;
  }
  state.project.timedLyrics = parsed.map((line, index) => ({
    id: crypto.randomUUID(),
    index,
    startMs: line.startMs,
    endMs: line.endMs,
    text: line.text
  }));
  els.lyricMode.value = "align";
  els.rawLyrics.value = parsed.map((line) => line.text).join("\n");
  renderLyricsTable();
  await saveProject();
  setStatus(t("status.importedLines", { count: parsed.length, name: file.name }));
}

// Creates evenly spaced draft timings from pasted lyrics.
async function draftLyrics() {
  if (!state.project) await createProject();
  setStatus(t("status.creatingDraft"));
  const payload = await api(`/api/projects/${encodeURIComponent(currentProjectId())}/lyrics/draft`, {
    method: "POST",
    body: JSON.stringify({ rawLyrics: els.rawLyrics.value })
  });
  setProject(payload.project);
  setStatus(localizeServerNote(payload.note) || t("status.draftCreated"));
}

// Extracts or transcribes lyrics for the active project.
async function extractLyrics() {
  if (!state.project) await createProject();
  setStatus(t("status.checkingLyrics"));
  try {
    const payload = await api(`/api/projects/${encodeURIComponent(currentProjectId())}/lyrics/extract`, {
      method: "POST",
      body: JSON.stringify(transcriptionOptions())
    });
    setProject(payload.project);
    setStatus(localizeServerNote(payload.note) || t("status.lyricsExtracted"));
  } catch (error) {
    setStatus(error.message, true);
  }
}

// Aligns pasted lyrics to transcribed audio timings.
async function alignLyrics() {
  if (!state.project) await createProject();
  setStatus(t("status.aligningLyrics"));
  try {
    const payload = await api(`/api/projects/${encodeURIComponent(currentProjectId())}/lyrics/align`, {
      method: "POST",
      body: JSON.stringify({
        rawLyrics: els.rawLyrics.value,
        ...transcriptionOptions()
      })
    });
    setProject(payload.project);
    setStatus(localizeServerNote(payload.note) || t("status.lyricsAligned"));
  } catch (error) {
    setStatus(error.message, true);
  }
}

// Tests the configured OpenAI connection.
async function testOpenAI() {
  setStatus(t("status.testingOpenAI"));
  try {
    const payload = await api("/api/openai/check", {
      method: "POST",
      body: JSON.stringify(transcriptionOptions())
    });
    setStatus(t("status.openAIWorks", { count: payload.modelCount || 0 }));
  } catch (error) {
    setStatus(error.message, true);
  }
}

// Saves only the edited lyric timing rows.
async function saveLyricsOnly() {
  if (!state.project) return;
  pullFormIntoProject();
  const payload = await api(`/api/projects/${encodeURIComponent(currentProjectId())}/lyrics`, {
    method: "PUT",
    body: JSON.stringify({ timedLyrics: state.project.timedLyrics })
  });
  setProject(payload.project);
}

// Requests MP4 rendering for the active project.
async function renderVideo() {
  if (!state.project) await createProject();
  pullFormIntoProject();
  await saveProject();
  els.renderBtn.disabled = true;
  els.renderStatus.textContent = t("status.renderingDetail");
  setStatus(t("status.renderingMp4"));
  setDownloadDisabled(true);
  try {
    const payload = await api(`/api/projects/${encodeURIComponent(currentProjectId())}/render`, {
      method: "POST",
      body: JSON.stringify({})
    });
    setProject(payload.project);
    els.renderStatus.textContent = t("status.renderComplete");
    setStatus(t("status.mp4Complete"));
  } catch (error) {
    els.renderStatus.textContent = error.message;
    setStatus(error.message, true);
  } finally {
    els.renderBtn.disabled = false;
    setDownloadDisabled(false);
  }
}

// Toggles the rendered MP4 download link state.
function setDownloadDisabled(disabled) {
  els.mp4Link.classList.toggle("disabled", disabled);
  els.mp4Link.setAttribute("aria-disabled", disabled ? "true" : "false");
}

// Updates SRT and LRC download links for the active project.
function updateDownloadLinks() {
  if (!state.project) return;
  const id = encodeURIComponent(state.project.id);
  els.srtLink.href = `/api/projects/${id}/lyrics.srt`;
  els.lrcLink.href = `/api/projects/${id}/lyrics.lrc`;
}

// Updates the rendered MP4 download link and status text.
function updateRenderLink() {
  if (!state.project?.lastRender) {
    els.mp4Link.classList.add("hidden");
    els.mp4Link.href = "#";
    els.renderStatus.textContent = t("render.noRender");
    return;
  }
  els.mp4Link.classList.remove("hidden");
  els.mp4Link.href = `/api/projects/${encodeURIComponent(state.project.id)}/render/output`;
  els.renderStatus.textContent = t("render.lastRender", { name: state.project.lastRender.outputName });
}

// Refreshes the visual preview from current form state.
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
  els.previewLyric.style.color = style.karaoke ? style.karaokeColor : style.color;
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
  els.previewLyric.textContent = firstLine || overlayText || t("preview.defaultLyric");
}

// Checks server-side media tools and transcription configuration.
async function checkTools() {
  const payload = await api("/api/health");
  const ffmpeg = payload.ffmpeg.available ? t("health.ffmpegAvailable") : t("health.ffmpegMissing");
  const ffprobe = payload.ffprobe.available ? t("health.ffprobeAvailable") : t("health.ffprobeMissing");
  const openai = payload.transcription?.openaiConfigured ? t("health.openAIConfigured") : t("health.openAIMissing");
  const local = payload.transcription?.localCommandConfigured ? t("health.localConfigured") : t("health.localMissing");
  const proxy = payload.transcription?.network?.proxyConfigured ? t("health.proxyConfigured") : t("health.proxyMissing");
  const tls = payload.transcription?.network?.tlsRejectUnauthorized === false ? t("health.tlsDisabled") : t("health.tlsOn");
  setStatus(t("status.tools", { ffmpeg, ffprobe, openai, local, proxy, tls }), !payload.ffmpeg.available || !payload.ffprobe.available);
}

// Applies the default readable lyric styling preset.
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

// Formats milliseconds for editable time inputs.
function msToInput(ms) {
  const value = Math.max(0, Math.round(Number(ms) || 0));
  const minutes = Math.floor(value / 60000);
  const seconds = Math.floor((value % 60000) / 1000);
  const millis = value % 1000;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

// Parses a time input value into milliseconds.
function inputToMs(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(?:(\d+):)?(\d{1,2})(?:[.,](\d{1,3}))?$/);
  if (!match) return Math.max(0, Math.round(Number(text) || 0));
  const minutes = Number(match[1] || 0);
  const seconds = Number(match[2] || 0);
  const millis = Number(String(match[3] || "0").padEnd(3, "0"));
  return minutes * 60000 + seconds * 1000 + millis;
}

// Formats milliseconds as a short duration string.
function formatMs(ms) {
  const total = Math.max(0, Math.round(Number(ms) || 0));
  const minutes = Math.floor(total / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

// Formats byte counts for display.
function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

// Switches the visible settings tab.
function switchTab(name) {
  for (const tab of els.tabs) {
    tab.classList.toggle("active", tab.dataset.tab === name);
  }
  for (const [key, panel] of Object.entries(els.tabPanels)) {
    panel.classList.toggle("active", key === name);
  }
  updatePreview();
}

// Wires UI controls to their event handlers.
function bindEvents() {
  for (const link of els.languageLinks) {
    link.addEventListener("click", () => setLanguage(link.dataset.language));
  }
  els.newProjectBtn.addEventListener("click", () => createProject().catch(showError));
  els.loadProjectBtn.addEventListener("click", () => openSelectedProject().catch(showError));
  els.saveProjectBtn.addEventListener("click", () => saveProject().catch(showError));
  els.healthBtn.addEventListener("click", () => checkTools().catch(showError));
  els.audioInput.addEventListener("change", () => uploadAudio().catch(showError));
  els.imageInput.addEventListener("change", () => uploadImages().catch(showError));
  els.generateImageBtn.addEventListener("click", () => generateImage().catch(showError));
  els.extractLyricsBtn.addEventListener("click", () => extractLyrics().catch(showError));
  els.alignLyricsBtn.addEventListener("click", () => alignLyrics().catch(showError));
  els.testOpenAIBtn.addEventListener("click", () => testOpenAI().catch(showError));
  els.draftLyricsBtn.addEventListener("click", () => draftLyrics().catch(showError));
  els.addLyricLineBtn.addEventListener("click", () => {
    const lines = readLyricsTable();
    const lastEnd = lines.at(-1)?.endMs || 0;
    addLyricRow({ startMs: lastEnd, endMs: lastEnd + 3000, text: "" });
    pullFormIntoProject();
  });
  els.importLrcBtn.addEventListener("click", () => els.lrcInput.click());
  els.lrcInput.addEventListener("change", () => importLrcFile().catch(showError));
  els.renderBtn.addEventListener("click", () => renderVideo().catch(showError));
  els.mp4Link.addEventListener("click", (event) => {
    if (els.mp4Link.classList.contains("disabled")) event.preventDefault();
  });
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
    els.karaokeMode,
    els.karaokeColor,
    els.textOverlays
  ]) {
    input.addEventListener("input", () => {
      pullFormIntoProject();
      updatePreview();
    });
  }
  for (const input of [els.transcriptionProvider, els.openAIModel, els.openAIKey]) {
    input.addEventListener("change", transcriptionOptions);
  }
  els.aiImageSource.addEventListener("change", imageGenerationOptions);
  window.addEventListener("beforeunload", () => {
    pullFormIntoProject();
  });
}

// Logs an error and shows it in the status area.
function showError(error) {
  console.error(error);
  setStatus(error.message || t("status.genericError"), true);
}

// Initializes event bindings, preferences, projects, and health status.
async function init() {
  bindEvents();
  loadTranscriptionPrefs();
  applyTranslations();
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
