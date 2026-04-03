/**
 * 연플래닝 수학AI — 결제 시스템 (자동 주입형)
 * index.html에 <script src="/payment-system.js"></script> 한 줄만 추가하면 동작
 *
 * 기능:
 *  1. 무료 체험 횟수 관리 (주차별 자동 감소)
 *  2. "오늘 N회 남음" 배지 헤더에 자동 삽입
 *  3. 횟수 초과 시 결제/회원가입 모달 자동 표시
 *  4. 토스페이먼츠 결제 연동
 *  5. 회원가입 화면
 *
 * ⚠️ 설정 필요: 아래 CONFIG의 TOSS_CLIENT_KEY를 실제 키로 교체
 */

/* ─────────────── 설정 ─────────────── */
const CONFIG = {
  TOSS_CLIENT_KEY: 'test_ck_XZYkKL4MrjwY2adJeB6A80zJwlEW',
  PLANS: [
    { id: 'basic',    name: '베이직',  price: 14900, daily: 10, desc: '하루 10문제' },
    { id: 'premium',  name: '프리미엄', price: 19900, daily: 30, desc: '하루 30문제' },
  ],
  FREE_LIMITS: [3, 2, 1, 0],   // 1주차, 2주차, 3주차, 4주차+
  SUCCESS_URL: `${location.origin}/payment-success`,
  FAIL_URL:    `${location.origin}/payment-fail`,
};

/* ─────────────── 무료 체험 상태 ─────────────── */
const Trial = {
  /** 오늘 날짜 (index.html과 동일 형식) */
  _today() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  },

  /** 앱 첫 사용일 (index.html과 동일 키: firstVisitDate) */
  getFirstDate() {
    let d = localStorage.getItem('firstVisitDate');
    if (!d) { d = this._today(); localStorage.setItem('firstVisitDate', d); }
    return new Date(d);
  },

  /** 현재 주차 (1~4+) */
  getWeek() {
    const diff = Math.floor((new Date(this._today()) - this.getFirstDate()) / 86400000);
    return Math.min(Math.floor(diff / 7) + 1, 4);
  },

  /** 오늘 사용한 횟수 (index.html과 동일 키: dailyUsage:YYYY-MM-DD) */
  getUsedToday() {
    const key = 'dailyUsage:' + this._today();
    return parseInt(localStorage.getItem(key) || '0', 10);
  },

  /** 오늘 한 번 사용 처리 */
  use() {
    const key = 'dailyUsage:' + this._today();
    const n = this.getUsedToday() + 1;
    localStorage.setItem(key, String(n));
    return n;
  },

  /** 오늘 남은 무료 횟수 (음수는 0으로) */
  getRemaining() {
    const limit = CONFIG.FREE_LIMITS[Math.min(this.getWeek() - 1, 3)];
    return Math.max(limit - this.getUsedToday(), 0);
  },

  /** 유료 회원 여부 */
  isPaid() {
    return localStorage.getItem('yp_paid') === '1';
  },

  /** 결제 완료 처리 (서버 검증 후 호출) */
  setPaid(planId) {
    localStorage.setItem('yp_paid', '1');
    localStorage.setItem('yp_plan', planId);
    const plan = CONFIG.PLANS.find(p => p.id === planId);
    localStorage.setItem('yp_daily_limit', plan ? plan.daily : 10);
  },

  /** 유료 회원 일일 남은 횟수 */
  getPaidRemaining() {
    const limit = parseInt(localStorage.getItem('yp_daily_limit') || '10', 10);
    return Math.max(limit - this.getUsedToday(), 0);
  },

  /** 풀이 가능 여부 */
  canSolve() {
    if (this.isPaid()) return this.getPaidRemaining() > 0;
    return this.getRemaining() > 0;
  },

  /** 배지 텍스트 */
  getBadgeText() {
    if (this.isPaid()) {
      const r = this.getPaidRemaining();
      return r > 0 ? `오늘 ${r}회 남음` : '오늘 다 사용했어요';
    }
    const r = this.getRemaining();
    const week = this.getWeek();
    if (week >= 4 && r === 0) return '무료 체험 종료';
    return r > 0 ? `무료 ${r}회 남음` : '오늘 다 사용했어요';
  },
};

