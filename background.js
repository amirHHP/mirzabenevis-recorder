let recording = false;
let offscreenCreating = null;

// Keep track of the active tab for recording
let targetTabId = null;
let recordingStartTime = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'START_RECORDING') {
    startRecording()
      .then(() => sendResponse({ success: true }))
      .catch((error) => {
        console.error("Error starting recording:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open for async response
  } else if (message.action === 'STOP_RECORDING') {
    stopRecording().catch((error) => console.error("Error stopping recording:", error));
    sendResponse({ success: true });
    return false;
  } else if (message.action === 'GET_STATE') {
    sendResponse({ recording, startTime: recordingStartTime });
  } else if (message.action === 'GET_CONFIG') {
    chrome.storage.local.get(['provider', 'openaiApiKey', 'geminiApiKey', 'geminiModel'], (config) => {
      sendResponse(config);
    });
    return true;
  } else if (message.action === 'SAVE_TRANSCRIPTION') {
    chrome.storage.local.get('transcriptions', (result) => {
      const transcriptions = result.transcriptions || [];
      transcriptions.push({
        date: new Date().toISOString(),
        text: message.text
      });
      chrome.storage.local.set({ transcriptions }, () => {
        sendResponse({ success: true });
      });
    });
    return true;
  } else if (message.action === 'SET_STATUS') {
    chrome.storage.local.set({ lastStatus: message.status }, () => {
      sendResponse({ success: true });
    });
    return true;
  } else if (message.action === 'DOWNLOAD_AUDIO') {
    chrome.downloads.download({
      url: "data:audio/webm;base64," + message.base64,
      filename: message.filename
    }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});

async function startRecording() {
  if (recording) return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) throw new Error("No active tab found.");
  targetTabId = tab.id;

  // 1. Get the stream ID for the active tab
  const streamId = await new Promise((resolve, reject) => {
    chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id }, (id) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(id);
      }
    });
  });

  // 2. Ensure the offscreen document is created
  await setupOffscreenDocument('offscreen.html');

  // 3. Send the stream ID to the offscreen document to start recording
  // Add a small delay to ensure the offscreen document's JS has loaded and attached the listener
  await new Promise(resolve => setTimeout(resolve, 200));
  
  try {
    await chrome.runtime.sendMessage({
      action: 'START_OFFSCREEN_RECORDING',
      streamId: streamId
    });
  } catch (error) {
    if (error.message.includes('Receiving end does not exist')) {
      // Retry once after a longer delay
      console.warn("Retrying message to offscreen document...");
      await new Promise(resolve => setTimeout(resolve, 500));
      await chrome.runtime.sendMessage({
        action: 'START_OFFSCREEN_RECORDING',
        streamId: streamId
      });
    } else {
      throw error;
    }
  }

  recording = true;
  recordingStartTime = Date.now();
  chrome.action.setBadgeText({ text: 'REC' });
  chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
}

async function stopRecording() {
  if (!recording) return;

  // Send message to offscreen document to stop recording
  await chrome.runtime.sendMessage({
    action: 'STOP_OFFSCREEN_RECORDING'
  });

  recording = false;
  recordingStartTime = null;
  chrome.action.setBadgeText({ text: '' });
  
  // Close the offscreen document
  await closeOffscreenDocument();
}

async function setupOffscreenDocument(path) {
  if (await hasDocument()) return;

  if (offscreenCreating) {
    await offscreenCreating;
  } else {
    offscreenCreating = chrome.offscreen.createDocument({
      url: path,
      reasons: [chrome.offscreen.Reason.USER_MEDIA, chrome.offscreen.Reason.DISPLAY_MEDIA],
      justification: 'Recording audio for meeting transcription'
    });
    await offscreenCreating;
    offscreenCreating = null;
  }
}

async function closeOffscreenDocument() {
  if (!(await hasDocument())) return;
  await chrome.offscreen.closeDocument();
}

async function hasDocument() {
  if (chrome.offscreen && chrome.offscreen.hasDocument) {
    return await chrome.offscreen.hasDocument();
  }
  // Fallback if needed
  const matchedClients = await clients.matchAll();
  return matchedClients.some((c) => c.url.includes('offscreen.html'));
}
