// HAuto Chrome Extension - Background Service Worker (background.js)
// Handles heavy API transactions, secure cross-origin requests, and cloud integrations.

// Default Prompts (Mirroring popup.js for fallback in service worker)
const DEFAULT_PROMPTS = {
  step1: `[고객사 채용 JD]:\n{{JD}}\n\n위 채용 직무 기술서를 분석하여, 사람인과 잡코리아 등 채용 플랫폼에서 후보자를 검색하기에 가장 최적화된 핵심 기술스택 단어 및 직무 검색어 조합 3가지를 쉼표(,)로 구분하여 추천해줘. 반드시 사실에 기반하고 과장되지 않게 단어로만 작성해줘.`,
  
  step2: `[고객사 채용 JD]:\n{{JD}}\n\n[후보자 이력서]:\n{{이력서}}\n\n위 두 자료를 면밀히 대조 분석하여:\n1. 두 자료의 매칭 적합도 점수(1~100)를 매겨줘.\n2. 후보자의 강점 및 적합한 사유를 3줄 내외로 요약해줘.\n3. 부족한 기술이나 아쉬운 점을 1줄로 지적해줘.\n*경고*: 절대 이력서에 명시되어 있지 않은 가상의 경력이나 기술을 상상하여 지어내지 말 것. 100% 사실에만 기반해야 함.`,
  
  step3: `[고객사 채용 JD]:\n{{JD}}\n\n[후보자 이력서]:\n{{이력서}}\n\n위 후보자에게 헤드헌터로서 이 채용 포지션을 제안하는 맞춤형 제안 메시지 초안을 정중하고 매력적인 톤앤매너로 작성해줘. 후보자의 이력서에 기재된 강점/프로젝트 경험을 JD와 구체적으로 엮어서 설명해줘.\n*경고*: 후보자가 자소서/이력서에 쓰지 않은 허위 경력이나 포부를 문맥상 지어내어 기술하지 말 것.`,
  
  step6: `[후보자 이력서 원본]:\n{{이력서}}\n\n위 이력서의 어수선한 텍스트에서 학력 사항, 주요 경력 기간 및 담당 업무, 보유 핵심 기술만 추출하여 완벽하게 정돈된 아래의 표준 서식 템플릿으로 구조화해줘.\n\n[표준 템플릿]\n■ 학력: (학교명, 전공, 학위)\n■ 총 경력연수: (N년 N개월)\n■ 주요 경력 리스트:\n  - 회사명 (재직기간) / 직급\n  - 주요 수행 프로젝트 및 담당 역할 (원문 팩트 기반)\n■ 보유 스킬셋: (핵심 기술스택 단어 목록)`,
  
  competency: `[고객사 채용 JD]:\n{{JD}}\n\n[후보자 이력서]:\n{{이력서}}\n\n[후보자 자기소개서]:\n{{자소서}}\n\n위의 자료를 종합하여, 아래의 양식에 맞추어 후보자의 핵심역량과 자소서 핵심 포인트를 추출해줘. 양식을 정확히 준수하고, 절대 원문에 기재되지 않은 허위 사실이나 과장된 능력을 지어내지 말 것.\n\n[추출 양식]\n1. JD 매칭 핵심역량 요약 (경력 및 프로젝트 기반 3가지):\n2. 자기소개서 기반 지원동기 요약 (3줄 이내):\n3. 입사 후 포부 핵심 정제 (3줄 이내):`
};

// Global memory to store multi-frame scraping data per tab
const tabFramesData = {};

// Clean up memory on tab close or reload
chrome.tabs.onRemoved.addListener((tabId) => {
  delete tabFramesData[tabId];
});
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading' || changeInfo.url) {
    delete tabFramesData[tabId];
  }
});