/* ─────────────── CSS 주입 ─────────────── */
const style = document.createElement('style');
style.textContent = `
/* ── 배지 ── */
.yp-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: rgba(29,158,117,0.15);
  border: 1px solid rgba(29,158,117,0.4);
  color: #1D9E75;
  border-radius: 20px;
  padding: 4px 11px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all .2s;
  white-space: nowrap;
}
.yp-badge.warn { background: rgba(245,158,11,.15); border-color: rgba(245,158,11,.4); color: #f59e0b; }
.yp-badge.danger { background: rgba(255,77,109,.15); border-color: rgba(255,77,109,.4); color: #ff4d6d; }
.yp-badge:hover { transform: scale(1.04); }

/* ── 오버레이 ── */
.yp-overlay {
  display: none;
  position: fixed; inset: 0;
  background: rgba(0,0,0,.7);
  backdrop-filter: blur(6px);
  z-index: 9999;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
.yp-overlay.open { display: flex; animation: ypFadeIn .2s ease; }
@keyframes ypFadeIn { from { opacity:0; transform:scale(.95); } to { opacity:1; transform:scale(1); } }

/* ── 모달 공통 ── */
.yp-modal {
  background: #111f3a;
  border: 1px solid #1e3a5f;
  border-radius: 20px;
  width: 100%; max-width: 420px;
  max-height: 90vh;
  overflow-y: auto;
  padding: 28px 24px 24px;
  position: relative;
}
.yp-modal-close {
  position: absolute; top: 16px; right: 16px;
  background: rgba(255,255,255,.08);
  border: none; color: #8ba3c0;
  width: 32px; height: 32px; border-radius: 50%;
  cursor: pointer; font-size: 16px;
  display: flex; align-items: center; justify-content: center;
  transition: background .2s;
}
.yp-modal-close:hover { background: rgba(255,255,255,.15); }
.yp-modal h2 { font-size: 20px; font-weight: 800; color: #e8f0fe; margin-bottom: 6px; }
.yp-modal p  { font-size: 13px; color: #8ba3c0; line-height: 1.6; margin-bottom: 20px; }

/* ── 플랜 카드 ── */
.yp-plans { display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px; }
.yp-plan {
  border: 2px solid #1e3a5f;
  border-radius: 14px;
  padding: 16px;
  cursor: pointer;
  transition: all .2s;
  position: relative;
}
.yp-plan:hover { border-color: #1D9E75; background: rgba(29,158,117,.06); }
.yp-plan.selected { border-color: #1D9E75; background: rgba(29,158,117,.1); }
.yp-plan-name { font-size: 15px; font-weight: 700; color: #e8f0fe; margin-bottom: 2px; }
.yp-plan-desc { font-size: 12px; color: #8ba3c0; }
.yp-plan-price { position: absolute; right: 16px; top: 50%; transform: translateY(-50%); font-size: 16px; font-weight: 800; color: #1D9E75; }
.yp-plan-badge-rec {
  position: absolute; top: -10px; right: 12px;
  background: #1D9E75; color: #fff;
  font-size: 10px; font-weight: 700;
  padding: 2px 8px; border-radius: 20px;
}

/* ── 버튼 ── */
.yp-btn {
  width: 100%;
  padding: 14px;
  border-radius: 12px;
  border: none;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: all .2s;
}
.yp-btn-pay {
  background: linear-gradient(135deg, #1D9E75, #14c98a);
  color: #fff;
  margin-bottom: 10px;
}
.yp-btn-pay:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(29,158,117,.4); }
.yp-btn-pay:disabled { opacity: .5; cursor: not-allowed; transform: none; }
.yp-btn-secondary {
  background: rgba(255,255,255,.06);
  border: 1px solid #1e3a5f;
  color: #8ba3c0;
}
.yp-btn-secondary:hover { background: rgba(255,255,255,.1); }

/* ── 입력 ── */
.yp-field { margin-bottom: 14px; }
.yp-field label { display: block; font-size: 12px; color: #8ba3c0; margin-bottom: 6px; font-weight: 600; }
.yp-field input {
  width: 100%;
  background: rgba(255,255,255,.05);
  border: 1px solid #1e3a5f;
  border-radius: 10px;
  padding: 12px 14px;
  color: #e8f0fe;
  font-size: 14px;
  outline: none;
  transition: border-color .2s;
}
.yp-field input:focus { border-color: #1D9E75; }
.yp-field input::placeholder { color: #4a6580; }

/* ── 구분선 ── */
.yp-divider { text-align: center; color: #4a6580; font-size: 12px; margin: 12px 0; }

/* ── 주차 프로그레스 ── */
.yp-trial-info {
  background: rgba(255,255,255,.04);
  border: 1px solid #1e3a5f;
  border-radius: 12px;
  padding: 14px;
  margin-bottom: 16px;
}
.yp-trial-row { display: flex; justify-content: space-between; font-size: 12px; color: #8ba3c0; margin-bottom: 8px; }
.yp-week-dots { display: flex; gap: 6px; }
.yp-week-dot {
  width: 28px; height: 6px; border-radius: 3px;
  background: #1e3a5f;
}
.yp-week-dot.done { background: #1D9E75; }
.yp-week-dot.current { background: #f59e0b; }

/* ── 성공 화면 ── */
.yp-success { text-align: center; padding: 20px 0; }
.yp-success-icon { font-size: 56px; margin-bottom: 12px; }
.yp-success h3 { font-size: 20px; font-weight: 800; color: #e8f0fe; margin-bottom: 8px; }
.yp-success p { font-size: 14px; color: #8ba3c0; }
`;
document.head.appendChild(style);

