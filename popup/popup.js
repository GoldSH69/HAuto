// Default Prompts Definitions for HAuto
const DEFAULT_PROMPTS = {
  step1: `[고객사 채용 JD]:\n{{JD}}\n\n위 채용 직무 기술서를 분석하여, 사람인과 잡코리아 등 채용 플랫폼에서 후보자를 검색하기에 가장 최적화된 핵심 기술스택 단어 및 직무 검색어 조합 3가지를 쉼표(,)로 구분하여 추천해줘. 반드시 사실에 기반하고 과장되지 않게 단어로만 작성해줘.`,
  
  step2: `[고객사 채용 JD]:\n{{JD}}\n\n[후보자 이력서]:\n{{이력서}}\n\n위 두 자료를 면밀히 대조 분석하여:\n1. 두 자료의 매칭 적합도 점수(1~100)를 매겨줘.\n2. 후보자의 강점 및 적합한 사유를 3줄 내외로 요약해줘.\n3. 부족한 기술이나 아쉬운 점을 1줄로 지적해줘.\n*경고*: 절대 이력서에 명시되어 있지 않은 가상의 경력이나 기술을 상상하여 지어내지 말 것. 100% 사실에만 기반해야 함.`,
  
  step3: `[고객사 채용 JD]:\n{{JD}}\n\n[후보자 이력서]:\n{{이력서}}\n\n위 후보자에게 헤드헌터로서 이 채용 포지션을 제안하는 맞춤형 제안 메시지 초안을 정중하고 매력적인 톤앤매너로 작성해줘. 후보자의 이력서에 기재된 강점/프로젝트 경험을 JD와 구체적으로 엮어서 설명해줘.\n*경고*: 후보자가 자소서/이력서에 쓰지 않은 허위 경력이나 포부를 문맥상 지어내어 기술하지 말 것.`,
  
  step6: `[후보자 이력서 원본]:\n{{이력서}}\n\n위 이력서의 어수선한 텍스트에서 학력 사항, 주요 경력 기간 및 담당 업무, 보유 핵심 기술만 추출하여 완벽하게 정돈된 아래의 표준 서식 템플릿으로 구조화해줘.\n\n[표준 템플릿]\n■ 학력: (학교명, 전공, 학위)\n■ 총 경력연수: (N년 N개월)\n■ 주요 경력 리스트:\n  - 회사명 (재직기간) / 직급\n  - 주요 수행 프로젝트 및 담당 역할 (원문 팩트 기반)\n■ 보유 스킬셋: (핵심 기술스택 단어 목록)`,
  
  competency: `[고객사 채용 JD]:\n{{JD}}\n\n[후보자 이력서]:\n{{이력서}}\n\n[후보자 자기소개서]:\n{{자소서}}\n\n위의 자료를 종합하여, 아래의 양식에 맞추어 후보자의 핵심역량과 자소서 핵심 포인트를 추출해줘. 양식을 정확히 준수하고, 절대 원문에 기재되지 않은 허위 사실이나 과장된 능력을 지어내지 말 것.\n\n[추출 양식]\n1. JD 매칭 핵심역량 요약 (경력 및 프로젝트 기반 3가지):\n2. 자기소개서 기반 지원동기 요약 (3줄 이내):\n3. 입사 후 포부 핵심 정제 (3줄 이내):`
};

let currentEditingFeature = null;

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initPasswordToggles();
  loadSettings();
  initPromptModal();

  // Save Settings Button click
  document.getElementById('save-btn').addEventListener('click', saveSettings);
});

// 1. Tab switching logic
function initTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      document.getElementById(`tab-${tabId}`).classList.add('active');
    });
  });
}

// 2. Password hide/show toggle
function initPasswordToggles() {
  const toggleBtns = document.querySelectorAll('.toggle-pwd-btn');
  toggleBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const input = btn.previousElementSibling;
      if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '🔒';
      } else {
        input.type = 'password';
        btn.textContent = '👁️';
      }
    });
  });
}

// 3. Load settings from storage
function loadSettings() {
  const keys = [
    'geminiKey', 'sheetUrl', 'notionToken', 'notionDbId', 'autoOpenMail',
    'aiStep1', 'aiStep2', 'aiStep3', 'aiStep6', 'aiCompetency'
  ];

  chrome.storage.local.get(keys, (data) => {
    if (data.geminiKey) document.getElementById('gemini-key').value = data.geminiKey;
    if (data.sheetUrl) document.getElementById('sheet-url').value = data.sheetUrl;
    if (data.notionToken) document.getElementById('notion-token').value = data.notionToken;
    if (data.notionDbId) document.getElementById('notion-db-id').value = data.notionDbId;
    
    document.getElementById('auto-open-mail').checked = data.autoOpenMail !== false;
    document.getElementById('ai-step1').checked = !!data.aiStep1;
    document.getElementById('ai-step2').checked = data.aiStep2 !== false;
    document.getElementById('ai-step3').checked = !!data.aiStep3;
    document.getElementById('ai-step6').checked = !!data.aiStep6;
    document.getElementById('ai-competency').checked = data.aiCompetency !== false;
  });
}

