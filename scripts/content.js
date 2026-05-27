// HAuto Chrome Extension - Content Script (content.js)
// Responsible for page detection, UI insertion, and secure DOM scraping.

const HAUTO_UI_ID = 'hauto-assistant-panel';

// 1. Core initialization on page load
initHAutoAssistant();

function initHAutoAssistant() {
  // Check if assistant is already injected
  if (document.getElementById(HAUTO_UI_ID)) return;

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
  const isSaramin = url.includes('saramin.co.kr');
  
  let name = '';
  let phone = '';
  let email = '';
  let skills = '';
  let experience = '';
  let coverLetter = '';
  let rawText = document.body.innerText; // Fallback context

  if (isSaramin) {
    // Saramin Selector parsing rules (Optimized)
    const nameEl = document.querySelector('.info_name') || document.querySelector('.name') || document.querySelector('h1');
    name = nameEl ? nameEl.innerText.replace(/[\n\t]/g, '').trim() : '';

    const phoneEl = document.querySelector('.info_phone') || document.querySelector('[class*="phone"]') || document.querySelector('.telephone');
    phone = phoneEl ? phoneEl.innerText.trim() : '';

    const emailEl = document.querySelector('.info_email') || document.querySelector('[class*="email"]') || document.querySelector('.mail');
    email = emailEl ? emailEl.innerText.trim() : '';

    // Skills & experience matching
    const skillsEl = document.querySelector('.wrap_tag') || document.querySelector('.list_skill');
    skills = skillsEl ? skillsEl.innerText.trim() : '';

    const expEl = document.querySelector('.career_info') || document.querySelector('.total_career');
    experience = expEl ? expEl.innerText.trim() : '';

    const clEl = document.querySelector('.self_intro') || document.querySelector('#selfIntro') || document.querySelector('.self_introduction');
    coverLetter = clEl ? clEl.innerText.trim() : '';
  } else {
    // Jobkorea Selector parsing rules (Optimized)
    const nameEl = document.querySelector('.name') || document.querySelector('.name-area') || document.querySelector('h1');
    name = nameEl ? nameEl.innerText.trim() : '';

    const phoneEl = document.querySelector('.tel') || document.querySelector('.mobile') || document.querySelector('[class*="tel"]');
    phone = phoneEl ? phoneEl.innerText.trim() : '';

    const emailEl = document.querySelector('.email') || document.querySelector('.mail') || document.querySelector('[class*="email"]');
    email = emailEl ? emailEl.innerText.trim() : '';

    const skillsEl = document.querySelector('.skill-tag') || document.querySelector('.list_skill');
    skills = skillsEl ? skillsEl.innerText.trim() : '';

    const expEl = document.querySelector('.career-term') || document.querySelector('.work-exp');
    experience = expEl ? expEl.innerText.trim() : '';

    const clEl = document.querySelector('.intro-box') || document.querySelector('.portfolio_intro') || document.querySelector('.introduction');
    coverLetter = clEl ? clEl.innerText.trim() : '';
  }

  // Backup values from raw regex matching if selectors failed
  if (!phone) {
    const phoneMatch = rawText.match(/010[-.\s]?\d{3,4}[-.\s]?\d{4}/);
    phone = phoneMatch ? phoneMatch[0] : '';
  }
  if (!email) {
    const emailMatch = rawText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    email = emailMatch ? emailMatch[0] : '';
  }

  return { name, phone, email, skills, experience, coverLetter, rawText };
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
