# iFunSong Requirements

## Product Goal

iFunSong is a local web app that creates MP4 lyric/music videos from an audio file, one or more images, and optional lyrics. It should run locally first, while keeping the architecture portable enough to become an Android app later.

## Core User Workflow

1. Create or open a local project.
2. Upload an audio file.
3. Upload one or more image files.
4. Choose a lyric mode:
   - Auto-extract/transcribe lyrics from audio.
   - Align user-provided lyrics to the song.
   - No-lyrics mode with optional free text overlays.
5. Generate or edit timed lyrics.
6. Choose video layout and lyric styling.
7. Render an MP4 video with burned-in lyrics or text.
8. Save/download the MP4, timed lyric files, and project file.

## Inputs

### Audio

- Accept any audio format FFmpeg can read.
- Minimum required support:
  - MP3
  - WAV

### Images

- Support:
  - JPG/JPEG
  - PNG
  - WEBP
- If multiple images are uploaded, v1 should rotate them automatically.
- For v1, images rotate with equal duration across the full song.

### Lyrics

- Lyrics are optional.
- If lyrics are not supplied, the app should try to extract or transcribe lyrics from the audio.
- If lyrics are supplied, the app should try to align those lyrics to the song.
- If no lyrics are wanted or transcription fails, the user can continue in no-lyrics mode.

## Lyric Extraction And Alignment

### Non-AI Extraction

The app should first check whether the audio file contains embedded lyric metadata, including timed lyrics where available. This is the only realistic non-AI extraction path.

Raw sung vocals generally cannot be converted to reliable lyrics with classic non-AI code alone. If lyrics are only present in the audio performance, transcription requires an AI or machine-learning speech/audio model.

### AI And Fallback Order

Recommended v1 processing order:

1. Check embedded lyrics/timed lyrics metadata.
2. If an OpenAI API key is configured, use OpenAI transcription or alignment.
3. If no OpenAI API key is configured, try a local/free transcription option where available.
4. If transcription or alignment fails, let the user continue in no-lyrics mode or manually edit lyrics/timings.

Possible local/free transcription options:

- whisper.cpp
- faster-whisper
- Vosk

### Timed Lyric Output

- Save generated or aligned lyrics to timed lyric files.
- Support export to:
  - SRT
  - LRC
- Internally represent timed lyrics as line-based entries:
  - line number or id
  - start time
  - end time
  - text

### Editing

- The user must be able to review and edit timed lyrics before rendering.
- V1 lyric timing is line-by-line.
- Karaoke-style word or syllable highlighting is out of scope for v1.

## Video Output

### MP4 Rendering

- Generate an MP4 file.
- Lyrics or free text overlays should be burned directly into the MP4.
- Timed lyric files should still be exported separately.

### Layout

The user can select the output layout:

- Landscape
- Portrait
- Square
- Auto-match or closely match the input image aspect ratio

Suggested concrete presets:

- Landscape: 1920x1080
- Portrait: 1080x1920
- Square: 1080x1080

### No-Lyrics Mode

If no lyrics are used, the app should allow the user to provide free text overlays such as:

- Song title
- Artist
- Dedication
- Intro or outro text
- Other custom captions

## Styling

V1 should support lyric styling controls:

- Font size
- Text color
- Outline or stroke
- Shadow
- Position:
  - Top
  - Center
  - Bottom
- Optional background dimming or blur for readability

The app should provide a smart default style, such as:

- White text
- Strong dark outline or shadow
- Bottom-center placement
- Subtle background dimming for readability

## Project Persistence

- Local project saving is required.
- A saved project should preserve:
  - Audio file reference or copied project asset
  - Uploaded image references or copied project assets
  - Lyric mode
  - Raw lyric text, if supplied
  - Timed lyric entries
  - Free text overlays
  - Layout settings
  - Styling settings
  - Render settings

Recommended project format:

- JSON project file
- Project asset folder containing uploaded media

## Architecture Direction

The first version should be a local web app with:

- Browser frontend for upload, preview, lyric editing, styling, and render controls.
- Local backend for file handling, FFmpeg/FFprobe operations, transcription integration, and MP4 rendering.
- FFmpeg as the rendering engine.
- A lyric service abstraction so OpenAI, embedded metadata, and local transcription providers can be swapped or combined.

The architecture should keep business logic modular so it can later be reused by an Android app, potentially through a wrapper such as Capacitor or through a native Android frontend calling similar backend/core logic.

## V1 Scope

In scope:

- Local web app.
- Audio upload.
- Image upload.
- Multiple image rotation with equal duration.
- Optional lyrics.
- Embedded lyric metadata check.
- OpenAI transcription/alignment if configured.
- Local/free transcription fallback if available.
- Timed lyric editing.
- SRT and LRC export.
- MP4 render with burned-in line-by-line lyrics.
- Layout selection.
- Basic lyric styling with smart defaults.
- No-lyrics mode with free text.
- Local project save/load.

Out of scope for v1:

- Word-by-word karaoke highlighting.
- Syllable-level timing.
- Cloud hosting.
- User accounts.
- Collaboration.
- Advanced image timing per lyric section.
- Advanced mobile-native implementation.

