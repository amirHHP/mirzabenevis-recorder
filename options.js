const providerSelect = document.getElementById('provider');
const openaiGroup = document.getElementById('openaiGroup');
const geminiGroup = document.getElementById('geminiGroup');
const openaiKeyInput = document.getElementById('openaiKey');
const geminiKeyInput = document.getElementById('geminiKey');
const fetchModelsBtn = document.getElementById('fetchModelsBtn');
const geminiModelSelect = document.getElementById('geminiModel');
const saveBtn = document.getElementById('saveBtn');
const statusMsg = document.getElementById('statusMsg');
const micPermBtn = document.getElementById('micPermBtn');
const micStatusMsg = document.getElementById('micStatusMsg');

document.addEventListener('DOMContentLoaded', async () => {
  const { provider = 'openai', openaiApiKey, geminiApiKey, geminiModel = 'gemini-1.5-flash' } = await chrome.storage.local.get(['provider', 'openaiApiKey', 'geminiApiKey', 'geminiModel']);
  
  providerSelect.value = provider;
  if (openaiApiKey) openaiKeyInput.value = openaiApiKey;
  if (geminiApiKey) geminiKeyInput.value = geminiApiKey;
  // Initially just set the value if it's there. The user can fetch models to see full list.
  if (geminiModel) {
    const opt = document.createElement('option');
    opt.value = geminiModel;
    opt.textContent = geminiModel;
    opt.selected = true;
    geminiModelSelect.appendChild(opt);
  }
  
  updateProviderView();
});

fetchModelsBtn.addEventListener('click', async () => {
  const apiKey = geminiKeyInput.value.trim();
  if (!apiKey) {
    alert("لطفاً ابتدا کلید API را وارد کنید.");
    return;
  }
  
  fetchModelsBtn.textContent = "در حال دریافت...";
  fetchModelsBtn.disabled = true;
  
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || "خطا در دریافت لیست مدل‌ها");
    }
    
    const data = await response.json();
    geminiModelSelect.innerHTML = ''; // Clear current options
    
    let found = false;
    data.models.forEach(m => {
      if (m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent')) {
        const opt = document.createElement('option');
        // m.name is like "models/gemini-1.5-flash", we only want the name part usually, 
        // but wait, the API expects just the name after "models/" or the full "models/...".
        // In offscreen.js we do `models/${geminiModel}`, so we need to store just the name without `models/`
        let val = m.name;
        if (val.startsWith('models/')) val = val.substring(7);
        
        opt.value = val;
        opt.textContent = m.displayName ? `${m.displayName} (${val})` : val;
        geminiModelSelect.appendChild(opt);
        found = true;
      }
    });
    
    if (!found) {
      alert("مدلی که از generateContent پشتیبانی کند یافت نشد.");
    } else {
      // Re-select the currently saved model if it exists in the new list
      const { geminiModel } = await chrome.storage.local.get('geminiModel');
      if (geminiModel) {
        geminiModelSelect.value = geminiModel;
      }
    }
    
  } catch (err) {
    alert("خطا: " + err.message);
  } finally {
    fetchModelsBtn.textContent = "دریافت مدل‌ها";
    fetchModelsBtn.disabled = false;
  }
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
  const geminiModel = geminiModelSelect.value;
  
  await chrome.storage.local.set({ provider, openaiApiKey, geminiApiKey, geminiModel });
  
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
