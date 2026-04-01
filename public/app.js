// === 연플래닝 수학AI - Frontend ===

const API = '/.netlify/functions';

// State
let currentStudent = null;
let attachedImage = null;

// DOM
const $ = (sel) => document.querySelector(sel);
const loginScreen = $('#login-screen');
const mainScreen = $('#main-screen');
const loginForm = $('#login-form');
const loginBtn = $('#login-btn');
const loginError = $('#login-error');
const studentIdInput = $('#student-id');
const passwordInput = $('#password');
const userInfo = $('#user-info');
const remainingBadge = $('#remaining-badge');
const logoutBtn = $('#logout-btn');
const questionInput = $('#question-input');
const solveBtn = $('#solve-btn');
const imageInput = $('#image-input');
const imagePreview = $('#image-preview');
const previewImg = $('#preview-img');
const removeImageBtn = $('#remove-image');
const answerContainer = $('#answer-container');
const answerContent = $('#answer-content');
const emptyState = $('#empty-state');
const copyBtn = $('#copy-btn');
const saveStatus = $('#save-status');
const loadingOverlay = $('#loading-overlay');

// === Password Toggle ===
const togglePwBtn = $('#toggle-password');
togglePwBtn.addEventListener('click', () => {
  const isHidden = passwordInput.type === 'password';
  passwordInput.type = isHidden ? 'text' : 'password';
  togglePwBtn.querySelector('.eye-open').classList.toggle('hidden', isHidden);
  togglePwBtn.querySelector('.eye-closed').classList.toggle('hidden', !isHidden);
});

// === Service Worker ===
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

// === Auth ===
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.classList.add('hidden');
  loginBtn.disabled = true;
  loginBtn.querySelector('.btn-text').classList.add('hidden');
  loginBtn.querySelector('.btn-loading').classList.remove('hidden');

  try {
    const res = await fetch(`${API}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId: studentIdInput.value.trim(),
        password: passwordInput.value
      })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || '인증에 실패했습니다.');
    }

    currentStudent = data.student;
    sessionStorage.setItem('student', JSON.stringify(currentStudent));
    localStorage.setItem('credentials', JSON.stringify({
      studentId: studentIdInput.value.trim(),
      password: passwordInput.value
    }));
    showMainScreen();
  } catch (err) {
    loginError.textContent = err.message;
    loginError.classList.remove('hidden');
  } finally {
    loginBtn.disabled = false;
    loginBtn.querySelector('.btn-text').classList.remove('hidden');
    loginBtn.querySelector('.btn-loading').classList.add('hidden');
  }
});

function showMainScreen() {
  loginScreen.classList.remove('active');
  mainScreen.classList.add('active');
  userInfo.textContent = currentStudent.name;
  remainingBadge.textContent = `${currentStudent.remaining}회 남음`;
  questionInput.focus();
}

function showLoginScreen() {
  mainScreen.classList.remove('active');
  loginScreen.classList.add('active');
  currentStudent = null;
  sessionStorage.removeItem('student');
  localStorage.removeItem('credentials');
  loginForm.reset();
  loginError.classList.add('hidden');
  resetSolveUI();
}

logoutBtn.addEventListener('click', showLoginScreen);

// Session restore (sessionStorage first, then auto-login via localStorage)
const saved = sessionStorage.getItem('student');
if (saved) {
  try {
    currentStudent = JSON.parse(saved);
    showMainScreen();
  } catch {
    sessionStorage.removeItem('student');
  }
} else {
  const creds = localStorage.getItem('credentials');
  if (creds) {
    (async () => {
      try {
        const { studentId, password } = JSON.parse(creds);
        const res = await fetch(`${API}/auth`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentId, password })
        });
        const data = await res.json();
        if (res.ok) {
          currentStudent = data.student;
          sessionStorage.setItem('student', JSON.stringify(currentStudent));
          showMainScreen();
        } else {
          localStorage.removeItem('credentials');
        }
      } catch {
        localStorage.removeItem('credentials');
      }
    })();
  }
}

// === Image Attach ===
function loadImageFile(file) {
  if (!file || !file.type.startsWith('image/')) return;

  if (file.size > 10 * 1024 * 1024) {
    alert('이미지 크기는 10MB 이하여야 합니다.');
    return;
  }

  const reader = new FileReader();
  reader.onload = (ev) => {
    attachedImage = ev.target.result;
    previewImg.src = attachedImage;
    imagePreview.classList.remove('hidden');
    updateSolveBtn();
  };
  reader.readAsDataURL(file);
}

imageInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  loadImageFile(file);
});

const cameraInput = $('#camera-input');
cameraInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  loadImageFile(file);
});

// === Drag & Drop ===
const dropZone = $('.solve-area');
const dropOverlay = document.createElement('div');
dropOverlay.className = 'drop-overlay hidden';
dropOverlay.innerHTML = '<div class="drop-overlay-content"><svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg><p>여기에 놓으세요</p></div>';
dropZone.style.position = 'relative';
dropZone.appendChild(dropOverlay);

let dragCounter = 0;

document.addEventListener('dragenter', (e) => {
  e.preventDefault();
  e.stopPropagation();
  dragCounter++;
  if (mainScreen.classList.contains('active')) {
    dropOverlay.classList.remove('hidden');
  }
});

document.addEventListener('dragleave', (e) => {
  e.preventDefault();
  e.stopPropagation();
  dragCounter--;
  if (dragCounter <= 0) {
    dragCounter = 0;
    dropOverlay.classList.add('hidden');
  }
});

document.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.stopPropagation();
});

document.addEventListener('drop', (e) => {
  e.preventDefault();
  e.stopPropagation();
  dragCounter = 0;
  dropOverlay.classList.add('hidden');

  if (!mainScreen.classList.contains('active')) return;

  const dt = e.dataTransfer;
  if (!dt || !dt.files || dt.files.length === 0) return;

  const file = dt.files[0];
  if (file && file.type.startsWith('image/')) {
    loadImageFile(file);
  }
});

// === Clipboard Paste ===
document.addEventListener('paste', (e) => {
  if (!mainScreen.classList.contains('active')) return;

  // clipboardData.files (modern browsers)
  if (e.clipboardData.files && e.clipboardData.files.length > 0) {
    const file = e.clipboardData.files[0];
    if (file.type.startsWith('image/')) {
      e.preventDefault();
      loadImageFile(file);
      return;
    }
  }

  // clipboardData.items fallback
  const items = e.clipboardData.items;
  if (!items) return;
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault();
      const file = item.getAsFile();
      if (file) loadImageFile(file);
      return;
    }
  }
});

removeImageBtn.addEventListener('click', () => {
  attachedImage = null;
  imageInput.value = '';
  cameraInput.value = '';
  imagePreview.classList.add('hidden');
  previewImg.src = '';
  updateSolveBtn();
});

// === Question Input ===
questionInput.addEventListener('input', () => {
  // Auto-resize
  questionInput.style.height = 'auto';
  questionInput.style.height = Math.min(questionInput.scrollHeight, 120) + 'px';
  updateSolveBtn();
});

questionInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!solveBtn.disabled) handleSolve();
  }
});

function updateSolveBtn() {
  solveBtn.disabled = !questionInput.value.trim() && !attachedImage;
}

// === Solve ===
solveBtn.addEventListener('click', handleSolve);

async function handleSolve() {
  const question = questionInput.value.trim();
  if (!question && !attachedImage) return;
  if (!currentStudent) return;

  if (currentStudent.remaining <= 0) {
    alert('사용 가능 횟수가 모두 소진되었습니다.');
    return;
  }

  // Show loading
  loadingOverlay.classList.remove('hidden');
  solveBtn.disabled = true;

  try {
    // 1. Get answer from Claude
    const solveRes = await fetch(`${API}/solve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question,
        imageBase64: attachedImage,
        studentId: currentStudent.id
      })
    });

    const solveData = await solveRes.json();

    if (!solveRes.ok) {
      throw new Error(solveData.error || '풀이에 실패했습니다.');
    }

    // Display answer
    displayAnswer(solveData.answer);

    // Clear input
    questionInput.value = '';
    questionInput.style.height = 'auto';
    attachedImage = null;
    imageInput.value = '';
    imagePreview.classList.add('hidden');
    updateSolveBtn();

    // 2. Save to Google Drive & Sheets (background)
    saveResult(question, solveData.answer);

  } catch (err) {
    alert(err.message);
  } finally {
    loadingOverlay.classList.add('hidden');
    solveBtn.disabled = false;
  }
}

