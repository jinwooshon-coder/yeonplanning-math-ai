const { google } = require('googleapis');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
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
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: '이름과 학생 코드를 입력하세요.' }) };
    }

    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // 학생명단 시트 조회 (A:학생명, B:학생코드, C:학년, D:이메일, E:등록일, F:상태)
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: '학생명단!A2:F'
    });

    const rows = res.data.values || [];
    const student = rows.find((row) => row[0] === studentId && row[1] === password);

    if (!student) {
      return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: '이름 또는 학생 코드가 올바르지 않습니다.' }) };
    }

    if (student[5] !== '활성') {
      return { statusCode: 403, headers: CORS_HEADERS, body: JSON.stringify({ error: '비활성 상태의 계정입니다.' }) };
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        student: {
          name: student[0],
          code: student[1],
          grade: student[2],
          email: student[3]
        }
      })
    };
  } catch (err) {
    console.error('Auth error:', err);
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: '서버 오류가 발생했습니다.' }) };
  }
};
