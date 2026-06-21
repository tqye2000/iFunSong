# iFunSong Implementation Plan

## Proposed Stack

### Frontend

- React + TypeScript + Vite
- Local browser UI
- Audio preview with timeline controls
- Timed lyric table/editor
- Layout and style controls
- Project save/load controls

### Backend

- Node.js + TypeScript
- Local HTTP API
- File upload and project asset management
- FFprobe metadata inspection
- FFmpeg rendering
- AI transcription/alignment provider integration

### Rendering

- FFmpeg for final MP4 generation
- FFprobe for audio duration, image metadata, stream metadata, and embedded lyric metadata checks
- SRT generation for subtitle burn-in
- LRC generation for lyric export

### AI Providers

Use a provider interface so the app can support multiple transcription/alignment options:

- Embedded metadata provider
- OpenAI provider
- Local whisper provider
- Manual/no-lyrics provider

## Repository Structure

Suggested structure:

```text
iFunSong/
  docs/
    requirements.md
    implementation-plan.md
  apps/
    web/
      src/
      public/
      package.json
  services/
    local-server/
      src/
        api/
        projects/
        media/
        lyrics/
        render/
        providers/
      package.json
  packages/
    core/
      src/
        types/
        lyrics/
        project/
        render-settings/
  projects/
    .gitkeep
```

For a smaller first pass, this can also start as one package with `client`, `server`, and `shared` folders. The monorepo-style layout is more mobile-friendly later, because shared project and lyric logic can move into `packages/core`.

## Core Data Models

### Project

```ts
type Project = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  audio: ProjectAudio | null;
  images: ProjectImage[];
  lyricMode: "auto" | "align" | "none";
  rawLyrics?: string;
  timedLyrics: TimedLyricLine[];
  textOverlays: TextOverlay[];
  layout: LayoutSettings;
  style: LyricStyle;
  render: RenderSettings;
};
```

### Timed Lyrics

```ts
type TimedLyricLine = {
  id: string;
  index: number;
  startMs: number;
  endMs: number;
  text: string;
};
```

### Layout

```ts
type LayoutSettings = {
  mode: "landscape" | "portrait" | "square" | "auto";
  width: number;
  height: number;
  imageFit: "cover" | "contain";
};
```

### Lyric Style

```ts
type LyricStyle = {
  fontFamily: string;
  fontSize: number;
  color: string;
  outlineColor: string;
  outlineWidth: number;
  shadow: boolean;
  position: "top" | "center" | "bottom";
  backgroundDim: number;
};
```

## Backend API Draft

### Project APIs

- `POST /api/projects`
  - Create a new local project.
- `GET /api/projects`
  - List saved local projects.
- `GET /api/projects/:projectId`
  - Load project JSON.
- `PUT /api/projects/:projectId`
  - Save project settings and timed lyrics.
- `DELETE /api/projects/:projectId`
  - Delete a project after confirmation.

### Asset APIs

- `POST /api/projects/:projectId/audio`
  - Upload audio into the project asset folder.
  - Run FFprobe.
  - Return duration and metadata.
- `POST /api/projects/:projectId/images`
  - Upload one or more images into the project asset folder.
  - Return image dimensions and detected aspect ratios.

### Lyric APIs

- `POST /api/projects/:projectId/lyrics/extract`
  - Try embedded lyrics first.
  - If needed, run OpenAI or local transcription.
  - Save timed lyrics to the project.
- `POST /api/projects/:projectId/lyrics/align`
  - Align supplied lyrics to song.
  - Save timed lyrics to the project.
- `PUT /api/projects/:projectId/lyrics`
  - Save user-edited timed lyrics.
- `GET /api/projects/:projectId/lyrics.srt`
  - Export SRT.
- `GET /api/projects/:projectId/lyrics.lrc`
  - Export LRC.

### Render APIs

- `POST /api/projects/:projectId/render`
  - Generate final MP4.
  - Burn in lyrics or free text overlays.
  - Return render job id.
- `GET /api/render-jobs/:jobId`
  - Return render progress/status.
- `GET /api/render-jobs/:jobId/output`
  - Download final MP4.

## Rendering Plan

