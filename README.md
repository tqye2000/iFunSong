# iFunSong

English | [中文](README.zh-CN.md)

iFunSong is a local web app for creating MP4 lyric/music videos from an audio file, one or more images, and optional lyrics.

<a href="samples/初恋的地方-video.mp4"><img src="samples/images/place%20of%20first%20love.png" alt="初恋的地方 sample video" width="600" height="600"></a>

The app can:

- Upload audio and images.
- Generate project background images with OpenAI from the song title or lyrics.
- Rotate multiple images evenly across the song.
- Extract lyrics from embedded metadata where available.
- Transcribe lyrics with OpenAI when configured.
- Align pasted lyrics to detected vocal timings.
- Edit timed lyrics before rendering.
- Export `.srt` and `.lrc` lyric files.
- Burn lyrics or free text overlays into an MP4.
- Save projects locally.

## Requirements

- Node.js 20 or newer.
- npm.

FFmpeg and FFprobe are provided through npm packages:

- `ffmpeg-static`
- `ffprobe-static`

You do not need system-wide FFmpeg unless you want to override the bundled binaries.

## Install

```powershell
cd D:\Development\iFunSong_dev
npm install --cache .\.npm-cache
```

## Run

```powershell
cd D:\Development\iFunSong_dev
npm start
```

Then open:

```text
http://localhost:4173
```

## Basic Workflow

1. Create or open a project.
2. Upload an audio file.
3. Upload one or more images.
4. Choose a lyric mode:
   - auto extract/transcribe
   - align pasted lyrics
   - no lyrics/free text
5. Review and edit timed lyrics.
6. Choose layout and styling.
7. Render the MP4.
8. Download MP4, SRT, or LRC.

## Samples

- [初恋的地方 sample video](samples/初恋的地方-video.mp4)

<a href="samples/初恋的地方-video.mp4"><img src="samples/images/place%20of%20first%20love.png" alt="初恋的地方 sample video" width="600" height="600"></a>

## Supported Inputs

Audio:

- Any format FFmpeg can read.
- Minimum target support: MP3 and WAV.

Images:

- JPG/JPEG
- PNG
- WEBP

## OpenAI Setup

OpenAI is optional, but required for AI-based lyric transcription/alignment unless you configure a local transcription command.
It is also required for AI image generation.

You can enter an OpenAI API key in the UI. It is stored only in browser `localStorage`, not in project JSON.

Or create a local `.env` file:

```env
OPENAI_API_KEY=your_key_here
OPENAI_TRANSCRIPTION_MODEL=whisper-1
OPENAI_IMAGE_MODEL=gpt-image-1
```

The default model is `whisper-1` because the app needs segment timestamps for line-by-line lyric timing.
The default image model is `gpt-image-1`.

## Network Troubleshooting

Use the **Test OpenAI** button in the UI.

If you see `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`, your network is likely intercepting TLS. Prefer adding your trusted proxy/company root certificate:

```env
NODE_EXTRA_CA_CERTS=C:\path\to\company-root-ca.pem
```

If your network requires a proxy:

```env
HTTPS_PROXY=http://proxy-host:proxy-port
```

If the app reports a web security page such as Zscaler, the OpenAI API is being blocked or held behind a browser-only caution page. The network/security policy must allow API requests to:

```text
https://api.openai.com
```

For local testing only, you can disable TLS verification:

```env
OPENAI_TLS_REJECT_UNAUTHORIZED=false
```

Do not use that setting for sensitive work.

## Local Transcription Hook

You can configure a local transcription command with:

```env
LOCAL_TRANSCRIPTION_COMMAND=
```

The command may use these placeholders:

- `{audio}`: input audio path
- `{output}`: JSON transcript output path

The command must write JSON like:

```json
{
  "text": "full transcript",
  "segments": [
    {
      "start": 0.0,
      "end": 3.5,
      "text": "first lyric line"
    }
  ]
}
```

Milliseconds are also accepted:

```json
{
  "segments": [
    {
      "startMs": 0,
      "endMs": 3500,
      "text": "first lyric line"
    }
  ]
}
```

## Environment Options

See [.env.example](D:/Development/iFunSong_dev/.env.example).

Common options:

```env
OPENAI_API_KEY=
OPENAI_TRANSCRIPTION_MODEL=whisper-1
OPENAI_IMAGE_MODEL=gpt-image-1
OPENAI_DIRECT_AUDIO_MAX_BYTES=25165824
HTTPS_PROXY=
NODE_EXTRA_CA_CERTS=
OPENAI_TLS_REJECT_UNAUTHORIZED=true
OPENAI_REQUEST_TIMEOUT_MS=600000
FFMPEG_PATH=
FFPROBE_PATH=
LOCAL_TRANSCRIPTION_COMMAND=
```

## Project Data

Projects are saved under:

```text
projects/
```

Generated project contents are ignored by git.

Each project stores:

- project JSON
- uploaded audio
- uploaded images
- exported lyric files
- rendered MP4 files

## Current MVP Limitations

- Lyric timing is line-by-line only.
- Karaoke-style word highlighting is not implemented yet.
- OpenAI alignment uses transcription segments and maps pasted lyric lines by word-count proportion, so review/edit timings before rendering.
- Local transcription support is a command hook, not a built-in model installer.

