# Mirzabenevis Recorder 🎙️

A powerful Google Chrome Extension for seamlessly recording online meetings (capturing both microphone and system audio) and automatically transcribing them to text using AI.

## 🌟 Features

- **One-Click Recording**: Start recording your browser tab and microphone audio with a single click.
- **Smart Audio Mixing**: Automatically combines your microphone input with the meeting's audio (from Google Meet, Zoom Web, etc.) into a single, synchronized track.
- **AI Transcription**: Automatically transcribes the meeting audio into text as soon as the recording stops.
- **Multi-Provider Support**: Choose between **OpenAI (Whisper)** or **Google Gemini** for your transcription needs.
- **Dynamic Model Selection**: Fetch and select the latest available Gemini models directly from your API key.
- **Privacy First**: Your API keys are stored securely in your local browser storage (`chrome.storage.local`) and are never sent to any third-party servers other than the official AI providers.
- **Fallback Mechanism**: If no API key is provided, the extension will automatically download the raw `.webm` audio file so you never lose a meeting.
- **Modern UI**: A sleek, dark-mode inspired interface that feels premium and native.

## 🛠️ Installation

1. Clone this repository or download the ZIP file and extract it.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** in the top right corner.
4. Click on **Load unpacked** and select the directory containing the extension files.
5. The extension icon will appear in your browser toolbar.

## ⚙️ Configuration

Before using the transcription feature, you need to configure your API keys:

1. Click on the extension icon in the toolbar.
2. Click the **Settings (Gear Icon)** in the top left corner of the popup.
3. Grant **Microphone Permission** if you haven't already.
4. Select your preferred provider (OpenAI or Gemini).
5. Enter your API Key.
   - *For Gemini*: You can click **"دریافت مدل‌ها" (Fetch Models)** to automatically retrieve the list of supported AI models and select your preferred one (e.g., `gemini-1.5-flash`).
6. Click **Save Settings**.

## 🚀 Usage

1. Join your online meeting (Google Meet, Microsoft Teams web, etc.).
2. Click the Mirzabenevis extension icon.
3. Click the red **Record** button.
4. When the meeting is over, click the **Stop** button.
5. Wait a few seconds for the AI to process and transcribe the audio. The transcript will appear in the "Recent Transcripts" list.

## 📄 License

MIT License