### Image Rotation

For v1:

- Get audio duration with FFprobe.
- Divide duration equally by image count.
- Build an FFmpeg filter graph that:
  - scales/crops each image to the selected layout,
  - applies optional background dim/blur,
  - concatenates image segments,
  - combines them with audio,
  - burns subtitles or drawtext overlays.

### Lyrics Burn-In

Preferred v1 path:

1. Convert `TimedLyricLine[]` to an SRT file.
2. Generate an ASS subtitle file from SRT plus style settings if richer styling is needed.
3. Use FFmpeg subtitles/ass filter to burn lyrics into the video.

ASS subtitles are likely better than plain SRT for v1 styling because they support font size, outline, shadow, color, margins, and alignment.

### No-Lyrics Text

For free text overlays:

- Use FFmpeg `drawtext` for simple static title/artist/dedication overlays.
- Later, represent these as timed overlay entries if intro/outro timing is needed.

## Lyric Processing Plan

### Embedded Metadata

Use FFprobe to inspect format tags and streams for common lyric fields. This can handle files where lyrics are already embedded.

### OpenAI Provider

Use OpenAI when an API key is configured locally.

Responsibilities:

- Transcribe audio into timestamped segments when no lyrics are supplied.
- Align supplied lyrics using transcription timestamps as the timing guide.

The API key should be stored locally and never embedded in the frontend bundle.

### Local Provider

Start with an optional provider wrapper that can call an installed local command, such as `whisper.cpp` or `faster-whisper`, if detected/configured.

V1 can expose this as:

- "Use local transcription if available"
- Provider configuration path
- Clear failure messages if the tool/model is missing

## Frontend Screens

### Project Screen

- New project
- Open saved project
- Project name
- Save status

### Import Screen

- Audio upload
- Image upload
- Basic media summary
- Detected duration and image count

### Lyrics Screen

- Mode selector:
  - Auto-transcribe
  - Align provided lyrics
  - No lyrics
- Raw lyric text area
- Generate/align button
- Timed lyric editor
- SRT/LRC export buttons

### Style Screen

- Layout selector
- Auto layout suggestion
- Font size
- Text color
- Outline color/width
- Shadow toggle
- Position selector
- Background dim slider

### Render Screen

- Render button
- Render progress
- Output preview/download
- Export project, SRT, and LRC

## Implementation Phases

### Phase 1: Project Skeleton

- Create frontend and backend apps.
- Add shared TypeScript types.
- Add local project folder conventions.
- Add basic project create/save/load APIs.

### Phase 2: Media Upload And Metadata

- Upload/copy audio into project assets.
- Upload/copy images into project assets.
- Run FFprobe for audio duration.
- Detect image dimensions.
- Store media metadata in project JSON.

### Phase 3: Timed Lyrics Foundation

- Add timed lyric model.
- Add SRT export.
- Add LRC export.
- Build lyric editor UI.
- Allow manual timed lyric edits and project save.

### Phase 4: Rendering MVP

- Render rotating-image MP4 with audio.
- Burn in manually supplied timed lyrics.
- Apply default lyric style.
- Support landscape, portrait, square, and auto layout.

### Phase 5: AI Transcription And Alignment

- Add OpenAI provider configuration.
- Add audio transcription flow.
- Add supplied-lyrics alignment flow.
- Save generated timed lyrics.
- Keep manual review/edit step before render.

### Phase 6: Local Transcription Fallback

- Add optional local provider configuration.
- Detect installed local transcription command.
- Run local transcription when OpenAI key is missing or provider is selected.
- Normalize provider output into `TimedLyricLine[]`.

### Phase 7: Polish And Portability

- Improve error messages.
- Add render progress.
- Add project import/export.
- Refine UI for mobile-friendly responsive layout.
- Document Android packaging path.

## First Build Target

The first useful milestone should be:

1. Create a project.
2. Upload audio and images.
3. Manually add timed lyrics or no-lyrics text.
4. Save/load the project.
5. Render an MP4 with rotating images, audio, and burned-in text.

After that foundation works, add AI transcription/alignment.

This order keeps the media pipeline testable before adding transcription complexity.

