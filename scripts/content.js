// HAuto Chrome Extension - Content Script (content.js)
// Responsible for page detection, UI insertion, and secure DOM scraping.

const HAUTO_UI_ID = 'hauto-assistant-panel';
var monitorIntervalId = null;

// 💥 [Domain Guard]
// Only start crawler and active monitors on portal domains or local debug setups to save memory and eliminate errors on arbitrary sites (like Naver, Daum, etc.)
const currentUrl = window.location.href;
const isTargetDomain = currentUrl.includes('saramin.co.kr') || 
                       currentUrl.includes('jobkorea.co.kr') || 
                       currentUrl.includes('localhost') || 
                       currentUrl.includes('127.0.0.1') ||
                       currentUrl.includes('hiring') || 
                       currentUrl.includes('applicant');

if (isTargetDomain) {
  // Core initialization on target pages only
  initHAutoAssistant();
  // Start background monitoring updates on target pages only
  startMonitorUpdating();
}

// 💥 [ 우주급 프레임 관통 릴레이 postMessage 수신기 ]
// CORS(동종기원정책) 보안 장벽을 우회하여, 2중 및 N중 중첩 iframe까지도 신호를 릴레이 전파하여 모든 프레임의 데이터를 백그라운드로 전송합니다.
window.addEventListener('message', (event) => {
  if (!isTargetDomain) return; // Only process on recruiting targets
  
  if (event.data && event.data.action === 'REQUEST_FRAME_REPORT_VIA_POSTMESSAGE') {
    try {
      // 1단계: 자신의 로컬 DOM에서 이력서 정보를 긁어 백그라운드로 즉시 릴레이 전송
      const localData = scrapeLocalFrameData();
      safeSendMessage({
        action: 'SUBMIT_FRAME_REPORT',
        data: localData
      });

      // 2단계: ⚡[릴레이 엔진] 자신의 DOM 자식들(Shadow DOM 포함) 중 또 다른 하위 iframe이 존재하면 똑같은 postMessage를 재전파!
      const subIframes = findAllIframes(document);
      subIframes.forEach((sub) => {
        try {
          if (sub.contentWindow) {
            sub.contentWindow.postMessage({ action: 'REQUEST_FRAME_REPORT_VIA_POSTMESSAGE' }, '*');
          }
        } catch (err) {
          console.log('HAuto 하위 iframe 릴레이 전송 실패:', err.message);
        }
      });
    } catch (e) {
      console.log('HAuto 릴레이 수신 처리 중 오류:', e.message);
    }
  }
});

// 💥 [Extension Context Validator]
// Checks if the extension context is still valid. Accessing chrome.runtime.id will throw an error if the context is invalidated.
function isContextValid() {
  try {
    return typeof chrome !== 'undefined' && chrome.runtime && !!chrome.runtime.id;
  } catch (e) {
    return false;
  }
}

// 💥 [Shadow DOM Penetrating Text Scraper]
// Recursively extracts all text content from both Light DOM and any open Shadow DOMs, mimicking block formatting.
function getCompleteDOMText(node = document.body) {
  if (!node) return "";
  
  const tagName = node.tagName ? node.tagName.toUpperCase() : "";
  if (tagName === "STYLE" || tagName === "SCRIPT" || tagName === "NOSCRIPT") {
    return "";
  }

  if (node.nodeType === Node.TEXT_NODE) {
    return node.nodeValue;
  }

  let text = "";
  if (node.childNodes && node.childNodes.length > 0) {
    node.childNodes.forEach((child) => {
      text += getCompleteDOMText(child);
    });
  }

  if (node.shadowRoot) {
    text += "\n" + getCompleteDOMText(node.shadowRoot) + "\n";
  }

  if (tagName === "DIV" || tagName === "P" || tagName === "LI" || tagName === "TR" || tagName === "BR") {
    text += "\n";
  }

  return text;
}

// 💥 [Shadow DOM Penetrating Selector Query]
// Recursively queries selector inside both Light DOM and open Shadow DOMs.
function queryShadow(selector, root = document) {
  try {
    const el = root.querySelector(selector);
    if (el) return el;
    
    const all = root.querySelectorAll('*');
    for (let child of all) {
      if (child.shadowRoot) {
        const res = queryShadow(selector, child.shadowRoot);
        if (res) return res;
      }
    }
  } catch (e) {}
  return null;
}

