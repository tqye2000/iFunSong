# iFunSong

[English](README.md) | 中文

iFunSong 是一个本地 Web 应用，可通过一个音频文件、一张或多张图片，以及可选歌词，制作 MP4 歌词/音乐视频。
[初恋的地方示例视频](samples/初恋的地方-video.mp4)

应用可以：

- 上传音频和图片。
- 在整首歌中均匀轮换多张图片。
- 在可用时从内嵌元数据中提取歌词。
- 在已配置 OpenAI 时转录歌词。
- 将粘贴的歌词对齐到检测到的人声时间。
- 在渲染前编辑带时间轴的歌词。
- 导出 `.srt` 和 `.lrc` 歌词文件。
- 将歌词或自由文本叠加烧录到 MP4 中。
- 在本地保存项目。

## 要求

- Node.js 20 或更高版本。
- npm。

FFmpeg 和 FFprobe 通过 npm 包提供：

- `ffmpeg-static`
- `ffprobe-static`

除非你想覆盖内置二进制文件，否则不需要系统级 FFmpeg。

## 安装

```powershell
cd D:\Development\iFunSong_dev
npm install --cache .\.npm-cache
```

## 运行

```powershell
cd D:\Development\iFunSong_dev
npm start
```

然后打开：

```text
http://localhost:4173
```

## 基本流程

1. 创建或打开一个项目。
2. 上传音频文件。
3. 上传一张或多张图片。
4. 选择歌词模式：
   - 自动提取/转录
   - 对齐粘贴的歌词
   - 无歌词/自由文本
5. 检查并编辑带时间轴的歌词。
6. 选择布局和样式。
7. 渲染 MP4。
8. 下载 MP4、SRT 或 LRC。

## 示例

- [初恋的地方示例视频](samples/初恋的地方-video.mp4)

## 支持的输入

音频：

- FFmpeg 可读取的任意格式。
- 最低目标支持：MP3 和 WAV。

图片：

- JPG/JPEG
- PNG
- WEBP

## OpenAI 设置

OpenAI 是可选的，但如果要使用基于 AI 的歌词转录/对齐，则需要配置 OpenAI，除非你配置了本地转录命令。

你可以在 UI 中输入 OpenAI API key。它只会存储在浏览器 `localStorage` 中，不会写入项目 JSON。

也可以创建本地 `.env` 文件：

```env
OPENAI_API_KEY=your_key_here
OPENAI_TRANSCRIPTION_MODEL=whisper-1
```

默认模型是 `whisper-1`，因为应用需要分段时间戳来进行逐行歌词定时。

## 网络故障排查

使用 UI 中的 **Test OpenAI** 按钮。

如果你看到 `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`，你的网络很可能正在拦截 TLS。建议添加受信任的代理/公司根证书：

```env
NODE_EXTRA_CA_CERTS=C:\path\to\company-root-ca.pem
```

如果你的网络需要代理：

```env
HTTPS_PROXY=http://proxy-host:proxy-port
```

如果应用报告 Zscaler 之类的 Web 安全页面，说明 OpenAI API 被阻止，或被拦在只能通过浏览器确认的提示页后。网络/安全策略必须允许访问 API 请求：

```text
https://api.openai.com
```

仅用于本地测试时，可以关闭 TLS 验证：

```env
OPENAI_TLS_REJECT_UNAUTHORIZED=false
```

不要在敏感工作中使用该设置。

## 本地转录钩子

你可以通过以下配置使用本地转录命令：

```env
LOCAL_TRANSCRIPTION_COMMAND=
```

命令可以使用这些占位符：

- `{audio}`：输入音频路径
- `{output}`：JSON 转录输出路径

命令必须写入如下 JSON：

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

也接受毫秒：

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

## 环境选项

参见 [.env.example](D:/Development/iFunSong_dev/.env.example)。

常用选项：

```env
OPENAI_API_KEY=
OPENAI_TRANSCRIPTION_MODEL=whisper-1
OPENAI_DIRECT_AUDIO_MAX_BYTES=25165824
HTTPS_PROXY=
NODE_EXTRA_CA_CERTS=
OPENAI_TLS_REJECT_UNAUTHORIZED=true
OPENAI_REQUEST_TIMEOUT_MS=600000
FFMPEG_PATH=
FFPROBE_PATH=
LOCAL_TRANSCRIPTION_COMMAND=
```

## 项目数据

项目保存在：

```text
projects/
```

生成的项目内容会被 git 忽略。

每个项目会保存：

- 项目 JSON
- 上传的音频
- 上传的图片
- 导出的歌词文件
- 渲染出的 MP4 文件

## 当前 MVP 限制

- 歌词定时仅支持逐行。
- 尚未实现卡拉 OK 风格的逐词高亮。
- OpenAI 对齐使用转录分段，并按词数比例映射粘贴的歌词行，因此请在渲染前检查/编辑时间轴。
- 本地转录支持是命令钩子，不是内置模型安装器。