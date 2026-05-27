// HAuto Chrome Extension - Content Script (content.js)
// Responsible for page detection, UI insertion, and secure DOM scraping.

const HAUTO_UI_ID = 'hauto-assistant-panel';

// 1. Core initialization on page load
initHAutoAssistant();

// 💥 [Cross-Origin postMessage Listener]
// Bypasses Same-Origin security policies by listening to direct postMessages from parent frame.
// Reports its own frame's DOM data to background immediately upon receiving request.
window.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'REQUEST_FRAME_REPORT_VIA_POSTMESSAGE') {
    try {
      const localData = scrapeLocalFrameData();
      chrome.runtime.sendMessage({
        action: 'SUBMIT_FRAME_REPORT',
        data: localData
      });
    } catch (e) {
      console.log('HAuto 하위 프레임 실시간 보고 전송 오류:', e.message);
    }
  }
});

// Also keep standard runtime message listener as fallback
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'REQUEST_FRAME_REPORT') {
    try {
      const localData = scrapeLocalFrameData();
      chrome.runtime.sendMessage({
        action: 'SUBMIT_FRAME_REPORT',
        data: localData
      });
      sendResponse({ success: true });
    } catch (e) {
      console.log('HAuto 런타임 메시지 보고 실패:', e.message);
      sendResponse({ success: false, error: e.message });
    }
  }
  return true;
});

function initHAutoAssistant() {
  // 💥 [Parent Frame Guard] Only inject floating UI into the top-level parent frame
  if (window !== window.top) return;

  // Check if assistant is already injected
  if (document.getElementById(HAUTO_UI_ID)) return;

  // 💥 [Iframe Guard] Prevent injection on very small helper pages or menu wrappers
  const bodyText = document.body ? document.body.innerText.trim() : "";
  if (bodyText.length < 250) {
    // Retry in 1.5 seconds once content loads
    setTimeout(initHAutoAssistant, 1500);
    return;
  }

  const currentUrl = window.location.href;
  let pageType = 'unknown';

  if (currentUrl.includes('saramin.co.kr')) {
    pageType = 'saramin';
  } else if (currentUrl.includes('jobkorea.co.kr')) {
    pageType = 'jobkorea';
  } else {
    // Assume custom company system if not portal sites
    pageType = 'company';
  }

  // Inject beautiful HAuto floating panel
  injectFloatingPanel(pageType);
}