// 크롬 표준 런타임 메시지 수신기 (동일 프레임 통신용)
try {
  if (chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (!isContextValid() || !isTargetDomain) return;
      
      if (message.action === 'REQUEST_FRAME_REPORT') {
        try {
          const localData = scrapeLocalFrameData();
          safeSendMessage({
            action: 'SUBMIT_FRAME_REPORT',
            data: localData
          });
          sendResponse({ success: true });
        } catch (e) {
          console.log('HAuto 런타임 보고 오류:', e.message);
          sendResponse({ success: false, error: e.message });
        }
      }
      return true;
    });
  }
} catch (err) {
  console.log('HAuto 런타임 메시지 리스너 초기화 스킵 (컨텍스트 만료):', err.message);
}

// 💥 [Safe Message Sender Proxy] 
// Prevents "Extension context invalidated" crashes during extension updates by evaluating runtime status actively before fetch.
// Uses MV3 Promise-based invocation to completely prevent unhandled asynchronous invalidation callback exceptions.
function safeSendMessage(message, callback) {
  if (!isContextValid()) {
    return false;
  }
  try {
    chrome.runtime.sendMessage(message)
      .then((response) => {
        if (callback) callback(response);
      })
      .catch((err) => {
        // Suppress asynchronous context invalidation errors silently
        console.log('HAuto: sendMessage digested error:', err.message);
      });
    return true;
  } catch (e) {
    // Graceful error digestion for synchronous invalidation errors
    return false;
  }
}

// 💥 [Safe Storage Local Accessors]
// Prevents storage retrieval crashes when context gets invalidated.
function safeStorageGet(keys, callback) {
  if (!isContextValid()) return false;
  try {
    chrome.storage.local.get(keys, (res) => {
      if (chrome.runtime.lastError) {
        console.log('HAuto: storage get digested error:', chrome.runtime.lastError.message);
        return;
      }
      if (callback) callback(res);
    });
    return true;
  } catch (e) {
    return false;
  }
}

function safeStorageSet(items, callback) {
  if (!isContextValid()) return false;
  try {
    chrome.storage.local.set(items, () => {
      if (chrome.runtime.lastError) {
        console.log('HAuto: storage set digested error:', chrome.runtime.lastError.message);
        return;
      }
      if (callback) callback();
    });
    return true;
  } catch (e) {
    return false;
  }
}

