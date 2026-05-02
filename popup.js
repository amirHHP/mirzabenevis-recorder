const recordBtn = document.getElementById('recordBtn');
const statusText = document.getElementById('statusText');
const timerDisplay = document.getElementById('timer');
const recorderSection = document.querySelector('.recorder-section');
const transcriptsList = document.getElementById('transcriptsList');
const refreshBtn = document.getElementById('refreshBtn');
const settingsBtn = document.getElementById('settingsBtn');
const micStatus = document.getElementById('micStatus');

let isRecording = false;
let timerInterval;
let startTime;

document.addEventListener('DOMContentLoaded', async () => {
  // Check if we are already recording
  const response = await chrome.runtime.sendMessage({ action: 'GET_STATE' });
  if (response && response.recording) {
    if (response.startTime) {
      startTime = response.startTime;
    } else {
      startTime = Date.now();
    }
    setRecordingState(true, false); // pass false so we don't overwrite startTime
  }

  checkMicrophonePermission();
  loadTranscripts();
  
  // Periodically check for transcription status updates
  setInterval(checkStatus, 2000);
});

async function checkMicrophonePermission() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());
    micStatus.style.display = 'none';
  } catch (err) {
    micStatus.style.display = 'block';
    micStatus.innerText = "دسترسی میکروفون مسدود است! لطفاً به تنظیمات بروید.";
    micStatus.className = 'status-badge warning';
  }
}

recordBtn.addEventListener('click', async () => {
  if (!isRecording) {
    // Request permission just in case
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      micStatus.style.display = 'none';
    } catch (err) {
      micStatus.style.display = 'block';
      micStatus.innerText = "دسترسی میکروفون مسدود است! لطفاً به تنظیمات بروید.";
      return;
    }

    // Start recording
    chrome.runtime.sendMessage({ action: 'START_RECORDING' }, (response) => {
      if (response && response.success) {
        setRecordingState(true);
      } else {
        alert("خطا در شروع ضبط: " + (response ? response.error : "Unknown"));
      }
    });
  } else {
    // Stop recording
    chrome.runtime.sendMessage({ action: 'STOP_RECORDING' }, (response) => {
      if (response && response.success) {
        setRecordingState(false);
        checkStatus();
      }
    });
  }
});

function setRecordingState(recording, resetTime = true) {
  isRecording = recording;
  if (recording) {
    recorderSection.classList.add('recording');
    statusText.innerText = "در حال ضبط...";
    startTimer(resetTime);
  } else {
    recorderSection.classList.remove('recording');
    statusText.innerText = "آماده ضبط";
    stopTimer();
  }
}

function startTimer(resetTime = true) {
  if (resetTime) startTime = Date.now();
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const minutes = Math.floor(elapsed / 60000).toString().padStart(2, '0');
    const seconds = Math.floor((elapsed % 60000) / 1000).toString().padStart(2, '0');
    timerDisplay.innerText = `${minutes}:${seconds}`;
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerDisplay.innerText = "00:00";
}

async function loadTranscripts() {
  const { transcriptions = [] } = await chrome.storage.local.get('transcriptions');
  
  if (transcriptions.length === 0) {
    transcriptsList.innerHTML = '<div class="empty-state">هنوز هیچ جلسه‌ای ضبط نشده است.</div>';
    return;
  }
  
  // Sort descending
  transcriptions.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  transcriptsList.innerHTML = transcriptions.map(t => {
    const dateObj = new Date(t.date);
    const dateStr = new Intl.DateTimeFormat('fa-IR', { 
      year: 'numeric', month: 'long', day: 'numeric', 
      hour: '2-digit', minute: '2-digit' 
    }).format(dateObj);
    
    return `
      <div class="transcript-card">
        <span class="transcript-date">${dateStr}</span>
        <div class="transcript-text" title="${t.text.replace(/"/g, '&quot;')}">${t.text}</div>
      </div>
    `;
  }).join('');
}

async function checkStatus() {
  const { lastStatus } = await chrome.storage.local.get('lastStatus');
  if (lastStatus) {
    // Show a temporary status notification if needed, or just refresh list
    if (lastStatus === 'Transcription complete!') {
      statusText.innerText = "آماده ضبط";
      loadTranscripts();
      // Clear status after showing
      await chrome.storage.local.remove('lastStatus');
    } else if (lastStatus.includes('Error') || lastStatus.includes('saved')) {
      statusText.innerText = "آماده ضبط";
      alert(lastStatus);
      await chrome.storage.local.remove('lastStatus');
    } else if (lastStatus === 'Transcribing...') {
      statusText.innerText = "در حال پردازش صدا و تبدیل به متن...";
    }
  }
}

refreshBtn.addEventListener('click', loadTranscripts);

settingsBtn.addEventListener('click', () => {
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    window.open(chrome.runtime.getURL('options.html'));
  }
});
