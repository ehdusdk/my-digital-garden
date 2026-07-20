---
{"dg-publish":true,"permalink":"/local-cdw-exporter/","dg-note-properties":{}}
---

#강북삼성 #LocalCDWExporter #CISNEIS #CISNEISLite

## 이슈 내용
1. 특정환자 수치값이 누락되는 현상
2. 특정환자 수치값이 다른 환자 수치값으로 EMR에 전달되는 이슈
3. 강북삼성 화성 건진과 예건에서 발생하고 있음

## 결론
1. CISNEIS{Lite} 에서 m_cdwguid 값이  CDW.xml 파일명에 GUID 값과 같은지 확인하여 MatchedInfo.xml 에 GUID 노드로 추가한다.
2. LocalCDWExporter 에서 MatchedInfo.xml 폴링하다  MatchedInfo.xml에 GUID 로 CDW.xml을 찾아서 수치값을 적용하도록 변경 
	1. 최신 XML 찾는 로직 제거 
	2. XML 찾은 이후에 다른 모든 XML 파일 삭제 로직은  제거 한다.
	3. XML 제거에 대해서는 추가 로직 지정된 XML 파일을 삭제하는 다른 유틸리티 실행파일 로 처리 or  처리 로직에 지정됝 경과 날짜에 대한 파일만 지우도록 로직 추가를 고려한다.
## Workflow 시 설정 기타 설정 내용
1. CISReceiver CDW 패스 지정 ( XML 파일에서 수동 입력 필요 함)
	1. CISReceiver XML에서 아래와 같이 패스를 지정하여 CDW XML 생성 패스를 지정한다.
	  
	2. Add Receiver 하여 생성된 XML 파일을 연다. ( CIS Receiver 종료되어 있어야 한다.)
	3. CDW 관련 노드에  패스를 추가 기입 한다. ( 지정된 패스에 CDW 관련 파일을 생성하게 됨)
	4. ![Pasted image 20260720143744.png](/img/user/Pasted%20image%2020260720143744.png)
	5.  위와 같이 했을 경우  UI 상에  CDW 체크가되어 있어야 한다. 
	6. ![[Pasted image 20260720143939.png\|Pasted image 20260720143939.png]]
2. CISReceiver 특정 exe 실행 하도록 수정 방법
	1. CISNEISLite 경우 이 방법을 해야하는것인지 확인은 필요 하나 이 방법으로 가능하므로 설명한다.
		1. Shift + Ctrl + Alt 누른상태에서 "External Application" 마우스 왼쪽 두번 클릭 
		2. 비밀번호는 "cjp0205" 누르고 호출대상 exe 경로를 설정한다. 
		3. ![Pasted image 20260720151226.png](/img/user/Pasted%20image%2020260720151226.png)
		4.  ![Pasted image 20260720151051.png](/img/user/Pasted%20image%2020260720151051.png)
		5. ![Pasted image 20260720151259.png](/img/user/Pasted%20image%2020260720151259.png)
		6. ![Pasted image 20260720151308.png](/img/user/Pasted%20image%2020260720151308.png)
		7. ![Pasted image 20260720151323.png](/img/user/Pasted%20image%2020260720151323.png)
		8. 
## 기본 Workflow ( 순서별 처리 내용 정리)
1. CISReceiver
	1. CDW Interface XML 및 CDW XML 생성
	2. CISNEIS 호출
	3. CISNEIS Inteface XML 생성 
2. CISNEIS (@CISNEISLite)
	1. CISReceiver에서 전달한 Inteface XML 확인
	2. Exam Data 확인 및  UI 상에 ExamInfo 리스트에 추가
	3. 처방 + Exam Matching 진행 및  MatchedInfo.xml 생성
3. LocalCDWExporter
	1. MatchedInfo.xml 폴링
	2. MatchedInfo.xml 파싱  Accno, PID 확인
	3. CIS Receiver 생성한 CDW XML 값을 XLST 변경 및 수치값 전송