function initHAutoAssistant() {
  // 💥 [부모 프레임 가드] 오직 최상단 창(top frame)에만 플로팅 비서 패널을 띄움
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

  btnHtml += `
    <div class="hauto-monitor" style="font-size: 9px; color: #a78bfa; margin-top: 10px; padding-top: 8px; border-top: 1px dashed #2d3754; text-align: left; line-height: 1.4;">
      ⏳ 실시간 분석 대기 중...
    </div>
  `;

  btnHtml += `<div class="hauto-footer" style="margin-top:8px;">집 & 사무실 자동 연동 중</div>`;
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

// 💥 [지구 끝까지 수색하는 Shadow DOM 관통형 iframe 검색기]
// 일반 쿼리셀렉터가 뚫지 못하는 open Shadow DOM 장벽 안쪽까지 재귀적으로 파고들어 모든 iframe 엘리먼트를 사냥합니다.
function findAllIframes(root = document) {
  let list = [];
  try {
    // 1. 현재 루트에서 모든 직접 노출된 iframe 수집
    const directIframes = root.querySelectorAll('iframe');
    directIframes.forEach(iframe => list.push(iframe));
    
    // 2. 현재 루트의 모든 요소를 뒤져 Shadow DOM 내부 추적
    const allElements = root.querySelectorAll('*');
    allElements.forEach(el => {
      if (el.shadowRoot) {
        // shadowRoot 내부를 다시 탐색하여 병합
        list = list.concat(findAllIframes(el.shadowRoot));
      }
    });
  } catch (err) {
    console.log('HAuto Shadow DOM 탐색 중 예외 스킵:', err.message);
  }
  return list;
}

// 4. Unified Data Requester Broker (Fires postMessage with recursive relay to capture nested cross-origin iframes)
function requestMergedResumeData(callback) {
  // 1. Tell background to reset the data bucket first to avoid race conditions
  safeSendMessage({ action: 'RESET_TAB_DATA' }, () => {
    // 2. Report top-level parent frame data
    try {
      const parentData = scrapeLocalFrameData();
      safeSendMessage({
        action: 'SUBMIT_FRAME_REPORT',
        data: parentData
      });
    } catch (e) {
      console.log('HAuto 부모 프레임 데이터 선제 보고 오류:', e.message);
    }

    // 3. Broadcast scanning signal to all child frames recursively
    const iframes = findAllIframes(document);
    iframes.forEach((iframe) => {
      try {
        if (iframe.contentWindow) {
          iframe.contentWindow.postMessage({ action: 'REQUEST_FRAME_REPORT_VIA_POSTMESSAGE' }, '*');
        }
      } catch (e) {
        console.log('iframe postMessage 발송 오류:', e.message);
      }
    });

    // 4. Wait 350ms to allow all frames to report, then retrieve the consolidated data
    setTimeout(() => {
      safeSendMessage({ action: 'GET_MERGED_RESUME_DATA' }, (response) => {
        if (response && response.success && response.data) {
          const resumeData = response.data;
          
          // 💥 [초강력 디버그 방어벽] 만약 조립에 성공했으나 생년월일이나 나이가 비어 있는 경우 디버그 패널 즉각 현출!
          if (!resumeData.birth || !resumeData.age || resumeData.birth === '미탐지' || resumeData.age === '미탐지') {
            showDebugModal(resumeData);
          }
          
          callback(resumeData);
        } else {
          alert('이력서 데이터 실시간 수집 실패: ' + (response ? response.error : '로딩 대기 중입니다. 새로고침 후 다시 시도해 주세요.'));
        }
      });
    }, 350);
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

  safeSendMessage({ action: 'EXTRACT_JD_KEYWORDS', text: jdText }, (response) => {
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
  
  const success = safeStorageSet({ activeJd: jdText }, () => {
    alert('🎯 현재 화면의 JD가 매칭 분석 기준으로 정상 설정되었습니다.');
  });
  if (!success) {
    alert('HAuto: 확장 프로그램이 업데이트되었습니다. 페이지를 새로고침해 주세요.');
  }
}

// B. Candidate Matching Analysis (Saramin/Jobkorea)
function handleAiMatch() {
  const success = safeStorageGet(['activeJd'], (res) => {
    if (!res.activeJd) {
      alert('사내 시스템 JD 페이지에서 [현재 JD 타겟 지정]을 먼저 완료해주세요.');
      return;
    }

    requestMergedResumeData((resumeData) => {
      safeSendMessage({
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
  if (!success) {
    alert('HAuto: 확장 프로그램이 업데이트되었습니다. 페이지를 새로고침해 주세요.');
  }
}

// C. Dynamic personalized offer letter creation
function handleOfferMsg() {
  const success = safeStorageGet(['activeJd'], (res) => {
    if (!res.activeJd) {
      alert('사내 시스템 JD 페이지에서 [현재 JD 타겟 지정]을 먼저 완료해주세요.');
      return;
    }

    requestMergedResumeData((resumeData) => {
      safeSendMessage({
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
  if (!success) {
    alert('HAuto: 확장 프로그램이 업데이트되었습니다. 페이지를 새로고침해 주세요.');
  }
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

    safeSendMessage({
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
  const success = safeStorageGet(['activeJd'], (res) => {
    if (!res.activeJd) {
      alert('사내 시스템 JD 페이지에서 [현재 JD 타겟 지정]을 먼저 완료해주세요.');
      return;
    }

    requestMergedResumeData((resumeData) => {
      safeSendMessage({
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
  if (!success) {
    alert('HAuto: 확장 프로그램이 업데이트되었습니다. 페이지를 새로고침해 주세요.');
  }
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
  const rawText = getCompleteDOMText(document.body);
  const title = document.title;
  
  let name = '';
  let phone = '';
  let email = '';
  let birth = '';
  let age = '';
  let skills = '';
  let experience = '';
  let coverLetter = '';

  // A. Name Parsing: find selectors in its own DOM (including Shadow DOM)
  const nameSelectors = [
    '.info_general h1', '.info_general .c_black', '.info_name', '.name', '.name-area',
    '.user_name', '.user-name', '.profile-name', 'h1', 'h2', 'h3', '.profile_name',
    '.info_general_name', '#resumeName', '[class*="Name"]', '[class*="name"]', '[class*="profile"]'
  ];
  for (let s of nameSelectors) {
    const el = queryShadow(s);
    if (el) {
      const elText = (el.innerText || el.textContent || "").trim();
      if (elText.length > 0 && elText.length <= 10) {
        const cleanName = elText.replace(/[\n\t\s]/g, '').trim();
        if (cleanName.length >= 2 && cleanName.length <= 4) {
          name = cleanName;
          break;
        }
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
  const commonAgePattern = /((?:19|20)\d{2})\s*\(\s*(\d{2})세\s*\)/;
  const matchCommon = rawText.match(commonAgePattern);
  if (matchCommon) {
    birth = matchCommon[1] + "년"; // e.g. "1978년"
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

    const birthMatchSpecial = rawText.match(/((?:19|20)\d{2})\s*\(\s*\d{2}세\)/);
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
          const birthMatch3 = rawText.match(/((?:19|20)\d{2})년생/);
          if (birthMatch3) {
            birth = birthMatch3[1] + "년생";
          } else {
            const birthMatch4 = rawText.match(/((?:19|20)\d{2})\s*년생/);
            if (birthMatch4) {
              birth = birthMatch4[1] + "년생";
            } else {
              const birthMatch5 = rawText.match(/\b((?:19|20)\d{2})\b/);
              if (birthMatch5) birth = birthMatch5[1] + "년";
            }
          }
        }
      }
    }
  }

  // D. Skills extraction (including Shadow DOM)
  const skillSelectors = ['.wrap_tag', '.list_skill', '.skill-tag', '.skills', '[class*="skill"]', '.tag_skill'];
  for (let s of skillSelectors) {
    const el = queryShadow(s);
    if (el) {
      const elText = (el.innerText || el.textContent || "").trim();
      if (elText.length > 2) {
        skills = elText;
        break;
      }
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

  // E. Experience info (including Shadow DOM)
  const expSelectors = ['.career_info', '.total_career', '.career-term', '.work-exp', '[class*="career"]', '[class*="experience"]'];
  for (let s of expSelectors) {
    const el = queryShadow(s);
    if (el) {
      const elText = (el.innerText || el.textContent || "").trim();
      if (elText.length > 5) {
        experience = elText;
        break;
      }
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

  // F. Cover letter (self-intro) (including Shadow DOM)
  const clSelectors = ['.self_intro', '#selfIntro', '.self_introduction', '.intro-box', '.portfolio_intro', '.introduction', '[class*="intro"]'];
  for (let s of clSelectors) {
    const el = queryShadow(s);
    if (el) {
      const elText = (el.innerText || el.textContent || "").trim();
      if (elText.length > 10) {
        coverLetter = elText;
        break;
      }
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

// 9. Premium Real-Time Monitor Panel Update Loop

function startMonitorUpdating() {
  if (monitorIntervalId) clearInterval(monitorIntervalId);
  
  // Update loop: every 3.0s to dynamically adjust to portal page content
  monitorIntervalId = setInterval(() => {
    // 💥 [Self-Destruct Pin on Invalid Context]
    // If extension is updated/reloaded and tab is not refreshed, cleanly stop setInterval to prevent Uncaught Error crashes.
    if (!isContextValid()) {
      clearInterval(monitorIntervalId);
      return;
    }

    // A. Broadcast sub-frame postMessages dynamically to gather DOM text in real time (using recursive Shadow DOM selector)
    const iframes = findAllIframes(document);
    iframes.forEach((iframe) => {
      try {
        if (iframe.contentWindow) {
          iframe.contentWindow.postMessage({ action: 'REQUEST_FRAME_REPORT_VIA_POSTMESSAGE' }, '*');
        }
      } catch (e) {}
    });

    // B. Fetch merged data from background worker to update visual monitor indicator
    safeSendMessage({ action: 'GET_MERGED_RESUME_DATA' }, (response) => {
      if (response && response.success && response.data) {
        const resumeData = response.data;
        const monitorEl = document.querySelector('.hauto-monitor');
        if (monitorEl) {
          let statusText = `👤 <strong>이름:</strong> ${resumeData.name || '미탐지'}<br>`;
          statusText += `📅 <strong>생년:</strong> ${resumeData.birth || '❌ 미탐지'}<br>`;
          statusText += `🎂 <strong>나이:</strong> ${resumeData.age || '❌ 미탐지'}`;
          monitorEl.innerHTML = statusText;
        }
      }
    });
  }, 3000);
}

// 10. Ultimate Debug Modal for diagnostic text harvesting
function showDebugModal(resumeData) {
  // Remove existing
  const oldModal = document.querySelector('.hauto-debug-modal');
  if (oldModal) oldModal.remove();

  // Gather frame diagnostics to include in debug info
  const frames = findAllIframes(document);
  let debugMeta = `[HAuto 프레임 진단 로그]\n- 탭 탐지 여부: ${isTargetDomain ? '참' : '거짓'}\n- 탐지된 총 iframe 개수: ${frames.length}개\n`;
  frames.forEach((f, idx) => {
    debugMeta += `  [iframe #${idx}] src: "${f.getAttribute('src') || 'src 없음'}", id: "${f.id || 'id 없음'}", class: "${f.className || 'class 없음'}"\n`;
  });
  debugMeta += `--------------------------------------------------\n\n`;

  const modal = document.createElement('div');
  modal.className = 'hauto-debug-modal';
  modal.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 520px;
    background: linear-gradient(135deg, #1e152a 0%, #0d0714 100%);
    border: 2px solid #ef4444;
    border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.9);
    padding: 24px;
    z-index: 100005;
    color: #f1f5f9;
    font-family: 'Outfit', sans-serif;
  `;

  modal.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #3b204c; padding-bottom:12px; margin-bottom:16px;">
      <h3 style="font-size:15px; font-weight:700; color:#ef4444; margin:0; display:flex; align-items:center; gap:8px;">
        ⚠️ HAuto 인적사항(생년월일/나이) 분석 디버그 패널
      </h3>
      <button class="debug-close" style="background:none; border:none; color:#94a3b8; font-size:20px; cursor:pointer;">&times;</button>
    </div>
    <div style="font-size:12px; line-height:1.6; color:#cbd5e1; margin-bottom:14px;">
      <p style="margin: 0 0 8px 0; font-weight:600; color:#f8fafc;">
        후보자 이름(<strong>${resumeData.name}</strong>)은 찾았으나 생년월일/나이 분석에 실패했습니다.
      </p>
      <p style="margin:0;">
        현재 비서가 화면 내 모든 프레임(iframe 포함)에서 긁어온 <strong>실시간 전체 텍스트</strong>는 아래와 같습니다. 아래 상자 안의 텍스트를 전체 복사하여 채팅창에 붙여넣어 주시면 즉시 정밀 튜닝해 드리겠습니다!
      </p>
    </div>
    <textarea style="width:100%; height:220px; background-color:#08030c; color:#38bdf8; border:1px solid #3b204c; border-radius:8px; padding:12px; font-size:11px; font-family:monospace; resize:none; margin-bottom:16px;" readonly>${debugMeta}${resumeData.rawText || '(수집된 텍스트가 완전히 비어 있습니다)'}</textarea>
    <div style="display:flex; justify-content:flex-end; gap:10px;">
      <button class="debug-copy-btn" style="background-color:#ef4444; border:none; color:#fff; font-size:11px; font-weight:600; padding:9px 16px; border-radius:8px; cursor:pointer;">디버그 텍스트 복사하기</button>
      <button class="debug-close-btn" style="background-color:#1d1226; border:1px solid #3b204c; color:#cbd5e1; font-size:11px; font-weight:600; padding:9px 16px; border-radius:8px; cursor:pointer;">닫기</button>
    </div>
  `;

  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.querySelector('.debug-close').addEventListener('click', close);
  modal.querySelector('.debug-close-btn').addEventListener('click', close);

  modal.querySelector('.debug-copy-btn').addEventListener('click', () => {
    navigator.clipboard.writeText(debugMeta + resumeData.rawText).then(() => {
      const btn = modal.querySelector('.debug-copy-btn');
      btn.textContent = '복사 완료! 채팅창에 붙여넣어 주세요.';
      btn.style.backgroundColor = '#10B981';
      setTimeout(() => {
        btn.textContent = '디버그 텍스트 복사하기';
        btn.style.backgroundColor = '#ef4444';
      }, 2000);
    });
  });
}
