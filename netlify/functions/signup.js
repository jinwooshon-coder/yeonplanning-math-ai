/**
 * /api/signup
 * 회원가입 처리 — Google Sheets 학생명단 시트에 행 추가
 *
 * Netlify 환경변수 필요:
 *   GOOGLE_SHEETS_ID
 *   GOOGLE_SERVICE_ACCOUNT_KEY
 */
const { google } = require('googleapis');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ ok: false }) };

  try {
    const { name, email, grade, phone } = JSON.parse(event.body || '{}');

    if (!name || !email) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: false, message: '이름과 이메일은 필수입니다.' }),
      };
    }

    // ── Google Sheets 연동 (환경변수 있을 때만) ──
    if (process.env.GOOGLE_SHEETS_ID && process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
      const auth = new google.auth.GoogleAuth({
        credentials: serviceAccount,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      const sheets = google.sheets({ version: 'v4', auth });

      const today = new Date().toLocaleDateString('ko-KR');
      // 자동 생성 학생 코드: YP + 랜덤 4자리
      const code = 'YP-' + Math.random().toString(36).slice(2, 6).toUpperCase();

      await sheets.spreadsheets.values.append({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: '학생명단!A:F',
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [[name, code, grade || '', email, today, '무료체험']],
        },
      });

      console.log(`[회원가입] ${name} (${email}) 등록 완료 / 코드: ${code}`);
    } else {
      // Google 없을 때는 로그만
      console.log(`[회원가입 - Sheets 미연동] ${name} / ${email} / ${grade}`);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, message: '가입이 완료됐어요!' }),
    };

  } catch (err) {
    console.error('[signup error]', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ ok: false, message: '서버 오류: ' + err.message }),
    };
  }
};
