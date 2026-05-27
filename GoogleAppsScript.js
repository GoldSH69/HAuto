/**
 * ====================================================================
 * HAuto - Google Apps Script (GAS) 코드 가이드
 * ====================================================================
 * 
 * [설치 및 사용법]
 * 1. 연동하고자 하는 구글 스프레드시트를 생성합니다.
 * 2. 상단 메뉴에서 [확장 프로그램] > [Apps Script]를 클릭합니다.
 * 3. 기존 코드를 모두 지우고 본 스크립트의 내용을 그대로 붙여넣습니다.
 * 4. 오른쪽 상단의 [배포] > [새 배포]를 클릭합니다.
 * 5. 유형 선택: [웹 앱]을 선택합니다.
 * 6. 웹 앱 설정:
 *    - 설명: HAuto API Web App
 *    - 다음 사용자 권한으로 실행: [나 (본인 이메일 계정)]
 *    - 액세스 권한이 있는 사용자: [모든 사용자 (Anyone)] <- 필수!
 * 7. [배포] 버튼을 클릭하고 액세스 승인(권한 허용)을 진행합니다.
 * 8. 생성된 [웹 앱 URL]을 복사하여 HAuto 크롬 확장 프로그램 설정창에 등록합니다.
 */

// 1. 크롬 확장 프로그램으로부터 데이터를 수신하여 스프레드시트에 기록 (POST 요청 처리)
function doPost(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const data = JSON.parse(e.postData.contents);
    
    // 시트가 완전히 비어있는 경우 헤더(타이틀) 생성 (생년월일 및 나이 추가하여 총 11개 열)
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["등록일", "이름", "연락처", "이메일", "생년월일", "나이", "주요 기술", "경력 정보", "진행상태", "상태 변경일", "비고"]);
      
      // 헤더 스타일링 (볼드 및 다크네이비 배경)
      const headerRange = sheet.getRange("A1:K1");
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#1E293B");
      headerRange.setFontColor("#FFFFFF");
      headerRange.setHorizontalAlignment("center");
    }
    
    // 신규 후보자 데이터 추가 (기본 진행상태: '제안 수락 대기')
    sheet.appendRow([
      data.date || new Date().toLocaleDateString('ko-KR'),
      data.name,
      data.phone,
      data.email,
      data.birth || "", // 생년월일
      data.age || "",   // 나이
      data.skills,
      data.experience,
      "제안 수락 대기",
      "", // 상태 변경일 (상태 변경 시 자동 채움)
      ""  // 비고 (사용자 자유 입력)
    ]);
    
    // 추가된 행의 정렬 맞추기
    const lastRow = sheet.getLastRow();
    sheet.getRange(lastRow, 1, 1, 11).setHorizontalAlignment("left");
    
    return ContentService.createTextOutput(JSON.stringify({ success: true }))
                         .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message }))
                         .setMimeType(ContentService.MimeType.JSON);
  }
}

// 2. 구글 스프레드시트 상태 값 변경 시 이메일 템플릿 작성 및 발송 트리거
// (생년월일, 나이 추가로 인해 '진행상태'는 9번째 열로 이동하였습니다.)
function onEdit(e) {
  const range = e.range;
  const sheet = range.getSheet();
  const editedColumn = range.getColumn();
  const editedRow = range.getRow();
  
  // 첫 번째 행(헤더)이거나, 9번째 열(진행상태)이 아닌 경우 스킵
  if (editedRow === 1 || editedColumn !== 9) return;
  
  const statusValue = range.getValue();
  const email = sheet.getRange(editedRow, 4).getValue(); // D열 (이메일)
  const name = sheet.getRange(editedRow, 2).getValue();  // B열 (이름)
  
  // ⚡ [자동화] 9번째 열(진행상태)이 바뀌면 즉시 10번째 열(상태 변경일)에 오늘 날짜 자동 입력
  sheet.getRange(editedRow, 10).setValue(new Date().toLocaleDateString('ko-KR'));
  
  if (!email || !name) return;
  
  let emailSubject = "";
  let emailBody = "";
  
  // 상태별 이메일 템플릿 정의 (사내 이메일 대신 Gmail로 안전 자동화 또는 가이드 작성)
  if (statusValue === "서류합격") {
    // Calendly 무료 플랜 조율 링크 등을 동적으로 채워 넣음
    emailSubject = `[HAuto 채용 알림] ${name}님, 서류 전형 합격 및 면접 일정 조율 안내`;
    emailBody = `안녕하세요, ${name}님.\n\n` +
                `지원하신 채용 건에 서류 전형 합격 소식을 기쁘게 전달해 드립니다.\n` +
                `다음 단계인 면접 진행을 위해 아래의 일정 조율 링크(Calendly)를 통해 편하신 면접 일정을 선택해 주시기 바랍니다.\n\n` +
                `■ 면접 일정 선택 링크: https://calendly.com/your-company-link\n\n` +
                `선택해 주시는 즉시 면접 시간이 확정되며, 안내 메일이 추가로 발송됩니다.\n\n` +
                `감사합니다.\n채용담당자 드림`;
  } 
  else if (statusValue === "서류불합격") {
    emailSubject = `[안내] ${name}님, 서류 전형 결과 안내`;
    emailBody = `안녕하세요, ${name}님.\n\n` +
                `이번 저희 포지션에 관심을 가져주시고 지원해 주셔서 진심으로 감사드립니다.\n\n` +
                `보내주신 이력서와 역량은 매우 우수하셨으나, 한정된 선발 인원으로 인해 이번 서류 전형에서는 아쉽게도 모시지 못하게 되었습니다.\n` +
                `비록 이번에는 인연이 닿지 않았지만, 추후 다른 더 좋은 포지션으로 다시 연락을 드릴 수 있기를 진심으로 바랍니다.\n\n` +
                `앞날에 많은 성공이 함께하시기를 기원합니다.\n\n` +
                `감사합니다.\n채용담당자 드림`;
  }
  else if (statusValue === "면접탈락") {
    emailSubject = `[안내] ${name}님, 면접 전형 결과 안내`;
    emailBody = `안녕하세요, ${name}님.\n\n` +
                `바쁘신 와중에도 면접 전형에 참석해 주시고 유익한 대화를 나누어 주셔서 대단히 감사드립니다.\n\n` +
                `면접을 통해 ${name}님의 우수한 역량과 열정을 확인할 수 있었으나, 아쉽게도 이번 채용 목표와의 부합도 면에서 모시지 못하게 되었다는 소식을 전해드립니다.\n` +
                `보여주신 시간과 열정에 깊이 감사드리며, 향후 하시는 모든 일에 발전이 있으시기를 소망합니다.\n\n` +
                `감사합니다.\n채용담당자 드림`;
  }
  
  if (emailSubject && emailBody) {
    // 1. 직접 Gmail로 발송하는 완전 자동화 방식 (무료)
    try {
      GmailApp.sendEmail(email, emailSubject, emailBody);
      // 발송 성공 시 메모 추가 및 기록
      range.setNote("자동 이메일이 발송되었습니다. 발송 일시: " + new Date().toLocaleString());
    } catch (err) {
      range.setNote("메일 발송 실패: " + err.message);
    }
  }
}
