const providerSelect = document.getElementById('provider');
const openaiGroup = document.getElementById('openaiGroup');
const geminiGroup = document.getElementById('geminiGroup');
const openaiKeyInput = document.getElementById('openaiKey');
const geminiKeyInput = document.getElementById('geminiKey');
const saveBtn = document.getElementById('saveBtn');
const statusMsg = document.getElementById('statusMsg');
const micPermBtn = document.getElementById('micPermBtn');
const micStatusMsg = document.getElementById('micStatusMsg');

document.addEventListener('DOMContentLoaded', async () => {
  const { provider = 'openai', openaiApiKey, geminiApiKey } = await chrome.storage.local.get(['provider', 'openaiApiKey', 'geminiApiKey']);
  
  providerSelect.value = provider;
  if (openaiApiKey) openaiKeyInput.value = openaiApiKey;
  if (geminiApiKey) geminiKeyInput.value = geminiApiKey;
  
  updateProviderView();
});

providerSelect.addEventListener('change', updateProviderView);

function updateProviderView() {
  if (providerSelect.value === 'openai') {
    openaiGroup.classList.remove('hidden');
    geminiGroup.classList.add('hidden');
  } else {
    openaiGroup.classList.add('hidden');
    geminiGroup.classList.remove('hidden');
  }
}

saveBtn.addEventListener('click', async () => {
  const provider = providerSelect.value;
  const openaiApiKey = openaiKeyInput.value.trim();
  const geminiApiKey = geminiKeyInput.value.trim();
  
  await chrome.storage.local.set({ provider, openaiApiKey, geminiApiKey });
  
  statusMsg.classList.add('show');
  setTimeout(() => {
    statusMsg.classList.remove('show');
  }, 3000);
});

micPermBtn.addEventListener('click', async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());
    micStatusMsg.innerText = "دسترسی میکروفون با موفقیت داده شد!";
    micStatusMsg.style.color = "var(--success-color)";
    micStatusMsg.classList.add('show');
  } catch (err) {
    micStatusMsg.innerText = "خطا در گرفتن دسترسی میکروفون: " + err.message;
    micStatusMsg.style.color = "var(--danger-color, red)";
    micStatusMsg.classList.add('show');
  }
});
