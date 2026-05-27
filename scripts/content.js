// HAuto Chrome Extension - Content Script (content.js)
// Responsible for page detection, UI insertion, and secure DOM scraping.

const HAUTO_UI_ID = 'hauto-assistant-panel';

// 1. Core initialization on page load
initHAutoAssistant();

function initHAutoAssistant() {
  // Check if assistant is already injected
  if (document.getElementById(HAUTO_UI_ID)) return;

  // 💥 [Iframe 가드] 텍스트가 너무 적은 로딩 창이나 메뉴판 껍데기 프레임에는 주입 차단
  const bodyText = document.body ? document.body.innerText.trim() : "";
  if (bodyText.length < 250) {
    // 텍스트가 채워질 때까지 1.5초마다 지연 재검사
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

// 4. Automation Action Handlers

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

    const resumeData = scrapeResumeData();
    chrome.runtime.sendMessage({
      action: 'RUN_AI_MATCHING',
      jd: res.activeJd,
      resume: resumeData.rawText
    }, (response) => {
      if (response && response.success) {
        showResultModal('AI 후보자 매칭 적합도 분석', response.data);
      } else {
        alert('AI 매칭 분석 실패: ' + (response ? response.error : '키가 설정되지 않았거나 통신 장애입니다.'));
      }
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

    const resumeData = scrapeResumeData();
    chrome.runtime.sendMessage({
      action: 'GENERATE_OFFER_MSG',
      jd: res.activeJd,
      resume: resumeData.rawText
    }, (response) => {
      if (response && response.success) {
        showResultModal('AI 개인화 제안 메시지 초안', response.data);
      } else {
        alert('제안문 생성 오류: ' + (response ? response.error : '통신 실패'));
      }
    });
  });
}

// D. DB Register (Google Sheets + Notion)
function handleDbRegister() {
  const resumeData = scrapeResumeData();
  if (!resumeData.name) {
    alert('후보자 프로필 필수값(이름 등)을 파싱하지 못했습니다.');
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
      skills: resumeData.skills,
      experience: resumeData.experience,
      rawText: resumeData.rawText
    }
  }, (response) => {
    btn.textContent = originText;
    btn.disabled = false;
    
    if (response && response.success) {
      alert('💾 구글 스프레드시트 및 Notion DB에 후보자 등록이 완료되었습니다!');
    } else {
      alert('DB 저장 실패: ' + (response ? response.error : '설정 정보를 확인하거나 Google Apps Script 연동을 점검하세요.'));
    }
  });
}

// E. Core Competency & Cover Letter Extraction (On-Demand)
function handleCompetencyExtract() {
  chrome.storage.local.get(['activeJd'], (res) => {
    if (!res.activeJd) {
      alert('사내 시스템 JD 페이지에서 [현재 JD 타겟 지정]을 먼저 완료해주세요.');
      return;
    }

    const resumeData = scrapeResumeData();
    chrome.runtime.sendMessage({
      action: 'EXTRACT_COMPETENCY',
      jd: res.activeJd,
      resume: resumeData.rawText,
      coverLetter: resumeData.coverLetter
    }, (response) => {
      if (response && response.success) {
        showResultModal('AI 핵심역량 및 자소서 분석 요약', response.data);
      } else {
        alert('역량 추출 실패: ' + (response ? response.error : '오류'));
      }
    });
  });
}

// 5. Intelligent Scraping Helpers (Portal Page & Company specific)

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

