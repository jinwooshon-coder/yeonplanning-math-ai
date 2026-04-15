// netlify/functions/solve.js
// 수학 문제 AI 풀이 — Claude Opus 호출

// SUPUL_CLAUDE_KEY: Netlify 대시보드에 설정 (ANTHROPIC_API_KEY와 이름 충돌 방지)
const CLAUDE_API_KEY = process.env.SUPUL_CLAUDE_KEY || process.env.ANTHROPIC_API_KEY;

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
    const { text, image, images, student } = JSON.parse(event.body);

    // images 배열 또는 단일 image 정규화 (최대 4장)
    const imageList = images
      ? images.slice(0, 4)
      : image ? [image] : [];

    if (!text && imageList.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '문제 텍스트나 이미지가 필요해요' }),
      };
    }

    // 이미지 크기 체크 (장당 4MB, 전체 12MB 이하)
    const SINGLE_LIMIT = 4 * 1024 * 1024;
    const TOTAL_LIMIT  = 12 * 1024 * 1024;
    let totalSize = 0;
    for (const img of imageList) {
      if (img.length > SINGLE_LIMIT) {
        return { statusCode: 413, headers, body: JSON.stringify({ error: '이미지 한 장이 너무 큽니다. 더 작은 사진을 사용해 주세요.' }) };
      }
      totalSize += img.length;
    }
    if (totalSize > TOTAL_LIMIT) {
      return { statusCode: 413, headers, body: JSON.stringify({ error: '전체 이미지 용량이 너무 큽니다. 사진을 줄여주세요.' }) };
    }

    // ── 메시지 구성 ──
    const userContent = [];

    // 이미지 블록 추가 (최대 4장)
    for (const img of imageList) {
      const m = img.match(/^data:image\/(\w+);base64,(.+)$/);
      if (m) {
        userContent.push({
          type: 'image',
          source: { type: 'base64', media_type: `image/${m[1]}`, data: m[2] },
        });
      }
    }

    const multiPageNote = imageList.length > 1
      ? `(이미지 ${imageList.length}장이 첨부되어 있습니다. 연속된 교과서 페이지로 간주하고 문제를 파악해 주세요.)\n\n`
      : '';
    // 이미지가 있으면 text는 학생 메모, 없으면 text가 문제 본문
    let promptText;
    if (imageList.length > 0) {
      promptText = text
        ? `${multiPageNote}이미지의 수학 문제를 풀어주세요.\n\n[학생 메모] ${text}`
        : `${multiPageNote}이미지의 수학 문제를 풀어주세요.`;
    } else {
      promptText = `다음 수학 문제를 풀어주세요:\n\n${text}`;
    }
    userContent.push({ type: 'text', text: promptText });

    // ── Claude API 호출 ──
    const SYSTEM_PROMPT = `당신은 대한민국 최고의 수학 선생님입니다.
반드시 아래 JSON 형식으로만 응답하세요 (마크다운 코드블록 없이 순수 JSON).
모든 수식은 반드시 LaTeX 형식으로 작성하세요 (KaTeX 렌더링용).
인라인 수식은 $수식$ 형태, 별도 줄 수식은 $$수식$$ 형태로 작성하세요.
응답은 간결하게 핵심만 담아 주세요.

{
  "problem": "문제 전체 내용 (LaTeX 포함)",
  "answer": "최종 정답 (LaTeX 포함, 예: $x = 3$)",
  "concepts": ["핵심 개념1", "핵심 개념2"],
  "difficulty_ai": 숫자(1~5),
  "grade": "학년 (예: 중1, 고2)",
  "subject": "단원명 (예: 일차방정식)",
  "solutions": [
    {
      "label": "A",
      "title": "풀이법 이름",
      "steps": "단계별 풀이 (LaTeX 수식 포함, 핵심 단계만)"
    },
    {
      "label": "B",
      "title": "다른 풀이법",
      "steps": "단계별 풀이"
    }
  ],
  "similar": [
    { "num": 1, "question": "유사 문제 (LaTeX)", "answer": "정답 (LaTeX)" }
  ],
  "reallife": [
    { "icon": "🛒", "title": "사례 제목", "desc": "실생활 설명 (1~2문장)", "equation": "$관련 수식$" },
    { "icon": "🚕", "title": "사례 제목", "desc": "실생활 설명", "equation": "$관련 수식$" }
  ],
  "next_concept": "다음에 배울 단원 한 줄 설명"
}`;

    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
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