// 4. Save settings to storage
function saveSettings() {
  const settings = {
    geminiKey: document.getElementById('gemini-key').value.trim(),
    sheetUrl: document.getElementById('sheet-url').value.trim(),
    notionToken: document.getElementById('notion-token').value.trim(),
    notionDbId: document.getElementById('notion-db-id').value.trim(),
    autoOpenMail: document.getElementById('auto-open-mail').checked,
    aiStep1: document.getElementById('ai-step1').checked,
    aiStep2: document.getElementById('ai-step2').checked,
    aiStep3: document.getElementById('ai-step3').checked,
    aiStep6: document.getElementById('ai-step6').checked,
    aiCompetency: document.getElementById('ai-competency').checked
  };

  chrome.storage.local.set(settings, () => {
    // Show premium visual feedback
    const saveBtn = document.getElementById('save-btn');
    const originalText = saveBtn.textContent;
    saveBtn.textContent = '✨ 저장 완료!';
    saveBtn.style.backgroundColor = '#10B981';
    
    setTimeout(() => {
      saveBtn.textContent = originalText;
      saveBtn.style.backgroundColor = '';
    }, 1500);
  });
}

// 5. Prompt Modal logic (View, Edit, Copy, Reset)
function initPromptModal() {
  const modal = document.getElementById('prompt-modal');
  const textarea = document.getElementById('prompt-textarea');
  const closeBtn = document.querySelector('.close-modal-btn');
  const saveBtn = document.getElementById('modal-save-btn');
  const resetBtn = document.getElementById('modal-reset-btn');
  const copyBtn = document.getElementById('modal-copy-btn');
  const promptTitle = document.getElementById('modal-title');

  const stepTitles = {
    step1: '1단계: JD 기반 플랫폼 검색어 추출 프롬프트',
    step2: '2단계: JD - 후보자 매칭 적합도 분석 프롬프트',
    step3: '3단계: 제안 메시지 초안 작성 프롬프트',
    step6: '6단계: 자유 이력서 표준 템플릿 변환 프롬프트',
    competency: '추가요건: 핵심역량 & 자소서 요약 추출 프롬프트'
  };

  // Open modal on prompt search button click
  document.querySelectorAll('.btn-prompt-view').forEach(btn => {
    btn.addEventListener('click', () => {
      const feature = btn.getAttribute('data-feature');
      currentEditingFeature = feature;
      
      promptTitle.textContent = stepTitles[feature] || '지시어(프롬프트) 관리';

      // Load custom prompt from storage, or fallback to default
      const storageKey = `prompt_${feature}`;
      chrome.storage.local.get([storageKey], (res) => {
        textarea.value = res[storageKey] || DEFAULT_PROMPTS[feature];
        modal.style.display = 'block';
      });
    });
  });

  // Close modal
  const closeModal = () => {
    modal.style.display = 'none';
    currentEditingFeature = null;
  };

  closeBtn.addEventListener('click', closeModal);
  window.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // Save prompt in modal
  saveBtn.addEventListener('click', () => {
    if (!currentEditingFeature) return;
    const customPrompt = textarea.value.trim();
    const storageKey = `prompt_${currentEditingFeature}`;

    chrome.storage.local.set({ [storageKey]: customPrompt }, () => {
      saveBtn.textContent = 'Saved!';
      setTimeout(() => { saveBtn.textContent = '저장'; }, 1000);
      closeModal();
    });
  });

  // Reset prompt to system default
  resetBtn.addEventListener('click', () => {
    if (!currentEditingFeature) return;
    if (confirm('정말로 이 단계를 표준 기본 지시어로 복원하시겠습니까?')) {
      textarea.value = DEFAULT_PROMPTS[currentEditingFeature];
      const storageKey = `prompt_${currentEditingFeature}`;
      chrome.storage.local.remove([storageKey]);
    }
  });

  // Copy full prompt for external use (like web ChatGPT/Claude)
  copyBtn.addEventListener('click', () => {
    // Generate simulated prompt replacing parameters with mock template so user can test on web
    let fullText = textarea.value;
    
    // Add helpful instructions to the copied text so other web AIs understand variables
    const headerHelp = `/* 아래 프롬프트를 복사하여 ChatGPT / Claude / Gemini 등의 웹사이트에 그대로 붙여넣으세요. */\n/* {{JD}}, {{이력서}}, {{자소서}}의 중괄호 자리에 본인이 원하는 텍스트를 붙여넣어 직접 테스트해볼 수 있습니다. */\n\n`;
    
    navigator.clipboard.writeText(headerHelp + fullText).then(() => {
      copyBtn.textContent = 'Copied!';
      copyBtn.style.backgroundColor = '#10B981';
      copyBtn.style.color = '#FFFFFF';
      
      setTimeout(() => {
        copyBtn.textContent = '최종본 복사';
        copyBtn.style.backgroundColor = '';
        copyBtn.style.color = '';
      }, 1500);
    });
  });
}