// 2. Beautiful floating panel CSS & HTML injection
function injectFloatingPanel(pageType) {
  // Add CSS for injected UI
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    #${HAUTO_UI_ID} {
      position: fixed;
      right: 20px;
      top: 50%;
      transform: translateY(-50%);
      width: 190px;
      background: linear-gradient(135deg, #151b2c 0%, #0b0f19 100%);
      border: 1px solid #2d3754;
      border-radius: 16px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
      z-index: 99999;
      font-family: 'Outfit', sans-serif;
      padding: 14px;
      color: #f1f5f9;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    #${HAUTO_UI_ID}:hover {
      border-color: #8b5cf6;
      box-shadow: 0 10px 30px rgba(139, 92, 246, 0.2);
    }
    .hauto-title {
      font-size: 13px;
      font-weight: 800;
      margin-bottom: 12px;
      text-align: center;
      background: linear-gradient(to right, #a78bfa, #60a5fa);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      border-bottom: 1px solid #2d3754;
      padding-bottom: 8px;
    }
    .hauto-btn {
      width: 100%;
      background-color: #1d243b;
      border: 1px solid #2d3754;
      color: #f1f5f9;
      padding: 8px 10px;
      font-size: 11px;
      font-weight: 600;
      border-radius: 8px;
      cursor: pointer;
      margin-bottom: 8px;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      text-align: center;
    }
    .hauto-btn:hover {
      background-color: #8b5cf6;
      border-color: #8b5cf6;
      color: #ffffff;
      transform: translateY(-1px);
    }
    .hauto-btn:active {
      transform: translateY(0);
    }
    .hauto-btn.accent {
      background: linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%);
      border: none;
    }
    .hauto-btn.accent:hover {
      opacity: 0.9;
    }
    .hauto-footer {
      font-size: 8px;
      color: #94a3b8;
      text-align: center;
      margin-top: 6px;
    }
    
    /* Result Display Modal inside target page */
    .hauto-result-modal {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 450px;
      background-color: #151b2c;
      border: 1px solid #8b5cf6;
      border-radius: 16px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.6);
      padding: 20px;
      z-index: 100000;
      color: #f1f5f9;
      font-family: inherit;
    }
    .hauto-modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #2d3754;
      padding-bottom: 10px;
      margin-bottom: 12px;
    }
    .hauto-modal-body textarea {
      width: 100%;
      height: 250px;
      background-color: #0b0f19;
      color: #f1f5f9;
      border: 1px solid #2d3754;
      border-radius: 8px;
      padding: 10px;
      font-size: 12px;
      font-family: monospace;
      resize: none;
    }
    .hauto-modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 12px;
    }
  `;
  document.head.appendChild(styleEl);

  // Create Panel Node
  const panel = document.createElement('div');
  panel.id = HAUTO_UI_ID;

  let btnHtml = `<div class="hauto-title">🚀 HAuto Assistant</div>`;

  if (pageType === 'company') {
    // Buttons for Internal Company JD Page
    btnHtml += `
      <button class="hauto-btn" id="btn-extract-jd">📋 JD 분석 키워드 추출</button>
      <button class="hauto-btn" id="btn-set-active-jd">🎯 현재 JD 타겟 지정</button>
    `;
  } else {
    // Buttons for Recruiting Portals (Saramin / JobKorea)
    btnHtml += `
      <button class="hauto-btn" id="btn-ai-match">🤖 후보자 매칭 분석 (2단)</button>
      <button class="hauto-btn" id="btn-offer-msg">✉️ 제안문 작성 (3단)</button>
      <button class="hauto-btn accent" id="btn-db-register">💾 구글시트/노션 저장</button>
      <button class="hauto-btn" id="btn-excel-download" style="background-color: #22c55e;">📊 즉시 엑셀파일 다운로드</button>
      <button class="hauto-btn" id="btn-competency">🔍 핵심역량/자소서 추출</button>
    `;
  }

  btnHtml += `<div class="hauto-footer">집 & 사무실 자동 연동 중</div>`;
  panel.innerHTML = btnHtml;
  document.body.appendChild(panel);

  // Bind actions
  bindPanelEvents(pageType);
}

// 3. Event listeners inside target pages
function bindPanelEvents(pageType) {
  if (pageType === 'company') {
    document.getElementById('btn-extract-jd').addEventListener('click', handleExtractJd);
    document.getElementById('btn-set-active-jd').addEventListener('click', handleSetActiveJd);
  } else {
    document.getElementById('btn-ai-match').addEventListener('click', handleAiMatch);
    document.getElementById('btn-offer-msg').addEventListener('click', handleOfferMsg);
    document.getElementById('btn-db-register').addEventListener('click', handleDbRegister);
    document.getElementById('btn-excel-download').addEventListener('click', handleExcelDownload);
    document.getElementById('btn-competency').addEventListener('click', handleCompetencyExtract);
  }
}

// 4. Unified Data Requester Broker (Fires postMessage to bypass Same-Origin Restrictions in real time)
function requestMergedResumeData(callback) {
  // A. Direct report from top-level parent frame itself
  try {
    const parentData = scrapeLocalFrameData();
    chrome.runtime.sendMessage({
      action: 'SUBMIT_FRAME_REPORT',
      data: parentData
    });
  } catch (e) {
    console.log('HAuto 부모 프레임 데이터 선제 보고 오류:', e.message);
  }

  // B. 💥 [Same-Origin Bypasser] Send direct postMessage broadcasting to ALL iframe elements
  const iframes = document.querySelectorAll('iframe');
  iframes.forEach((iframe) => {
    try {
      if (iframe.contentWindow) {
        iframe.contentWindow.postMessage({ action: 'REQUEST_FRAME_REPORT_VIA_POSTMESSAGE' }, '*');
      }
    } catch (e) {
      console.log('iframe postMessage 발송 오류:', e.message);
    }
  });

  // C. Query background script for consolidated result (Background holds 150ms timeout to gather)
  chrome.runtime.sendMessage({ action: 'GET_MERGED_RESUME_DATA' }, (response) => {
    if (response && response.success && response.data) {
      callback(response.data);
    } else {
      alert('이력서 데이터 실시간 수집 실패: ' + (response ? response.error : '로딩 대기 중입니다. 새로고침 후 다시 시도해 주세요.'));
    }
  });
}

// 5. Automation Action Handlers

// A. Scrape Job Description from Company System
function handleExtractJd() {
  const jdText = scrapeCompanyJd();
  if (!jdText) {
    alert('JD 내용을 화면에서 탐지하지 못했습니다. 주텍스트를 블록 설정하거나 확인해주세요.');
    return;
  }

  chrome.runtime.sendMessage({ action: 'EXTRACT_JD_KEYWORDS', text: jdText }, (response) => {
    if (response && response.success) {
      showResultModal('AI 직무 검색어 추출 결과', response.data);
    } else {
      alert('AI 검색어 추출 오류: ' + (response ? response.error : '알 수 없음'));
    }
  });
}

function handleSetActiveJd() {
  const jdText = scrapeCompanyJd();
  if (!jdText) {
    alert('JD 내용을 읽어올 수 없습니다.');
    return;
  }
  
  chrome.storage.local.set({ activeJd: jdText }, () => {
    alert('🎯 현재 화면의 JD가 매칭 분석 기준으로 정상 설정되었습니다.');
  });
}

// B. Candidate Matching Analysis (Saramin/Jobkorea)
function handleAiMatch() {
  chrome.storage.local.get(['activeJd'], (res) => {
    if (!res.activeJd) {
      alert('사내 시스템 JD 페이지에서 [현재 JD 타겟 지정]을 먼저 완료해주세요.');
      return;
    }

    requestMergedResumeData((resumeData) => {
      chrome.runtime.sendMessage({
        action: 'RUN_AI_MATCHING',
        jd: res.activeJd,
        resume: resumeData.rawText
      }, (resMatch) => {
        if (resMatch && resMatch.success) {
          showResultModal('AI 후보자 매칭 적합도 분석', resMatch.data);
        } else {
          alert('AI 매칭 분석 실패: ' + (resMatch ? resMatch.error : '키가 설정되지 않았거나 통신 장애입니다.'));
        }
      });
    });
  });
}

// C. Dynamic personalized offer letter creation
function handleOfferMsg() {
  chrome.storage.local.get(['activeJd'], (res) => {
    if (!res.activeJd) {
      alert('사내 시스템 JD 페이지에서 [현재 JD 타겟 지정]을 먼저 완료해주세요.');
      return;
    }

    requestMergedResumeData((resumeData) => {
      chrome.runtime.sendMessage({
        action: 'GENERATE_OFFER_MSG',
        jd: res.activeJd,
        resume: resumeData.rawText
      }, (resMsg) => {
        if (resMsg && resMsg.success) {
          showResultModal('AI 개인화 제안 메시지 초안', resMsg.data);
        } else {
          alert('제안문 생성 오류: ' + (resMsg ? resMsg.error : '통신 실패'));
        }
      });
    });
  });
}

// D. DB Register (Google Sheets + Notion)
function handleDbRegister() {
  requestMergedResumeData((resumeData) => {
    if (!resumeData.name || resumeData.name === "미탐지_후보자") {
      alert('후보자 프로필 필수값(이름 등)을 파싱하지 못했습니다. 화면이 완전히 렌더링된 후 다시 눌러주세요.');
      return;
    }

    // Visual state change
    const btn = document.getElementById('btn-db-register');
    const originText = btn.textContent;
    btn.textContent = '⚡ 처리 중...';
    btn.disabled = true;

    chrome.runtime.sendMessage({
      action: 'REGISTER_CANDIDATE',
      data: {
        name: resumeData.name,
        phone: resumeData.phone,
        email: resumeData.email,
        birth: resumeData.birth,
        age: resumeData.age,
        skills: resumeData.skills,
        experience: resumeData.experience,
        rawText: resumeData.rawText
      }
    }, (resReg) => {
      btn.textContent = originText;
      btn.disabled = false;
      
      if (resReg && resReg.success) {
        alert(`💾 [${resumeData.name}] 후보자 등록이 구글 스프레드시트 및 Notion DB에 완료되었습니다!`);
      } else {
        alert('DB 저장 실패: ' + (resReg ? resReg.error : '설정 정보를 확인하거나 Google Apps Script 연동을 점검하세요.'));
      }
    });
  });
}

// E. Core Competency & Cover Letter Extraction (On-Demand)
function handleCompetencyExtract() {
  chrome.storage.local.get(['activeJd'], (res) => {
    if (!res.activeJd) {
      alert('사내 시스템 JD 페이지에서 [현재 JD 타겟 지정]을 먼저 완료해주세요.');
      return;
    }

    requestMergedResumeData((resumeData) => {
      chrome.runtime.sendMessage({
        action: 'EXTRACT_COMPETENCY',
        jd: res.activeJd,
        resume: resumeData.rawText,
        coverLetter: resumeData.coverLetter
      }, (resComp) => {
        if (resComp && resComp.success) {
          showResultModal('AI 핵심역량 및 자소서 분석 요약', resComp.data);
        } else {
          alert('역량 추출 실패: ' + (resComp ? resComp.error : '오류'));
        }
      });
    });
  });
}

// 6. Intelligent Scraping Helpers (Portal Page & Company specific)

function scrapeCompanyJd() {
  // Scrapes job description main container. Fallback to selection if container is unclear.
  let text = '';
  const possibleSelectors = [
    '.jd-detail', '.jd-content', 'article', '#main-content', '.content-body', '.view-content',
    '[class*="detail"]', '[class*="content"]'
  ];

  for (let s of possibleSelectors) {
    const el = document.querySelector(s);
    if (el && el.innerText.trim().length > 100) {
      text = el.innerText.trim();
      break;
    }
  }

  if (!text) {
    // Fallback: use user selection
    text = window.getSelection().toString();
  }

  return text;
}

// 💥 [Secure Local Frame Scraper] Restricts crawling strictly to its own frame DOM. Bypasses CORS.
function scrapeLocalFrameData() {
  const rawText = document.body ? document.body.innerText : '';
  const title = document.title;
  
  let name = '';
  let phone = '';
  let email = '';
  let birth = '';
  let age = '';
  let skills = '';
  let experience = '';
  let coverLetter = '';

  // A. Name Parsing: find selectors in its own DOM
  const nameSelectors = [
    '.info_general h1', '.info_general .c_black', '.info_name', '.name', '.name-area',
    '.user_name', '.user-name', '.profile-name', 'h1', 'h2', 'h3', '.profile_name',
    '.info_general_name', '#resumeName', '[class*="Name"]', '[class*="name"]', '[class*="profile"]'
  ];
  for (let s of nameSelectors) {
    const el = document.querySelector(s);
    if (el && el.innerText.trim().length > 0 && el.innerText.trim().length <= 10) {
      const cleanName = el.innerText.replace(/[\n\t\s]/g, '').trim();
      if (cleanName.length >= 2 && cleanName.length <= 4) {
        name = cleanName;
        break;
      }
    }
  }

  // Name validation filters & blacklists (Navigation & action words excluded)
  const nameBlacklist = ["합격", "불합", "탈락", "서류", "면접", "진행", "결과", "상태", "이름", "성명", "인재", "포탈", "회원", "관리", "인재풀", "대기", "나이", "성별", "지원", "전형", "채용", "이력", "포지션", "구직", "구인", "이메일", "연락처", "전화", "컨설턴트", "이동", "단계", "목록", "닫기", "열기", "인쇄", "다운", "수정", "삭제", "저장", "취소", "등록", "전송", "확인", "지원자", "후보자"];
  const isInvalidName = (n) => !n || n.trim() === "" || n.includes('미탐지') || n.includes('후보자') || n.length < 2 || n.length > 4 || nameBlacklist.some(b => n.includes(b));

  if (isInvalidName(name)) {
    let cleanTitle = title.replace(/(이력서|사람인|잡코리아|JOBKOREA|saramin|포트폴리오|열람|보기|관리|상세|인재풀|인재|검색|후보자|목록|후|내역|다운로드|불합격|합격|서류|면접|최종|진행|상태|결과|통보|컨설턴트|[-|[\]()|:\s])/gi, '').trim();
    const krNameMatch = cleanTitle.match(/[가-힣]{2,4}/);
    if (krNameMatch && !isInvalidName(krNameMatch[0])) {
      name = krNameMatch[0];
    }
  }

  // B. Phone Contact & Email
  const phoneMatch = rawText.match(/010[-.\s]?\d{3,4}[-.\s]?\d{4}/);
  phone = phoneMatch ? phoneMatch[0] : '';

  const emailMatch = rawText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  email = emailMatch ? emailMatch[0] : '';

  // C. 💥 [Ultra-Precise Birth & Age Parser] Highly targeted Korean recruiting standard parser
  // Matches "남, 1978 (47세)", "여, 1989 (37세)", "1994 (32세)"
  const commonAgePattern = /(19|20)\d{2}\s*\(\s*(\d{2})세\s*\)/;
  const matchCommon = rawText.match(commonAgePattern);
  if (matchCommon) {
    birth = matchCommon[1] + matchCommon[0].substring(2, 4) + "년"; // e.g. "1978년"
    age = matchCommon[2] + "세"; // e.g. "47세"
  } else {
    // Fallbacks
    const ageMatch = rawText.match(/(\d{2})세/);
    if (ageMatch) {
      age = ageMatch[1] + "세";
    } else {
      const ageMatch2 = rawText.match(/\(\s*(남|여)?\s*,?\s*(\d{2})\s*\)/);
      if (ageMatch2) age = ageMatch2[2] + "세";
    }

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

  // D. Skills extraction
  const skillSelectors = ['.wrap_tag', '.list_skill', '.skill-tag', '.skills', '[class*="skill"]', '.tag_skill'];
  for (let s of skillSelectors) {
    const el = document.querySelector(s);
    if (el && el.innerText.trim().length > 2) {
      skills = el.innerText.trim();
      break;
    }
  }
  
  if (!skills || skills.length < 3) {
    const skillKeywords = ["주요 기술", "보유 기술", "핵심 기술", "스킬", "Skill", "보유기술", "전문기술", "전문 분야", "전문분야", "주요 기술스택"];
    for (let kw of skillKeywords) {
      const idx = rawText.indexOf(kw);
      if (idx !== -1) {
        skills = rawText.substring(idx, idx + 250).replace(/[\r\n\t]+/g, ' ').trim();
        break;
      }
    }
  }

  // E. Experience info
  const expSelectors = ['.career_info', '.total_career', '.career-term', '.work-exp', '[class*="career"]', '[class*="experience"]'];
  for (let s of expSelectors) {
    const el = document.querySelector(s);
    if (el && el.innerText.trim().length > 5) {
      experience = el.innerText.trim();
      break;
    }
  }

  if (!experience || experience.length < 5) {
    const expKeywords = ["경력사항", "근무경력", "경력 정보", "주요 경력", "경력 리스트", "경력", "Work Experience", "경력 정보", "주요경력"];
    for (let kw of expKeywords) {
      const idx = rawText.indexOf(kw);
      if (idx !== -1) {
        experience = rawText.substring(idx, idx + 350).replace(/[\r\n\t]+/g, ' ').trim();
        break;
      }
    }
  }

  // F. Cover letter (self-intro)
  const clSelectors = ['.self_intro', '#selfIntro', '.self_introduction', '.intro-box', '.portfolio_intro', '.introduction', '[class*="intro"]'];
  for (let s of clSelectors) {
    const el = document.querySelector(s);
    if (el && el.innerText.trim().length > 10) {
      coverLetter = el.innerText.trim();
      break;
    }
  }

  return { name, phone, email, birth, age, skills, experience, coverLetter, rawText, title };
}

// 7. Generic Premium Result Modal Helper inside target page
function showResultModal(title, content) {
  const oldModal = document.querySelector('.hauto-result-modal');
  if (oldModal) oldModal.remove();

  const modal = document.createElement('div');
  modal.className = 'hauto-result-modal';
  
  modal.innerHTML = `
    <div class="hauto-modal-header">
      <h3 style="font-size:14px; font-weight:700; margin:0;">${title}</h3>
      <button class="hauto-modal-close" style="background:none; border:none; color:#94a3b8; font-size:18px; cursor:pointer;">&times;</button>
    </div>
    <div class="hauto-modal-body">
      <textarea readonly>${content}</textarea>
    </div>
    <div class="hauto-modal-footer">
      <button class="hauto-modal-copy-btn" style="background-color:#8b5cf6; border:none; color:#fff; font-size:11px; font-weight:600; padding:8px 14px; border-radius:8px; cursor:pointer;">복사하기</button>
      <button class="hauto-modal-close-btn" style="background-color:#1d243b; border:1px solid #2d3754; color:#f1f5f9; font-size:11px; font-weight:600; padding:8px 14px; border-radius:8px; cursor:pointer;">닫기</button>
    </div>
  `;

  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.querySelector('.hauto-modal-close').addEventListener('click', close);
  modal.querySelector('.hauto-modal-close-btn').addEventListener('click', close);

  modal.querySelector('.hauto-modal-copy-btn').addEventListener('click', () => {
    const textarea = modal.querySelector('textarea');
    navigator.clipboard.writeText(textarea.value).then(() => {
      const copyBtn = modal.querySelector('.hauto-modal-copy-btn');
      copyBtn.textContent = '복사 완료!';
      copyBtn.style.backgroundColor = '#10B981';
      setTimeout(() => {
        copyBtn.textContent = '복사하기';
        copyBtn.style.backgroundColor = '#8b5cf6';
      }, 1500);
    });
  });
}

// 8. Instant Local Excel (CSV) Download Handler
function handleExcelDownload() {
  requestMergedResumeData((resumeData) => {
    if (!resumeData.name || resumeData.name === "미탐지_후보자") {
      alert('후보자 정보를 화면에서 파싱하지 못했습니다. 채용 포탈의 이력서 보기 화면이 맞는지 확인해 주세요.');
      return;
    }

    // Create CSV Content with BOM (prevents Korean character corruption in MS Excel)
    const headers = ["등록일", "이름", "연락처", "이메일", "생년월일", "나이", "주요 기술", "경력 정보", "진행상태", "상태 변경일", "비고"];
    const dateStr = new Date().toLocaleDateString('ko-KR');
    
    const clean = (val) => {
      if (!val) return "";
      return `"${val.replace(/"/g, '""').replace(/[\r\n\t]/g, ' ')}"`;
    };

    const row = [
      clean(dateStr),
      clean(resumeData.name),
      clean(resumeData.phone),
      clean(resumeData.email),
      clean(resumeData.birth), 
      clean(resumeData.age),   
      clean(resumeData.skills),
      clean(resumeData.experience),
      clean("제안 수락 대기"),
      clean(dateStr), 
      clean("") 
    ];

    const csvContent = "\ufeff" + headers.join(",") + "\n" + row.join(",");
    
    try {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `HAuto_후보자_${resumeData.name.replace(/[\s/]/g, '_')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('엑셀 다운로드 실패: ' + err.message);
    }
  });
}
