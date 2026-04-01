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
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file'
    ]
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
    const { studentId, studentName, question, answer } = JSON.parse(event.body);

    if (!studentId || !question || !answer) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: '필수 항목이 누락되었습니다.' }) };
    }

    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    const drive = google.drive({ version: 'v3', auth });

    const timestamp = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

    // 1. Google Drive에 풀이 문서 저장
    const docContent = `연플래닝 수학AI 풀이 기록\n${'='.repeat(40)}\n학생: ${studentName} (${studentId})\n일시: ${timestamp}\n\n[문제]\n${question}\n\n[풀이]\n${answer}`;

    const fileMetadata = {
      name: `수학풀이_${studentId}_${Date.now()}.txt`,
      parents: process.env.DRIVE_FOLDER_ID ? [process.env.DRIVE_FOLDER_ID] : []
    };

    const media = {
      mimeType: 'text/plain',
      body: docContent
    };

    const file = await drive.files.create({
      requestBody: fileMetadata,
      media,
      fields: 'id, webViewLink'
    });

    // 2. Google Sheets에 사용 기록 추가
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.STUDENT_SHEET_ID,
      range: '사용기록!A:F',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[
          timestamp,
          studentId,
          studentName,
          question.substring(0, 100),
          file.data.webViewLink || '',
          'completed'
        ]]
      }
    });

    // 3. 잔여 횟수 차감
    const studentRes = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.STUDENT_SHEET_ID,
      range: '학생목록!A2:E'
    });

    const rows = studentRes.data.values || [];
    const rowIndex = rows.findIndex((row) => row[0] === studentId);

    if (rowIndex >= 0) {
      const currentRemaining = parseInt(rows[rowIndex][4] || '0', 10);
      await sheets.spreadsheets.values.update({
        spreadsheetId: process.env.STUDENT_SHEET_ID,
        range: `학생목록!E${rowIndex + 2}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[Math.max(0, currentRemaining - 1)]] }
      });
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        fileLink: file.data.webViewLink || null
      })
    };
  } catch (err) {
    console.error('Save error:', err);
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: '저장 중 오류가 발생했습니다.' }) };
  }
};