/* ─────────────── 배지 업데이트 ─────────────── */
function updateBadge() {
  // index.html의 기존 trial-badge 요소 사용
  const badge = document.getElementById('trial-badge');
  if (!badge) return;

  if (Trial.isPaid()) {
    // 유료 회원
    const r = Trial.getPaidRemaining();
    badge.textContent = r > 0 ? `오늘 ${r}회 남음` : '오늘 다 사용했어요';
    badge.classList.remove('hidden', 'exhausted');
    badge.className = 'trial-badge' + (r === 0 ? ' exhausted' : '');
    badge.onclick = () => PayModal.open();
  } else {
    // 무료 회원
    const r = Trial.getRemaining();
    const week = Trial.getWeek();
    badge.classList.remove('hidden');
    if (week >= 4 && r === 0) {
      badge.textContent = '체험 종료';
      badge.className = 'trial-badge exhausted';
    } else if (r === 0) {
      badge.textContent = '오늘 0회 남음';
      badge.className = 'trial-badge exhausted';
    } else {
      badge.textContent = `오늘 ${r}회 남음`;
      badge.className = 'trial-badge';
    }
    badge.onclick = () => PayModal.open();
  }
}

/* ─────────────── 결제/플랜 모달 ─────────────── */
const PayModal = (() => {
  let selectedPlan = CONFIG.PLANS[1]; // 기본: 프리미엄
  let overlay;

  function build() {
    if (document.getElementById('yp-pay-overlay')) return;
    overlay = document.createElement('div');
    overlay.id = 'yp-pay-overlay';
    overlay.className = 'yp-overlay';
    overlay.innerHTML = `
      <div class="yp-modal">
        <button class="yp-modal-close" id="yp-pay-close">✕</button>

        <!-- 무료 체험 현황 -->
        <div class="yp-trial-info" id="yp-trial-block">
          <div class="yp-trial-row">
            <span>무료 체험 현황</span>
            <span id="yp-trial-week-label">1주차</span>
          </div>
          <div class="yp-week-dots" id="yp-week-dots"></div>
        </div>

        <h2>🚀 무제한으로 사용하기</h2>
        <p>AI 수학 풀이, 3가지 풀이법, 유사문제 생성을<br>매일 마음껏 사용하세요!</p>

        <!-- 플랜 선택 -->
        <div class="yp-plans" id="yp-plans-list"></div>

        <!-- 결제 버튼 -->
        <button class="yp-btn yp-btn-pay" id="yp-btn-pay">💳 결제하고 시작하기</button>
        <div class="yp-divider">또는</div>
        <button class="yp-btn yp-btn-secondary" id="yp-btn-signup-link">✏️ 회원가입만 하기 (무료 체험 연장)</button>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    document.getElementById('yp-pay-close').onclick = close;
    document.getElementById('yp-btn-pay').onclick = startPayment;
    document.getElementById('yp-btn-signup-link').onclick = () => { close(); SignupModal.open(); };

    renderPlans();
    renderTrialInfo();
  }

  function renderPlans() {
    const list = document.getElementById('yp-plans-list');
    if (!list) return;
    list.innerHTML = CONFIG.PLANS.map(p => `
      <div class="yp-plan ${p.id === selectedPlan.id ? 'selected' : ''}" data-plan="${p.id}">
        ${p.id === 'premium' ? '<div class="yp-plan-badge-rec">추천</div>' : ''}
        <div class="yp-plan-name">${p.name}</div>
        <div class="yp-plan-desc">${p.desc}</div>
        <div class="yp-plan-price">월 ${p.price.toLocaleString()}원</div>
      </div>
    `).join('');

    list.querySelectorAll('.yp-plan').forEach(el => {
      el.onclick = () => {
        selectedPlan = CONFIG.PLANS.find(p => p.id === el.dataset.plan);
        list.querySelectorAll('.yp-plan').forEach(e => e.classList.remove('selected'));
        el.classList.add('selected');
      };
    });
  }

  function renderTrialInfo() {
    const week = Trial.getWeek();
    const label = document.getElementById('yp-trial-week-label');
    const dots  = document.getElementById('yp-week-dots');
    if (!label || !dots) return;
    label.textContent = `${Math.min(week, 4)}주차 진행 중`;
    dots.innerHTML = [1,2,3,4].map(w => `
      <div class="yp-week-dot ${w < week ? 'done' : w === week ? 'current' : ''}"></div>
    `).join('');
  }

  async function startPayment() {
    const btn = document.getElementById('yp-btn-pay');
    btn.disabled = true;
    btn.textContent = '결제창 열는 중...';

    try {
      // 토스페이먼츠 SDK 로드 (없으면 동적 로드)
      if (!window.TossPayments) {
        await loadScript('https://js.tosspayments.com/v1/payment');
      }

      const tossPayments = TossPayments(CONFIG.TOSS_CLIENT_KEY);
      const orderId = 'YP_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8).toUpperCase();

      await tossPayments.requestPayment('카드', {
        amount: selectedPlan.price,
        orderId,
        orderName: `연플래닝 수학AI ${selectedPlan.name} 월정액`,
        customerName: localStorage.getItem('yp_name') || '학생',
        customerEmail: localStorage.getItem('yp_email') || '',
        successUrl: `${CONFIG.SUCCESS_URL}?plan=${selectedPlan.id}`,
        failUrl: CONFIG.FAIL_URL,
      });
    } catch (err) {
      console.error('[Payment Error]', err);
      if (err.code !== 'USER_CANCEL') {
        alert('결제 중 오류가 발생했어요: ' + err.message);
      }
    } finally {
      btn.disabled = false;
      btn.textContent = '💳 결제하고 시작하기';
    }
  }

  function open() { build(); overlay.classList.add('open'); }
  function close() { overlay && overlay.classList.remove('open'); }

  return { open, close };
})();

/* ─────────────── 회원가입 모달 ─────────────── */
const SignupModal = (() => {
  let overlay;

  function build() {
    if (document.getElementById('yp-signup-overlay')) return;
    overlay = document.createElement('div');
    overlay.id = 'yp-signup-overlay';
    overlay.className = 'yp-overlay';
    overlay.innerHTML = `
      <div class="yp-modal">
        <button class="yp-modal-close" id="yp-signup-close">✕</button>
        <div id="yp-signup-form-view">
          <h2>✏️ 회원가입</h2>
          <p>가입하면 무료 체험 기간이 연장되고<br>나중에 결제도 더 쉬워요!</p>

          <div class="yp-field">
            <label>이름</label>
            <input type="text" id="yp-name" placeholder="홍길동" autocomplete="name" />
          </div>
          <div class="yp-field">
            <label>이메일</label>
            <input type="email" id="yp-email" placeholder="example@email.com" autocomplete="email" />
          </div>
          <div class="yp-field">
            <label>학년</label>
            <input type="text" id="yp-grade" placeholder="예: 중1, 고2" />
          </div>
          <div class="yp-field">
            <label>휴대폰 번호 (선택)</label>
            <input type="tel" id="yp-phone" placeholder="010-0000-0000" autocomplete="tel" />
          </div>

          <button class="yp-btn yp-btn-pay" id="yp-btn-signup">가입하기</button>
          <div class="yp-divider">이미 회원이신가요?</div>
          <button class="yp-btn yp-btn-secondary" id="yp-btn-goto-pay">💳 결제 페이지로</button>
        </div>

        <!-- 가입 완료 화면 -->
        <div id="yp-signup-done-view" class="yp-success" style="display:none">
          <div class="yp-success-icon">🎉</div>
          <h3>가입 완료!</h3>
          <p>연플래닝 수학AI 회원이 되셨어요.<br>무료 체험이 연장됩니다!</p>
          <br>
          <button class="yp-btn yp-btn-pay" id="yp-signup-done-btn">계속 공부하기</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    document.getElementById('yp-signup-close').onclick = close;
    document.getElementById('yp-btn-signup').onclick = doSignup;
    document.getElementById('yp-btn-goto-pay').onclick = () => { close(); PayModal.open(); };
    document.getElementById('yp-signup-done-btn').onclick = () => {
      close();
      // 헤더 상태 새로고침
      if (typeof window.applyHeaderState === 'function') window.applyHeaderState();
      updateBadge();
    };
  }

  async function doSignup() {
    const name  = document.getElementById('yp-name').value.trim();
    const email = document.getElementById('yp-email').value.trim();
    const grade = document.getElementById('yp-grade').value.trim();
    const phone = document.getElementById('yp-phone').value.trim();

    if (!name || !email) { alert('이름과 이메일은 필수예요!'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { alert('이메일 형식을 확인해주세요.'); return; }

    const btn = document.getElementById('yp-btn-signup');
    btn.disabled = true; btn.textContent = '가입 중...';

    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, grade, phone }),
      });
      const data = await res.json();

      if (data.ok) {
        // 로컬 저장
        localStorage.setItem('yp_name', name);
        localStorage.setItem('yp_email', email);
        localStorage.setItem('yp_signed_up', '1');
        // 가입 시 무료 기간 1주 추가
        const first = new Date(Trial.getFirstDate());
        first.setDate(first.getDate() + 7);
        localStorage.setItem('firstVisitDate', Trial._today());  // 오늘 기준 리셋

        // 앱 세션 상태 반영 (index.html의 state)
        if (window.state) {
          window.state.student = { name, grade: grade || '', code: data.code || '' };
          localStorage.setItem('yp_student', JSON.stringify(window.state.student));
          if (typeof window.applyHeaderState === 'function') window.applyHeaderState();
        }

        document.getElementById('yp-signup-form-view').style.display = 'none';
        document.getElementById('yp-signup-done-view').style.display = 'block';
        updateBadge();
      } else {
        alert(data.message || '가입 중 오류가 발생했어요.');
      }
    } catch (err) {
      console.error('[Signup Error]', err);
      alert('서버 연결에 실패했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      btn.disabled = false; btn.textContent = '가입하기';
    }
  }

  function open() { build(); overlay.classList.add('open'); }
  function close() { overlay && overlay.classList.remove('open'); }

  return { open, close };
})();