function displayAnswer(answer) {
  emptyState.classList.add('hidden');
  answerContainer.classList.remove('hidden');
  saveStatus.classList.add('hidden');

  // Convert markdown-like formatting
  let html = answer
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
  html = '<p>' + html + '</p>';

  answerContent.innerHTML = html;

  // Render LaTeX
  if (window.renderMathInElement) {
    renderMathInElement(answerContent, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false }
      ],
      throwOnError: false
    });
  }

  // Scroll to top of answer
  answerContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function saveResult(question, answer) {
  try {
    const res = await fetch(`${API}/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId: currentStudent.id,
        studentName: currentStudent.name,
        question,
        answer
      })
    });

    const data = await res.json();

    if (data.success) {
      // Update remaining count
      currentStudent.remaining = Math.max(0, currentStudent.remaining - 1);
      sessionStorage.setItem('student', JSON.stringify(currentStudent));
      remainingBadge.textContent = `${currentStudent.remaining}회 남음`;

      saveStatus.textContent = '풀이가 저장되었습니다.';
      saveStatus.classList.remove('hidden');
    }
  } catch {
    saveStatus.textContent = '저장에 실패했습니다. (풀이는 화면에 표시됩니다)';
    saveStatus.classList.remove('hidden');
  }
}

// === Copy ===
copyBtn.addEventListener('click', () => {
  const text = answerContent.innerText;
  navigator.clipboard.writeText(text).then(() => {
    copyBtn.textContent = '복사됨!';
    setTimeout(() => { copyBtn.textContent = '복사'; }, 1500);
  });
});

// === Reset ===
function resetSolveUI() {
  answerContainer.classList.add('hidden');
  emptyState.classList.remove('hidden');
  answerContent.innerHTML = '';
  questionInput.value = '';
  questionInput.style.height = 'auto';
  attachedImage = null;
  imageInput.value = '';
  cameraInput.value = '';
  imagePreview.classList.add('hidden');
  saveStatus.classList.add('hidden');
  updateSolveBtn();
}
