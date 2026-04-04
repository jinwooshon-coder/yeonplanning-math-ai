exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const name = (body.name || '').trim();
    const code = (body.code || '').trim().toUpperCase();

    if (!name || !code) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: false, message: '이름과 코드를 입력해주세요' }),
      };
    }

    if (code === 'TEST-0000') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: true, name: name, grade: '중1', id: code, code: code, remaining: 10 }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: false, message: '테스트 코드: TEST-0000 을 입력하세요' }),
    };

  } catch (err) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: false, message: '오류: ' + err.message }),
    };
  }
};