## 분석내용
0. 변경사항 포함 시퀀스 내용 정리 
```
[InBody BSM-330]
      │ RS232
      ▼
┌─ CISReceiver ───────────────────────────────────────────────┐
│ CISRS232Receiver 수신(.dat) → CISParser 파싱                 │
│   ├─ GUID 생성 (ContentGUID = 5FE6A446-...)                 │
│   ├─ EXAMDATA\<GUID>\ 수치데이터 + EXAMDATA\<GUID>.xml 저장   │
│   └─ 인터페이스 XML(cdwguid 포함) → CIS_Lite\Data\Interface   │
│      + WM_COPYDATA(NEIS_CALL)로 NEISLite 호출                │
└─────────────────────────────────────────────────────────────┘
      ▼
┌─ CISNEIS[Lite] ──────────────────────────────────────────────┐
│ LocalDataManager::AddExam → cdwguid 로컬 저장 (기존 동작)     │
│ 간호사: 환자(오더) + 측정검사 선택 → Match                      │
│ OnBnClickedMatch:                                           │
│   MatchedInfo.xml 생성                                      │
│   { ACCN, PID, ExamCode, DeptCode, ★CDWGUID(들) }  ←― ①추가 │
└─────────────────────────────────────────────────────────────┘
      ▼ (MatchedInfo 폴더 폴링)
┌─ LocalCDWExporter ─────────────────────────────────────────┐
│ RunOnceForMatchedInfo:                                      │
│  1. ParseMatchedInfo → ACCN/PID + ★CDWGUID     ←――――― ②추가 │
│  2. MoveCDWDataFiles:                                       │
│     ★ EXAMDATA\<CDWGUID> 폴더를 이름으로 직접 선택  ←― ②변경    │
│        ├ 있음 → 해당 폴더+<GUID>.xml만 Backup2 이동            │
│        │        (타 폴더 삭제 로직 ①②지점 제거)                 │
│        └ 없음 → N회 재시도 → error 이동 + 로그                 │
│  3. XSLT 변환 → req_export(ptno=PID, 수치=해당 GUID 데이터)    │
│  4. EMR API 전송 → 성공 시 backup / 실패 시 error              │
└─────────────────────────────────────────────────────────────┘
      ▼ (별도 주기 작업)
  고아 폴더(매칭 안 된 측정): 48h 경과 시 quarantine 이동 → 보존 후 정리
```
1. 현재 상태
	1. 강북삼성 예건 경우 특정 환자 수치값이 다른 환자 수치 값으로 전송됨
	2. 현재 검사장비에 측정 결과에 대한 매칭이 1대1로 이뤄지지 않는 상태가 문제임
	3. 현재 1대1 매칭이 되지 않는 workflow에 대한 문제점 
		1. CISReceiver는 신장체중장비와 연동하여 측정시 CDW.xml 파일을 지정된 CDW 패스에 생성함 ( {guid폴더}/*.xml, *.cdw.xml 생성 및  guid.xxml 생성)
		2. LocalCDWExporter는 CISNEIS에서 생성하는 MatchedInfo.xml 경로를 폴링 함
		3. LocalCDWExporter에서는 MatchedInfo.xml 파일을 받으면 CDW Interface xml 위치에 최신 xml 읽어서 수치값을 적용한다.
		4. 나머지 최신 xml 아닌 것들은 모두 삭제 함 
		5. 이전 이력이 조회가 될 수 없으며 잘못된 최신 수치갑이 적용 되는 현상이 발생함
2. 변경 부분
	1. CISNEIS{Lite} 에서 CIS Reciever 에서 호출하면서 던진 Interface.xml 파일에 GUID 값을 가져와서 MatchedInfo.xml <GUID>추가하여 생성하도록 확인
		1. GUID 값이  CDW.xml 관련 GUID값과 같은지 확인 필요 
	2. LocalCDWExporter에서 MatchedInfo.xml에서 추가됝 <GUID> 값으로 CISReceiver에서 생성한 CDW.xml을 찾아서 처리 가능한지 확인
	3. LocalCDWExporter에서 MatchedInfo.xml에 대한 XML 찾는 로직 변경
		1. 최신의 XML 파일 찾는 부분 제거 -> GUID로 찾도록 변경
		2. 이후 다른 CDW.XML 파일을 삭제하는로직 제거 

## 강북삼성 예건 수치값 이슈 내용 도식화
1. ![Pasted image 20260720150705.png](/img/user/Pasted%20image%2020260720150705.png)