// Listen to message routing from Content Scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'SUBMIT_FRAME_REPORT') {
    const tabId = sender.tab?.id;
    const frameId = sender.frameId !== undefined ? sender.frameId : (sender.url || 'default');
    if (tabId !== undefined) {
      tabFramesData[tabId] = tabFramesData[tabId] || {};
      tabFramesData[tabId][frameId] = message.data;
    }
    sendResponse({ success: true });
    return true;
  }

  if (message.action === 'RESET_TAB_DATA') {
    const tabId = sender.tab?.id;
    if (tabId !== undefined) {
      tabFramesData[tabId] = {};
    }
    sendResponse({ success: true });
    return true;
  }

  if (message.action === 'GET_MERGED_RESUME_DATA') {
    const tabId = sender.tab?.id;
    if (tabId !== undefined) {
      const reports = Object.values(tabFramesData[tabId] || {});
      if (reports.length > 0) {
        const merged = mergeResumeData(reports);
        sendResponse({ success: true, data: merged });
      } else {
        sendResponse({ success: false, error: '이력서 영역의 프레임 데이터를 수집하지 못했습니다. 화면을 한 번 클릭한 뒤 다시 시도해 주세요.' });
      }
    } else {
      sendResponse({ success: false, error: '활성화된 탭 정보를 찾을 수 없습니다.' });
    }
    return true;
  }

  if (message.action === 'EXTRACT_JD_KEYWORDS') {
    callGeminiApi('step1', { JD: message.text })
      .then(result => sendResponse({ success: true, data: result }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // Keep message channel open for async response
  }

  if (message.action === 'RUN_AI_MATCHING') {
    callGeminiApi('step2', { JD: message.jd, 이력서: message.resume })
      .then(result => sendResponse({ success: true, data: result }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.action === 'GENERATE_OFFER_MSG') {
    callGeminiApi('step3', { JD: message.jd, 이력서: message.resume })
      .then(result => sendResponse({ success: true, data: result }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.action === 'EXTRACT_COMPETENCY') {
    callGeminiApi('competency', { JD: message.jd, 이력서: message.resume, 자소서: message.coverLetter || '자기소개서 없음' })
      .then(result => sendResponse({ success: true, data: result }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.action === 'REGISTER_CANDIDATE') {
    registerCandidateCloud(message.data)
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

// 1. Generic Gemini API call broker
async function callGeminiApi(feature, params) {
  // Retrieve settings
  const settings = await chrome.storage.local.get(['geminiKey', `prompt_${feature}`]);
  const apiKey = settings.geminiKey;
  
  if (!apiKey) {
    throw new Error('HAuto 설정 창에서 [Gemini API Key]를 먼저 등록해 주세요.');
  }

  // Load either custom prompt or system default
  let promptTemplate = settings[`prompt_${feature}`] || DEFAULT_PROMPTS[feature];

  // Dynamic variable substitution
  for (let key in params) {
    const value = params[key] || '';
    // Replace all occurrences of {{key}}
    promptTemplate = promptTemplate.split(`{{${key}}}`).join(value);
  }

  // API Call to Gemini (1.5 Flash - fast and cost-effective)
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: promptTemplate }]
      }]
    })
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || `Gemini API 호출 실패 (Status: ${response.status})`);
  }

  const resJson = await response.json();
  const rawResponseText = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!rawResponseText) {
    throw new Error('AI 응답 데이터를 파싱하지 못했습니다.');
  }

  return rawResponseText.trim();
}

// 2. Cloud DB Registration (Google Sheets GAS & Notion API)
async function registerCandidateCloud(candidate) {
  const settings = await chrome.storage.local.get(['sheetUrl', 'notionToken', 'notionDbId']);
  
  const errors = [];

  // A. Save to Google Sheets via GAS Web App
  if (settings.sheetUrl) {
    try {
      await saveToGoogleSheets(settings.sheetUrl, candidate);
    } catch (e) {
      errors.push(`Google Sheets: ${e.message}`);
    }
  }

  // B. Save to Notion Database Page
  if (settings.notionToken && settings.notionDbId) {
    try {
      await saveToNotion(settings.notionToken, settings.notionDbId, candidate);
    } catch (e) {
      errors.push(`Notion DB: ${e.message}`);
    }
  }

  if (errors.length > 0 && (!settings.sheetUrl && !settings.notionToken)) {
    throw new Error('구글 시트 주소 또는 Notion API 토큰이 전혀 등록되어 있지 않습니다.');
  }

  if (errors.length > 0) {
    throw new Error(errors.join(' / '));
  }

  return true;
}

// Save to Google Sheets
async function saveToGoogleSheets(gasUrl, candidate) {
  // If the URL is just a sheet web editor URL, prompt users to use GAS Web App URL
  if (gasUrl.includes('docs.google.com/spreadsheets')) {
    throw new Error('Google Sheets URL은 시트 편집용 주소가 아닌, Google Apps Script 배포된 [웹 앱 URL]이어야 실시간 기록이 가능합니다. (README 참조)');
  }

  const response = await fetch(gasUrl, {
    method: 'POST',
    mode: 'no-cors', // Standard bypass for Google Web App CORS issues
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: candidate.name,
      phone: candidate.phone,
      email: candidate.email,
      skills: candidate.skills,
      experience: candidate.experience,
      date: new Date().toLocaleDateString('ko-KR')
    })
  });

  // Note: no-cors mode returns opaque response, so we assume success if no fetch crash occurs
  return true;
}

