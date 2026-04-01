const { google } = require('googleapis');

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID;

const SHEETS_CONFIG = [
  {
    title: '학생명단',
    headers: ['학생명', '학생코드', '학년', '이메일', '등록일', '상태'],
  },
  {
    title: '풀이기록',
    headers: ['날짜', '학생명', '문제내용', '정답', '단원', '학년', '난이도', '풀이A', '풀이B', '풀이C', 'Drive링크', '오답여부'],
  },
  {
    title: '진도현황',
    headers: ['학생명', '학년', '단원명', '학교상태', '학원상태', '최종수정일'],
  },
  {
    title: '평가기록',
    headers: ['날짜', '학생명', '단원', '종합완성도%', '개념이해%', '계산정확도%', '응용능력%', 'AI처방', 'Drive링크'],
  },
];

async function getAuth() {
  const key = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
  const auth = new google.auth.GoogleAuth({
    credentials: key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return auth;
}

async function setup() {
  const auth = await getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  // 1) 기존 시트 목록 조회
  const { data: spreadsheet } = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
  });
  const existingSheets = spreadsheet.sheets.map(s => s.properties.title);
  console.log('기존 시트:', existingSheets);

  // 2) 필요한 시트 추가 (없는 것만)
  const requests = [];
  for (const cfg of SHEETS_CONFIG) {
    if (!existingSheets.includes(cfg.title)) {
      requests.push({
        addSheet: { properties: { title: cfg.title } },
      });
    }
  }
  if (requests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests },
    });
    console.log('시트 생성:', requests.map(r => r.addSheet.properties.title));
  }

  // 3) 각 시트 1행에 헤더 입력
  const valueData = SHEETS_CONFIG.map(cfg => ({
    range: `${cfg.title}!A1`,
    values: [cfg.headers],
  }));

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      valueInputOption: 'RAW',
      data: valueData,
    },
  });

  console.log('헤더 입력 완료:');
  for (const cfg of SHEETS_CONFIG) {
    console.log(`  [${cfg.title}] ${cfg.headers.join(', ')}`);
  }
}

setup().catch(err => {
  console.error('오류 발생:', err.message);
  process.exit(1);
});
