# 수풀AI

## 🚀 로컬 개발 시작하기

### 1단계 — 이 폴더를 VS Code로 열기
```
파일 > 폴더 열기 > supulai 폴더 선택
```

### 2단계 — 패키지 설치
VS Code 터미널 열기 (Ctrl+` 또는 보기 > 터미널)
```bash
npm install
```

### 3단계 — Netlify CLI 설치 (처음 한 번만)
```bash
npm install -g netlify-cli
```

### 4단계 — .env 파일 만들기
```bash
cp .env.example .env
```
`.env` 파일을 열어서 실제 API 키 입력:
- `ANTHROPIC_API_KEY` : Claude API 키
- 나머지는 Google 연동 후 입력

### 5단계 — 로컬 서버 시작
```bash
npm run dev
# 또는
netlify dev
```
브라우저에서 http://localhost:8888 접속!

---

## 🧪 Google 없이 테스트 (개발 초기)

`.env`에 `ANTHROPIC_API_KEY`만 있어도 작동해요:
- 로그인: 이름 아무거나 + 코드 `TEST-0000`
- 풀이: Claude API로 실제 작동
- 저장: 콘솔 로그만 출력 (Google 연동 없이)

---

## 📤 Netlify 배포 (완성 후)

```bash
# GitHub에 올리기
git init
git add .
git commit -m "초기 커밋"
git remote add origin https://github.com/계정/supulai.git
git push -u origin main
```
Netlify에서 GitHub 저장소 연결하면 자동 배포!

---

## 📁 폴더 구조

```
supulai/
├── public/
│   ├── index.html      ← 메인 앱 (여기서 UI 수정)
│   ├── manifest.json   ← PWA 설정
│   └── sw.js           ← 서비스워커 (오프라인)
├── netlify/
│   └── functions/
│       ├── auth.js     ← 학생 로그인
│       ├── solve.js    ← AI 수학 풀이
│       └── save.js     ← Drive/Sheets 저장
├── .env.example        ← 환경변수 예시
├── .env                ← 실제 키 (git에 올리지 말 것!)
├── .gitignore
├── netlify.toml
└── package.json
```

## ⚠️ 주의사항

- `.env` 파일은 절대 GitHub에 올리지 마세요! (gitignore에 포함됨)
- API 키는 Netlify 대시보드 > Site settings > Environment variables에 별도 입력
