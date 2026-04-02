// netlify/functions/save.js
// 풀이 결과를 Google Drive + Google Sheets에 저장

const { google } = require('googleapis');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { student, problem, result, selfLevel, elapsedSec } = JSON.parse(event.body);

    // ── 개발 모드: Google 미연결이면 로그만 ──
    if (!process.env.GOOGLE_SHEETS_ID) {
      console.log('[SAVE] 개발모드 — 저장 데이터:', {
        student: student?.name,
        subject: result?.subject,
        difficulty: result?.difficulty_ai,
        selfLevel,
        elapsedSec,
      });
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: true, mode: 'dev', message: '개발모드: 로컬 저장됨' }),
      };
    }

    // ── Google 인증 ──
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive',
      ],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const drive = google.drive({ version: 'v3', auth });

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const displayDate = now.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

    let driveLink = '';

    // ── 1. Drive에 이미지 저장 (이미지가 있는 경우) ──
    // 학생 폴더 찾기 또는 생성은 생략 (실제 구현시 추가)
    // 여기서는 Sheets 기록만

    // ── 2. Google Sheets 풀이기록 행 추가 ──
    const row = [
      displayDate,                          // 날짜
      student?.name || '',                  // 학생명
      result?.problem || problem || '',     // 문제내용
      result?.answer || '',                 // 정답
      result?.subject || '',               // 단원
      result?.grade || student?.grade || '',// 학년
      result?.difficulty_ai || '',          // 난이도(AI)
      selfLevel || '',                      // 난이도(자가평가)
      elapsedSec || '',                     // 풀이 시간(초)
      result?.solutions?.[0]?.steps || '', // 풀이A
      result?.solutions?.[1]?.steps || '', // 풀이B
      result?.solutions?.[2]?.steps || '', // 풀이C
      driveLink,                            // Drive링크
      '',                                   // 오답여부 (선생님 입력)
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: '풀이기록!A:N',
      valueInputOption: 'USER_ENTERED',
      resource: { values: [row] },
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, driveLink }),
    };
  } catch (err) {
    console.error('[SAVE ERROR]', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ ok: false, error: err.message }),
    };
  }
};