/* ─────────────── index.html 함수 오버라이드 ─────────────── */
function overrideAppFunctions() {
  // index.html의 canUseTrial을 payment-system의 로직으로 교체 (유료 회원 지원)
  window.canUseTrial = function() {
    return Trial.canSolve();
  };
  // index.html의 updateTrialBadge를 교체
  window.updateTrialBadge = function() {
    updateBadge();
  };
  // index.html의 incrementUsage를 교체 (Trial.use 사용)
  window.incrementUsage = function() {
    Trial.use();
  };
}

/* ─────────────── 결제 성공 페이지 처리 ─────────────── */
function handleSuccessPage() {
  const params = new URLSearchParams(location.search);
  const paymentKey = params.get('paymentKey');
  const orderId    = params.get('orderId');
  const amount     = params.get('amount');
  const planId     = params.get('plan');

  if (!paymentKey) return;

  // 서버에 결제 확인 요청
  fetch('/api/payment-confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentKey, orderId, amount }),
  })
  .then(r => r.json())
  .then(data => {
    if (data.ok) {
      Trial.setPaid(planId || 'basic');
      updateBadge();
      // 성공 알림 후 메인으로
      setTimeout(() => { location.href = '/'; }, 100);
    }
  })
  .catch(console.error);
}

/* ─────────────── 유틸 ─────────────── */
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

/* ─────────────── 초기화 ─────────────── */
function init() {
  // 결제 성공/실패 페이지 처리
  if (location.pathname.includes('payment-success')) { handleSuccessPage(); return; }

  // index.html 함수 오버라이드 + 배지 업데이트
  overrideAppFunctions();
  updateBadge();
}

init();

/* ─────────────── 전역 노출 (디버깅용) ─────────────── */
window.YP = { Trial, PayModal, SignupModal, updateBadge };