function scrapeResumeData() {
  const url = window.location.href;
  const rawText = document.body.innerText; // 전체 화면 텍스트
  
  let name = '';
  let phone = '';
  let email = '';
  let skills = '';
  let experience = '';
  let coverLetter = '';

  // 1. 이름 추출 (사람인/잡코리아 인재풀 및 일반 뷰어 통합 셀렉터 목록)
  const nameSelectors = [
    '.info_general h1', '.info_general .c_black', '.info_name', '.name', '.name-area',
    '.user_name', '.user-name', '.profile-name', 'h1', 'h2', '.profile_name',
    '.info_general_name', '#resumeName'
  ];
  for (let s of nameSelectors) {
    const el = document.querySelector(s);
    if (el && el.innerText.trim().length > 0 && el.innerText.trim().length <= 15) {
      name = el.innerText.replace(/[\n\t]/g, '').trim();
      break;
    }
  }

  // 2. 탭 타이틀 기반 이름 복구 (극강의 메타 문자 필터링)
  if (!name || name.trim() === "" || name.includes('인재풀') || name.includes('검색') || name.includes('후보자') || name.includes('미탐지') || name.includes('합격') || name.includes('결과')) {
    const docTitle = document.title;
    // 채용 상태 단어(합격/불합격/서류/면접 등) 필터 추가 강화
    let cleanTitle = docTitle.replace(/(이력서|사람인|잡코리아|JOBKOREA|saramin|포트폴리오|열람|보기|관리|상세|인재풀|인재|검색|후보자|목록|후|내역|다운로드|불합격|합격|서류|면접|최종|진행|상태|결과|통보|[-|[\]()|:\s])/gi, '').trim();
    
    // 한국어 이름(2~4자) 정규식 매칭 시도
    const krNameMatch = cleanTitle.match(/[가-힣]{2,4}/);
    if (krNameMatch) {
      name = krNameMatch[0];
    } else {
      name = cleanTitle.substring(0, 8).trim() || "미탐지_후보자";
    }
  }

  // 2-B. 💥 [최종 이름 구출 엔진] 본문 텍스트 내 인적사항 패턴 역추적 (블랙리스트 보완)
  const nameBlacklist = ["합격", "불합", "탈락", "서류", "면접", "진행", "결과", "상태", "이름", "성명", "인재", "포탈", "회원", "관리", "인재풀", "대기", "나이", "성별", "지원", "전형", "채용", "이력", "포지션", "구직", "구인", "이메일", "연락처", "전화"];
  const isInvalidName = (n) => !n || n.trim() === "" || n.includes('미탐지') || n.includes('후보자') || n.length > 5 || nameBlacklist.some(b => n.includes(b));

  if (isInvalidName(name)) {
    // 패턴 A: "성명: 홍길동" 또는 "이름 : 홍길동"
    const namePattern = /(이름|성명)\s*[:\s]\s*([가-힣*]{2,4})/i;
    const matchA = rawText.match(namePattern);
    if (matchA && matchA[2] && !isInvalidName(matchA[2])) {
      name = matchA[2].trim();
    }
    
    // 패턴 B: "홍길동 (남, 32세)" 또는 "홍길동(35세)" 또는 "홍길동 (30)" (마스킹 * 지원)
    if (isInvalidName(name)) {
      const agePattern = /([가-힣*]{2,4})\s*\(\s*(남|여)?\s*,?\s*\d{2}세?\s*\)/;
      const matchB = rawText.match(agePattern);
      if (matchB && matchB[1] && !isInvalidName(matchB[1])) {
        name = matchB[1].trim();
      }
    }

    // 패턴 C: "홍길동 / 1993년생" 또는 "홍길동 95년생"
    if (isInvalidName(name)) {
      const birthPattern = /([가-힣]{2,4})\s*(\/)?\s*\d{2,4}년생/;
      const matchC = rawText.match(birthPattern);
      if (matchC && matchC[1] && !isInvalidName(matchC[1])) {
        name = matchC[1].trim();
      }
    }
    
    // 최후의 보완: 화면 내 텍스트 중 "010-" 앞 15자 내외에서 이름 단어 찾아보기
    if (!name || name.trim() === "" || name.includes('미탐지') || name.length > 5) {
      const phoneIndex = rawText.indexOf("010");
      if (phoneIndex !== -1) {
        const nearText = rawText.substring(Math.max(0, phoneIndex - 30), phoneIndex);
        const nearKrMatch = nearText.match(/[가-힣]{2,4}/g);
        if (nearKrMatch && nearKrMatch.length > 0) {
          // 전화번호 앞부분 근처에 나타난 가장 마지막 한글 단어를 이름으로 유추
          name = nearKrMatch[nearKrMatch.length - 1];
        }
      }
    }
  }

  // 최종 복구 보장
  if (!name || name.trim() === "" || name.length > 10) {
    name = "미탐지_후보자";
  }

  // 3. 연락처 및 이메일 추출 (정규식 기본 탐재)
  const phoneMatch = rawText.match(/010[-.\s]?\d{3,4}[-.\s]?\d{4}/);
  phone = phoneMatch ? phoneMatch[0] : '';

  const emailMatch = rawText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  email = emailMatch ? emailMatch[0] : '';

  // 3-B. 💥 [생년월일 & 나이 정밀 분석 엔진]
  let birth = '';
  let age = '';

  // A. 나이 추출 (예: "32세" 또는 "(남, 29)")
  const ageMatch = rawText.match(/(\d{2})세/);
  if (ageMatch) {
    age = ageMatch[1] + "세";
  } else {
    const ageMatch2 = rawText.match(/\(\s*(남|여)?\s*,?\s*(\d{2})\s*\)/);
    if (ageMatch2) age = ageMatch2[2] + "세";
  }

  // B. 생년월일 추출 (예: "1994년 5월 12일" 또는 "1995.03.11" 또는 "94년생")
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

  // 4. 주요 기술 추출 (클래스 매칭 실패 시 텍스트 지능형 문맥 분석)
  const skillSelectors = ['.wrap_tag', '.list_skill', '.skill-tag', '.skills', '[class*="skill"]', '.tag_skill'];
  for (let s of skillSelectors) {
    const el = document.querySelector(s);
    if (el && el.innerText.trim().length > 2) {
      skills = el.innerText.trim();
      break;
    }
  }
  
  // 💥 [지능형 문맥 스캐너] 스킬
  if (!skills || skills.length < 3) {
    const skillKeywords = ["주요 기술", "보유 기술", "핵심 기술", "스킬", "Skill", "보유기술", "전문기술", "전문 분야", "전문분야"];
    for (let kw of skillKeywords) {
      const idx = rawText.indexOf(kw);
      if (idx !== -1) {
        // 발견한 키워드로부터 250글자 확보 후 개행문자 정제
        skills = rawText.substring(idx, idx + 250).replace(/[\r\n\t]+/g, ' ').trim();
        break;
      }
    }
  }

  // 5. 경력 정보 추출 (클래스 매칭 실패 시 텍스트 지능형 문맥 분석)
  const expSelectors = ['.career_info', '.total_career', '.career-term', '.work-exp', '[class*="career"]', '[class*="experience"]'];
  for (let s of expSelectors) {
    const el = document.querySelector(s);
    if (el && el.innerText.trim().length > 5) {
      experience = el.innerText.trim();
      break;
    }
  }

  // 💥 [지능형 문맥 스캐너] 경력
  if (!experience || experience.length < 5) {
    const expKeywords = ["경력사항", "근무경력", "경력 정보", "주요 경력", "경력 리스트", "경력", "Work Experience", "경력 정보", "주요경력"];
    for (let kw of expKeywords) {
      const idx = rawText.indexOf(kw);
      if (idx !== -1) {
        // 발견한 경력 키워드로부터 350글자 확보 후 개행문자 정제
        experience = rawText.substring(idx, idx + 350).replace(/[\r\n\t]+/g, ' ').trim();
        break;
      }
    }
  }

  // 6. 자소서 추출
  const clSelectors = ['.self_intro', '#selfIntro', '.self_introduction', '.intro-box', '.portfolio_intro', '.introduction', '[class*="intro"]'];
  for (let s of clSelectors) {
    const el = document.querySelector(s);
    if (el && el.innerText.trim().length > 10) {
      coverLetter = el.innerText.trim();
      break;
    }
  }

  // Fallback default values
  if (!skills) skills = "화면 내 기술스택 미표시 (상세내용 참고)";
  if (!experience) experience = "화면 내 경력정보 미표시 (상세내용 참고)";

  // 💥 [최종 이중 잠금 필터] 이름에 불합격 등 블랙리스트 메타 단어가 섞여있다면 최종 차단
  if (isInvalidName(name)) {
    name = "미탐지_후보자";
  }

  return { name, phone, email, birth, age, skills, experience, coverLetter, rawText };
}

