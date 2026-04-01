const { google } = require('googleapis');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
  });
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { studentId, password } = JSON.parse(event.body);

    if (!studentId || !password) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: '학번과 비밀번호를 입력하세요.' }) };
    }

    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // 스프레드시트에서 학생 목록 조회 (A: 학번, B: 비밀번호, C: 이름, D: 학년, E: 잔여횟수)
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.STUDENT_SHEET_ID,
      range: '학생목록!A2:E'
    });

    const rows = res.data.values || [];
    const student = rows.find((row) => row[0] === studentId && row[1] === password);

    if (!student) {
      return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: '학번 또는 비밀번호가 올바르지 않습니다.' }) };
    }

    const remaining = parseInt(student[4] || '0', 10);
    if (remaining <= 0) {
      return { statusCode: 403, headers: CORS_HEADERS, body: JSON.stringify({ error: '사용 가능 횟수가 모두 소진되었습니다.' }) };
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        student: {
          id: student[0],
          name: student[2],
          grade: student[3],
          remaining
        }
      })
    };
  } catch (err) {
    console.error('Auth error:', err);
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: '서버 오류가 발생했습니다.' }) };
  }
};
