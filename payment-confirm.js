/**
 * /api/payment-confirm
 * 토스페이먼츠 결제 최종 승인 (서버에서 처리 — API 키 안전 보관)
 *
 * Netlify 환경변수에 추가 필요:
 *   TOSS_SECRET_KEY = test_sk_여기에_시크릿키
 */
exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ ok: false, message: 'Method Not Allowed' }) };

  try {
    const { paymentKey, orderId, amount } = JSON.parse(event.body || '{}');

    if (!paymentKey || !orderId || !amount) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ ok: false, message: '필수 파라미터가 없습니다.' }),
      };
    }

    const secretKey = process.env.TOSS_SECRET_KEY;
    if (!secretKey) {
      console.error('[payment-confirm] TOSS_SECRET_KEY 환경변수가 없습니다.');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ ok: false, message: '서버 설정 오류' }),
      };
    }

    // 토스페이먼츠 결제 승인 API 호출
    const authHeader = 'Basic ' + Buffer.from(secretKey + ':').toString('base64');
    const tossRes = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ paymentKey, orderId, amount: parseInt(amount, 10) }),
    });

    const tossData = await tossRes.json();

    if (!tossRes.ok) {
      console.error('[Toss Error]', tossData);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: false, message: tossData.message || '결제 승인 실패' }),
      };
    }

    // 결제 성공 — Google Sheets에 기록 (선택)
    // await recordPaymentToSheets(tossData);

    console.log('[결제 성공]', {
      orderId: tossData.orderId,
      amount: tossData.totalAmount,
      method: tossData.method,
      customerName: tossData.customerName,
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        orderId: tossData.orderId,
        amount: tossData.totalAmount,
        method: tossData.method,
      }),
    };

  } catch (err) {
    console.error('[payment-confirm error]', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ ok: false, message: '서버 오류: ' + err.message }),
    };
  }
};