// 6. Generic Premium Result Modal Helper inside target page
function showResultModal(title, content) {
  // Remove existing modals
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

  // Close binding
  const close = () => modal.remove();
  modal.querySelector('.hauto-modal-close').addEventListener('click', close);
  modal.querySelector('.hauto-modal-close-btn').addEventListener('click', close);

  // Copy binding
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

// 7. Instant Local Excel (CSV) Download Handler
function handleExcelDownload() {
  const resumeData = scrapeResumeData();
  if (!resumeData.name) {
    alert('후보자 정보를 화면에서 파싱하지 못했습니다. 채용 포탈의 이력서 보기 화면이 맞는지 확인해 주세요.');
    return;
  }

  // Create CSV Content with BOM (prevents Korean character corruption in MS Excel)
  const headers = ["등록일", "이름", "연락처", "이메일", "생년월일", "나이", "주요 기술", "경력 정보", "진행상태", "상태 변경일", "비고"];
  const dateStr = new Date().toLocaleDateString('ko-KR');
  
  // Clean text from commas and newlines for CSV format safety
  const clean = (val) => {
    if (!val) return "";
    // Wrap with double quotes and escape internal quotes & remove newlines for beautiful CSV rows
    return `"${val.replace(/"/g, '""').replace(/[\r\n\t]/g, ' ')}"`;
  };

  const row = [
    clean(dateStr),
    clean(resumeData.name),
    clean(resumeData.phone),
    clean(resumeData.email),
    clean(resumeData.birth), // 생년월일
    clean(resumeData.age),   // 나이
    clean(resumeData.skills),
    clean(resumeData.experience),
    clean("제안 수락 대기"),
    clean(dateStr), // 상태 변경일 기본값
    clean("") // 비고 공란
  ];

  const csvContent = "\ufeff" + headers.join(",") + "\n" + row.join(",");
  
  // Dynamic Download Action
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
}