// Save to Notion Page
async function saveToNotion(token, databaseId, candidate) {
  const notionUrl = 'https://api.notion.com/v1/pages';

  const payload = {
    parent: { database_id: databaseId },
    properties: {
      "이름": {
        title: [
          { text: { content: candidate.name } }
        ]
      },
      "연락처": {
        rich_text: [
          { text: { content: candidate.phone || "" } }
        ]
      },
      "이메일": {
        email: candidate.email || null
      },
      "보유 기술": {
        rich_text: [
          { text: { content: candidate.skills || "" } }
        ]
      },
      "경력사항": {
        rich_text: [
          { text: { content: candidate.experience || "" } }
        ]
      },
      "진행상태": {
        select: { name: "제안 수락 대기" }
      },
      "등록일": {
        date: { start: new Date().toISOString().split('T')[0] }
      },
      "상태 변경일": {
        date: null // 최초 등록 시에는 비어있고, 상태 변경 시 채워짐
      },
      "비고": {
        rich_text: [] // 사용자가 직접 노션에서 입력하도록 공란 세팅
      },
      "생년월일": {
        rich_text: [
          { text: { content: candidate.birth || "" } }
        ]
      },
      "나이": {
        rich_text: [
          { text: { content: candidate.age || "" } }
        ]
      }
    },
    children: [
      {
        object: "block",
        type: "heading_2",
        heading_2: {
          rich_text: [{ text: { content: "📄 후보자 이력 요약본" } }]
        }
      },
      {
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [{ text: { content: candidate.rawText.substring(0, 1000) + "... (이하 생략)" } }]
        }
      }
    ]
  };

  const response = await fetch(notionUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Notion API 오류 (Status: ${response.status}) - ${errText.substring(0, 100)}`);
  }

  return true;
}

// 3. Multi-frame candidate data merger (Bypasses same-origin restrictions by merging properties)
function mergeResumeData(framesArray) {
  let name = '';
  let phone = '';
  let email = '';
  let birth = '';
  let age = '';
  let skills = '';
  let experience = '';
  let coverLetter = '';
  let rawText = '';

  const nameBlacklist = ["합격", "불합", "탈락", "서류", "면접", "진행", "결과", "상태", "이름", "성명", "인재", "포탈", "회원", "관리", "인재풀", "대기", "나이", "성별", "지원", "전형", "채용", "이력", "포지션", "구직", "구인", "이메일", "연락처", "전화", "컨설턴트", "이동", "단계", "목록", "닫기", "열기", "인쇄", "다운", "수정", "삭제", "저장", "취소", "등록", "전송", "확인", "지원자", "후보자"];
  const isInvalidName = (n) => !n || n.trim() === "" || n.includes('미탐지') || n.includes('후보자') || n.length < 2 || n.length > 4 || nameBlacklist.some(b => n.includes(b));

  // 1. Combine rawText from all frames
  rawText = framesArray.map(f => f.rawText || '').join('\n\n');

  // 2. Merge Name: find the first valid non-blacklist name
  for (let f of framesArray) {
    if (f.name && !isInvalidName(f.name)) {
      name = f.name.trim();
      break;
    }
  }

  // Title reverse tracking fallback
  if (isInvalidName(name)) {
    for (let f of framesArray) {
      if (f.title) {
        let cleanTitle = f.title.replace(/(이력서|사람인|잡코리아|JOBKOREA|saramin|포트폴리오|열람|보기|관리|상세|인재풀|인재|검색|후보자|목록|후|내역|다운로드|불합격|합격|서류|면접|최종|진행|상태|결과|통보|컨설턴트|[-|[\]()|:\s])/gi, '').trim();
        const krNameMatch = cleanTitle.match(/[가-힣]{2,4}/);
        if (krNameMatch && !isInvalidName(krNameMatch[0])) {
          name = krNameMatch[0];
          break;
        }
      }
    }
  }

  // Regex patterns reverse tracking fallback
  if (isInvalidName(name)) {
    const namePattern = /(이름|성명)\s*[:\s]\s*([가-힣*]{2,4})/i;
    const matchA = rawText.match(namePattern);
    if (matchA && matchA[2] && !isInvalidName(matchA[2])) {
      name = matchA[2].trim();
    }
  }
  if (isInvalidName(name)) {
    const agePattern = /([가-힣*]{2,4})\s*\(\s*(남|여)?\s*,?\s*\d{2}세?\s*\)/;
    const matchB = rawText.match(agePattern);
    if (matchB && matchB[1] && !isInvalidName(matchB[1])) {
      name = matchB[1].trim();
    }
  }
  if (isInvalidName(name)) {
    const birthPattern = /([가-힣*]{2,4})\s*(\/)?\s*\d{2,4}년생/;
    const matchC = rawText.match(birthPattern);
    if (matchC && matchC[1] && !isInvalidName(matchC[1])) {
      name = matchC[1].trim();
    }
  }
  if (isInvalidName(name)) {
    const phoneIndex = rawText.indexOf("010");
    if (phoneIndex !== -1) {
      const nearText = rawText.substring(Math.max(0, phoneIndex - 100), phoneIndex);
      const nearKrMatch = nearText.match(/[가-힣]{2,4}/g);
      if (nearKrMatch && nearKrMatch.length > 0) {
        for (let i = nearKrMatch.length - 1; i >= 0; i--) {
          const possibleName = nearKrMatch[i];
          if (!isInvalidName(possibleName)) {
            name = possibleName;
            break;
          }
        }
      }
    }
  }

  if (isInvalidName(name)) {
    name = "미탐지_후보자";
  }

  // 3. Merge Phone Contact
  for (let f of framesArray) {
    if (f.phone && f.phone.trim().length > 0) {
      phone = f.phone.trim();
      break;
    }
  }
  if (!phone) {
    const phoneMatch = rawText.match(/010[-.\s]?\d{3,4}[-.\s]?\d{4}/);
    phone = phoneMatch ? phoneMatch[0] : '';
  }

  // 4. Merge Email
  for (let f of framesArray) {
    if (f.email && f.email.trim().length > 0) {
      email = f.email.trim();
      break;
    }
  }
  if (!email) {
    const emailMatch = rawText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    email = emailMatch ? emailMatch[0] : '';
  }

  // 5. Merge Birth Date
  for (let f of framesArray) {
    if (f.birth && f.birth.trim().length > 0 && !f.birth.includes('미표시') && f.birth !== '미탐지') {
      birth = f.birth.trim();
      break;
    }
  }
  if (!birth || birth === '미탐지') {
    const birthMatchSpecial = rawText.match(/(\d{4})\s*\(\s*\d{2}세/);
    if (birthMatchSpecial) {
      birth = birthMatchSpecial[1] + "년";
    } else {
      const birthMatch = rawText.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
      if (birthMatch) {
        birth = `${birthMatch[1]}.${birthMatch[2].padStart(2, '0')}.${birthMatch[3].padStart(2, '0')}`;
      } else {
        const birthMatch2 = rawText.match(/(19|20)\d{2}[.-]\d{2}[.-]\d{2}/);
        if (birthMatch2) {
          birth = birthMatch2[0].replace(/-/g, '.');
        } else {
          const birthMatch3 = rawText.match(/(\d{2,4})년생/);
          if (birthMatch3) birth = birthMatch3[1] + "년생";
        }
      }
    }
  }

  // 6. Merge Age
  for (let f of framesArray) {
    if (f.age && f.age.trim().length > 0 && !f.age.includes('미표시') && f.age !== '미탐지') {
      age = f.age.trim();
      break;
    }
  }
  if (!age || age === '미탐지') {
    const ageMatch = rawText.match(/(\d{2})세/);
    if (ageMatch) {
      age = ageMatch[1] + "세";
    } else {
      const ageMatch2 = rawText.match(/\(\s*(남|여)?\s*,?\s*(\d{2})\s*\)/);
      if (ageMatch2) age = ageMatch2[2] + "세";
    }
  }

  // 7. Merge Skills & Work Experience
  let maxSkillLen = -1;
  for (let f of framesArray) {
    const s = f.skills || '';
    if (s.length > maxSkillLen && !s.includes('미표시') && !s.includes('미탐지')) {
      skills = s;
      maxSkillLen = s.length;
    }
  }
  if (!skills) skills = "화면 내 기술스택 미표시 (상세내용 참고)";

  let maxExpLen = -1;
  for (let f of framesArray) {
    const e = f.experience || '';
    if (e.length > maxExpLen && !e.includes('미표시') && !e.includes('미탐지')) {
      experience = e;
      maxExpLen = e.length;
    }
  }
  if (!experience) experience = "화면 내 경력정보 미표시 (상세내용 참고)";

  // 8. Merge Cover Letter
  let maxClLen = -1;
  for (let f of framesArray) {
    const c = f.coverLetter || '';
    if (c.length > maxClLen && !c.includes('미탐지')) {
      coverLetter = c;
      maxClLen = c.length;
    }
  }

  return { name, phone, email, birth, age, skills, experience, coverLetter, rawText };
}
