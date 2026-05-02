let recorder;
let audioChunks = [];
let audioContext;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'START_OFFSCREEN_RECORDING') {
    startRecording(message.streamId)
      .then(() => sendResponse({ success: true }))
      .catch((err) => {
        console.error(err);
        sendResponse({ success: false, error: err.message });
      });
    return true;
  } else if (message.action === 'STOP_OFFSCREEN_RECORDING') {
    stopRecording()
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

async function startRecording(streamId) {
  audioChunks = [];
  audioContext = new AudioContext();

  // 1. Get Tab Audio Stream
  const tabMediaConstraints = {
    audio: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId
      }
    },
    video: false
  };
  
  const tabStream = await navigator.mediaDevices.getUserMedia(tabMediaConstraints);
  
  // 2. Get Microphone Stream
  let micStream;
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  } catch (err) {
    console.warn("Could not get microphone stream. The user might not have granted permission. Proceeding with tab audio only.", err);
  }

  // 3. Mix the streams
  const destination = audioContext.createMediaStreamDestination();
  
  const tabSource = audioContext.createMediaStreamSource(tabStream);
  tabSource.connect(destination);
  
  // Connect tab source back to destination so the user can still hear the tab!
  // Wait, tab audio is already playing? Actually, tabCapture MUTES the tab by default!
  // We MUST connect the tabSource to the audioContext.destination to play it back to the user.
  tabSource.connect(audioContext.destination);

  if (micStream) {
    const micSource = audioContext.createMediaStreamSource(micStream);
    micSource.connect(destination);
    // Don't connect mic to audioContext.destination to avoid echo
  }

  const mixedStream = destination.stream;

  // 4. Start recording
  recorder = new MediaRecorder(mixedStream, { mimeType: 'audio/webm' });

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      audioChunks.push(event.data);
    }
  };

  recorder.onstop = async () => {
    const blob = new Blob(audioChunks, { type: 'audio/webm' });
    // Stop all tracks
    tabStream.getTracks().forEach(track => track.stop());
    if (micStream) micStream.getTracks().forEach(track => track.stop());
    if (audioContext.state !== 'closed') audioContext.close();

    // Process transcription
    await processTranscription(blob);
  };

  recorder.start(1000); // 1-second chunks
}

async function stopRecording() {
  if (recorder && recorder.state !== 'inactive') {
    recorder.stop();
  }
}

async function processTranscription(blob) {
  try {
    const { provider = 'openai', openaiApiKey, geminiApiKey } = await chrome.storage.local.get(['provider', 'openaiApiKey', 'geminiApiKey']);
    
    if (provider === 'openai' && !openaiApiKey) {
      console.warn("No OpenAI API Key found. Downloading audio instead.");
      await downloadAudio(blob, 'meeting_audio.webm');
      await chrome.storage.local.set({ lastStatus: 'Audio saved. Add OpenAI Key for transcription.' });
      return;
    }
    
    if (provider === 'gemini' && !geminiApiKey) {
      console.warn("No Gemini API Key found. Downloading audio instead.");
      await downloadAudio(blob, 'meeting_audio.webm');
      await chrome.storage.local.set({ lastStatus: 'Audio saved. Add Gemini Key for transcription.' });
      return;
    }

    await chrome.storage.local.set({ lastStatus: 'Transcribing...' });
    
    let transcription = '';

    if (provider === 'openai') {
      // Call OpenAI Whisper API
      const formData = new FormData();
      formData.append('file', blob, 'recording.webm');
      formData.append('model', 'whisper-1');

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API Error: ${errorText}`);
      }

      const data = await response.json();
      transcription = data.text;
    } else if (provider === 'gemini') {
      // Call Gemini API
      const base64Audio = await blobToBase64(blob);
      const payload = {
        contents: [
          {
            parts: [
              { text: "لطفاً فایل صوتی این جلسه را به زبان فارسی تبدیل به متن کن و فقط متن را بنویس. (حتی اگر انگلیسی صحبت شد ترجمه نکن، فقط متن دقیق صحبت ها را بنویس)" },
              {
                inline_data: {
                  mime_type: "audio/webm",
                  data: base64Audio
                }
              }
            ]
          }
        ]
      };
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API Error: ${errorText}`);
      }
      
      const data = await response.json();
      if (data.candidates && data.candidates.length > 0 && data.candidates[0].content.parts.length > 0) {
        transcription = data.candidates[0].content.parts[0].text;
      } else {
        throw new Error("No transcription found in Gemini response.");
      }
    }

    // Save transcription
    const { transcriptions = [] } = await chrome.storage.local.get('transcriptions');
    transcriptions.push({
      date: new Date().toISOString(),
      text: transcription
    });
    
    await chrome.storage.local.set({ 
      transcriptions, 
      lastStatus: 'Transcription complete!' 
    });
    
  } catch (error) {
    console.error("Transcription failed:", error);
    await chrome.storage.local.set({ lastStatus: `Error: ${error.message}` });
    await downloadAudio(blob, 'meeting_audio_error.webm');
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function downloadAudio(blob, filename) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = function() {
      const base64data = reader.result;
      chrome.downloads.download({
        url: base64data,
        filename: filename
      }, () => resolve());
    }
    reader.readAsDataURL(blob);
  });
}
