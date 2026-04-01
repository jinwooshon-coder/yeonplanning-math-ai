const Anthropic = require('@anthropic-ai/sdk');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

const SYSTEM_PROMPT = `당신은 연플래닝 수학AI 튜터입니다. 중·고등학교 수학 문제를 단계별로 풀어주세요.

규칙:
1. 문제를 정확히 파악하고 풀이 방향을 먼저 제시합니다.
2. 단계별로 풀이 과정을 상세히 설명합니다.
3. 수식은 LaTeX 형식($...$, $$...$$)으로 작성합니다.
4. 최종 답을 명확하게 표시합니다.
5. 관련 개념이나 공식을 간단히 정리해줍니다.
6. 학생이 이해하기 쉽도록 친절하게 설명합니다.`;

console.log('ENV CHECK:', {
  hasApiKey: !!process.env.ANTHROPIC_API_KEY,
  apiKeyPrefix: process.env.ANTHROPIC_API_KEY?.substring(0, 10)
});

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { question, imageBase64, studentId } = JSON.parse(event.body);

    if (!question && !imageBase64) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: '문제를 입력하거나 이미지를 첨부하세요.' }) };
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // 메시지 내용 구성
    const content = [];

    if (imageBase64) {
      const match = imageBase64.match(/^data:(image\/\w+);base64,(.+)$/);
      if (match) {
        content.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: match[1],
            data: match[2]
          }
        });
      }
    }

    content.push({
      type: 'text',
      text: question || '이 수학 문제를 풀어주세요.'
    });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content }]
    });

    const answer = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        answer,
        usage: {
          input_tokens: response.usage.input_tokens,
          output_tokens: response.usage.output_tokens
        }
      })
    };
  } catch (err) {
    console.error('Solve error message:', err.message);
    console.error('Solve error status:', err.status);
    console.error('Solve error body:', JSON.stringify(err.error));
    console.error('Solve error full:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
    console.log('SYSTEM_PROMPT length:', SYSTEM_PROMPT.length);
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: '풀이 중 오류가 발생했습니다.' }) };
  }
};
