// netlify/functions/solve.js
// 수학 문제 AI 풀이 — Claude Opus 호출

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
    const { text, image, student } = JSON.parse(event.body);

    if (!text && !image) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '문제 텍스트나 이미지가 필요해요' }),
      };
    }

    // ── 메시지 구성 ──
    const userContent = [];

    if (image) {
      // base64 이미지에서 데이터 부분만 추출
      const base64Match = image.match(/^data:image\/(\w+);base64,(.+)$/);
      if (base64Match) {
        userContent.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: `image/${base64Match[1]}`,
            data: base64Match[2],
          },
        });
      }
    }

    userContent.push({
      type: 'text',
      text: text
        ? `다음 수학 문제를 풀어주세요:\n\n${text}`
        : '이미지의 수학 문제를 풀어주세요.',
    });

    // ── Claude API 호출 ──
    const SYSTEM_PROMPT = `당신은 대한민국 최고의 수학 선생님입니다.
반드시 아래 JSON 형식으로만 응답하세요 (마크다운 코드블록 없이 순수 JSON).
모든 수식은 반드시 LaTeX 형식으로 작성하세요 (KaTeX 렌더링용).
인라인 수식은 $수식$ 형태, 별도 줄 수식은 $$수식$$ 형태로 작성하세요.

{
  "problem": "문제 전체 내용 (LaTeX 포함)",
  "answer": "최종 정답 (LaTeX 포함, 예: $x = 3$)",
  "concepts": ["핵심 개념1", "핵심 개념2", "핵심 개념3"],
  "difficulty_ai": 숫자(1~5),
  "grade": "학년 (예: 중1, 고2)",
  "subject": "단원명 (예: 일차방정식)",
  "solutions": [
    {
      "label": "A",
      "title": "풀이법 이름 (예: 이항법 활용)",
      "steps": "단계별 풀이\\n1단계: ...\\n2단계: ...\\n(각 단계에 LaTeX 수식 포함)"
    },
    {
      "label": "B",
      "title": "풀이법 이름 (다른 방법)",
      "steps": "단계별 풀이"
    },
    {
      "label": "C",
      "title": "풀이법 이름 (또 다른 방법 또는 검산)",
      "steps": "단계별 풀이"
    }
  ],
  "similar": [
    { "num": 1, "question": "유사 문제 (LaTeX)", "answer": "정답 (LaTeX)" },
    { "num": 2, "question": "유사 문제 (LaTeX)", "answer": "정답 (LaTeX)" }
  ],
  "reallife": [
    { "icon": "🛒", "title": "사례 제목", "desc": "실생활 설명 (2~3문장)", "equation": "$관련 수식$" },
    { "icon": "🚕", "title": "사례 제목", "desc": "실생활 설명", "equation": "$관련 수식$" },
    { "icon": "💊", "title": "사례 제목", "desc": "실생활 설명", "equation": "$관련 수식$" },
    { "icon": "📱", "title": "사례 제목", "desc": "실생활 설명", "equation": "$관련 수식$" }
  ],
  "next_concept": "이 개념을 배운 후 다음에 배울 단원과 연결 설명"
}`;

    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userContent }],
      }),
    });

    if (!apiRes.ok) {
      const errText = await apiRes.text();
      throw new Error(`Claude API 오류: ${apiRes.status} — ${errText}`);
    }

    const apiData = await apiRes.json();
    const rawText = apiData.content?.[0]?.text || '';

    // JSON 파싱 (여분의 텍스트가 붙어 올 수 있으므로 단계별 추출)
    let result;
    try {
      // 1차: 코드블록 제거 후 그대로 파싱
      const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      result = JSON.parse(cleaned);
    } catch {
      try {
        // 2차: 첫 번째 { ~ 마지막 } 추출
        const first = rawText.indexOf('{');
        const last = rawText.lastIndexOf('}');
        if (first !== -1 && last > first) {
          result = JSON.parse(rawText.slice(first, last + 1));
        } else {
          throw new Error('JSON 객체를 찾을 수 없음');
        }
      } catch {
        // 3차: 정규식으로 JSON 블록 추출
        const jsonMatch = rawText.match(/\{[\s\S]*"problem"[\s\S]*"solutions"[\s\S]*\}/);
        if (jsonMatch) {
          try {
            result = JSON.parse(jsonMatch[0]);
          } catch (e3) {
            console.error('[SOLVE] JSON 파싱 최종 실패. 원본 텍스트:', rawText);
            throw new Error('AI 응답 파싱 오류: ' + e3.message);
          }
        } else {
          console.error('[SOLVE] JSON 추출 불가. 원본 텍스트:', rawText);
          throw new Error('AI 응답에서 JSON을 찾을 수 없습니다');
        }
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result),
    };
  } catch (err) {
    console.error('[SOLVE ERROR]', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
