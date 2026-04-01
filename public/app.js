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
  loginForm.reset();
  loginError.classList.add('hidden');
  resetSolveUI();
}

logoutBtn.addEventListener('click', showLoginScreen);

// Session restore
const saved = sessionStorage.getItem('student');
if (saved) {
  try {
    currentStudent = JSON.parse(saved);
    showMainScreen();
  } catch {
    sessionStorage.removeItem('student');
  }
}

// === Image Attach ===
imageInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  if (file.size > 10 * 1024 * 1024) {
    alert('이미지 크기는 10MB 이하여야 합니다.');
    imageInput.value = '';
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
});

removeImageBtn.addEventListener('click', () => {
  attachedImage = null;
  imageInput.value = '';
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
  imagePreview.classList.add('hidden');
  saveStatus.classList.add('hidden');
  updateSolveBtn();
}
