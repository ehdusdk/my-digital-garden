---
{"dg-publish":true,"dg-permalink":"260723-localcdwexporter-resvale-issue","permalink":"/260723-localcdwexporter-resvale-issue/","tags":["이슈","강북삼성","CIS분석","LocalCDWExporter","CISReceiver","CISNEISLite","CISNEIS","CDW","GUID"],"dg-note-properties":{"tags":["이슈","강북삼성","CIS분석","LocalCDWExporter","CISReceiver","CISNEISLite","CISNEIS","CDW","GUID"],"작성일":"2026-07-23T00:00:00.000Z"}}
---

> [[HIE팀 이슈\|← 이슈 목록으로]]
> 관련 분석: [[이슈/강북삼성 LocalCDWExporter CDW 수치값 업로드 이슈 분석\|강북삼성 LocalCDWExporter CDW 수치값 업로드 이슈 분석]]
> 선행 작업: [[이슈/강북삼성-LocalCDWExporter관련 이슈- CISReceiver 2.0 수치값 로직 변경및테스트\|CISReceiver 2.0 수치값 로직 변경 및 테스트]]

---
##김도연 결론
1. CIS Receiver 에서 CISNEIS(Lite) 인터페이스를 위한  xml 파일에서 GUID 값을 CISNEIS에서 가지고 있음
   ![Pasted image 20260723171936.png](/img/user/%EC%9D%B4%EC%8A%88/Pasted%20image%2020260723171936.png) 
2. 이 GUID 값은 CIS Receiver에서 생성한 CDW 수치값에 대한 인터페이스 XML 파일명으로 저장되어 있음
![Pasted image 20260723172023.png](/img/user/%EC%9D%B4%EC%8A%88/Pasted%20image%2020260723172023.png)   
![Pasted image 20260723172101.png](/img/user/%EC%9D%B4%EC%8A%88/Pasted%20image%2020260723172101.png)
 
3. CISNEIS(Lite) 매칭 시에  MatchedInfo.xml에 "CDWGUID" 노드를 추가하도록 함
![Pasted image 20260723172446.png](/img/user/%EC%9D%B4%EC%8A%88/Pasted%20image%2020260723172446.png)   
![Pasted image 20260723172545.png](/img/user/%EC%9D%B4%EC%8A%88/Pasted%20image%2020260723172545.png)   
   
4. LocalCDWExporter에서는 CDW 관련 XML 경로를 이미 알고 있으므로  MatchedInfo.xml에 추가된 "CDWGUID" 노드 값으로 수치값 XML을 위치를 찾을수 있음 
	1. "CDWGUID값_CDW.xml" 파일을 LocalCDWExporter에서 찾으면 됨
	2. LocalCDWExporter 설정 XML 
	   ![Pasted image 20260723173026.png](/img/user/%EC%9D%B4%EC%8A%88/Pasted%20image%2020260723173026.png)
5. 캡처 이미지 설명
	1. CISNEIS(Lite) 를 위한 인터페이스 XML 생성 경로 예제 및 XML 파일 내부 내용 캡처
	2. CISNEIS(Lite) 매칭시에 생기는 XML 내용 캡처 
6. LocalExporter 변경 로직
	1. 최신 MatchedInfo.XML을 찾는게 아니라 MatchedInfo.xml에 있는 "CDWGUID" 값으로 매칭되는 CDW XML 경로를 찾아서 수치값을 API 호출 한다. 
   
## 개요

| 항목 | 내용 |
|---|---|
| 대상 병원 | 강북삼성병원 |
| 이슈 | LocalCDWExporter 수치값 **누락** 및 **다른 환자에 연동(오연동)** 되는 현상 |
| 대상 프로그램 | CISReceiver 2.0, CISNEISLite, CISNEIS, LocalCDWExporter(KBBroker) |
| 대상 장비 | InBody BSM-330 (신장/체중), Prodigy DXA 등 CDW 수치 장비 |
| 문의/분석일 | 2026-07-23 |
| 대표 케이스 | 박은영 환자(PID `03323759`) — CIS 입력값과 다른 값 전송, 재측정분 누락 |

---

## 결론 요약

- **누락과 오연동이 모두 하나의 구조적 원인에서 발생.** LocalCDWExporter가 환자↔수치 폴더를 **"처리 시점에 LastWriteTime이 가장 최신인 폴더"** 라는 시간 순서만으로 페어링하고, 나머지 폴더는 **백업 없이 영구 삭제** + 처리 후 **EXAMDATA 루트 전체 청소**를 수행하기 때문.
- 측정 데이터 자체가 **무기명**(환자 ID 없음: 파서 출력 `{Empty}^{Empty}^20260707`) 이라, 환자 연결은 오직 NEIS(Lite) 매칭 + Exporter의 "최신 폴더" 추측으로만 이루어짐.
- **해결책**: 매칭 시 CISNEISLite/CISNEIS가 `MatchedInfo.xml`에 **CDW GUID**를 실어주고, LocalCDWExporter는 최신 폴더 추측 대신 **GUID로 `EXAMDATA\<GUID>` 폴더를 직접 선택** + 삭제 로직 제거.

---

## 처리 워크플로우 (소스 확인)

```
[InBody BSM-330] ──RS232──> CISReceiver
  ① CISRS232Receiver 수신 → Receiving\...dat
  ② CISParser 파싱
     - Output XML 생성 (환자정보 없음: {Empty}^{Empty}^YYYYMMDD)
     - CDW 파트: CreateGUID() → EXAMDATA\<GUID>\ (수치) + EXAMDATA\<GUID>.xml (정보)
     - 인터페이스 XML → CIS_Lite\Data\Interface\ (NEIS(Lite)용)
  ③ LocalTrans() → "Transfer the data to local" + WM_COPYDATA(NEIS_CALL)
[CISNEISLite / CISNEIS] 간호사 매칭 → MatchedInfo_<시각>.xml (ACCN/PID/ExamCode/DeptCode)
[LocalCDWExporter] MatchedInfo + "EXAMDATA 최신 폴더" 페어링 → XSLT 변환 → EMR API 전송
```

근거:
- GUID 생성: `CISLib\...\CISModality\CISParser.cpp` — `m_CDW.m_ContentGUID = CISGF::CreateGUID()`
- 로컬 통지: `CISReceiver\CISReceiver.cpp` `LocalTrans()` — 로그의 "Transfer the data to local" / "Success to execute the external application"
- Exporter 페어링/삭제: `KBBroker\...\LocalCDWExporter\LocalCDWExportRoutine.cpp`

---

## 근본 원인 (코드 레벨)

파일: `CIS_SI\강북삼성병원\2024-new-interface\KBBroker\trunk\source\LocalCDWExporter\LocalCDWExportRoutine.cpp`

1. `MoveCDWDataFiles()`가 환자 정보(AccNo/PatId)를 인자로 받지만 **사용하지 않음** → `SelectLatestFolderByLastWrite_AndDeleteOthers()` 호출.
2. `SelectLatestFolderByLastWrite_AndDeleteOthers()` — 폴더 2개 이상이면 **최신 1개만 남기고 전부 영구 삭제**("Deleted old CDW folder" 로그).
3. `MoveCDWDataFiles()` 5단계 — 이동 후 **EXAMDATA 루트 전체 청소**(`ClearDirectoryContents`) → 처리 중 새로 생긴 측정도 삭제(race).

> "측정 순서와 매칭 순서가 1:1로 엇갈릴 때마다" 누락/오연동 발생.

---

## 대표 케이스 — 박은영 (PID 03323759)

| 시각 | 이벤트 | 값 |
|---|---|---|
| 11:11:38 | 1차 측정 (EXAMDATA\CCE13A96…) | 46.1 |
| 11:12:14 | 2차 측정 (EXAMDATA\6BAFD449…) | 46.0 |
| 11:12:26 | Exporter 처리: `Deleted old CDW folder: CCE13A96…` → 최신(6BAFD449) 선택·전송 | **46.0 전송, 46.1 유실** |
| 11:13:27 | 재매칭 (MatchedInfo 생성) | — |
| 11:13:29 | `MoveCDWDataFiles failed: No subfolders found` | **전송 누락** |

- 포스트잇 메모 "2번 찍고 누락됨"과 정확히 일치.
- 46.1(1차) 백업 없이 삭제 → 감사·복구 불가. 삭제 폴더가 박은영 것이 아닌 타 환자(매칭 안 한 "공문수 CIS X")였다면 그대로 오연동.
- "CIS 입력값과 다름": Exporter는 CIS DB가 아니라 **장비 원본(EXAMDATA)** 값을 EMR로 전송하므로, 간호사가 CIS에 수기 수정한 값은 EMR에 반영되지 않음.

---

## 정상 vs 실패 조건

- **정상(측정 1회 → 매칭 1회)**: 후보 폴더가 1개뿐이라 "최신 = 유일" → 삭제·루트청소가 무해하게 통과. 로직이 옳아서가 아니라 **경합이 없어서** 성공.
- **실패(측정 2회 이상 대기)**: 재측정/연속측정/매칭 지연 시마다 최신 폴더만 전송되고 나머지 삭제 + 루트청소로 후속 매칭 누락.

---

## 해결 방향 (GUID 기반 페어링)

측정↔수치 연결을 시간이 아니라 **GUID로 고정**. GUID는 파서에서 생성되어 인터페이스 XML(`cdwguid`)을 통해 NEIS(Lite)까지 전달되므로 기술적으로 즉시 구현 가능.

### 1) CISNEISLite (경미)
- `CISNEISLiteDlg.cpp` `OnBnClickedMatch()` — MatchedInfo XML에 선택 검사의 `m_CdwGuid`를 `<CDWGUID>` 반복 노드로 추가. (데이터는 `NEISLite_Exam::m_CdwGuid`에 이미 존재)

### 2) CISNEIS (신규 이식)
- CISNEIS는 현재 MatchedInfo를 **생성하지 않음**(`m_strLocalExportPath`만 존재, 미사용) → CISNEISLite와 동일 포맷으로 생성 로직 이식.
- 매칭 성공 지점: `NEISDlg.cpp` `SetMatchFlowEx()` 의 "성공했으면 HISTORY에 저장" `if(bResult)` 블록.
- **CDWGUID 값 출처**: `pExamData->m_GUID` (= `CRUZResult_GetExam::m_GUID`, CDW ContentGUID). `arCOPY`를 순회하며 검사별 `<CDWGUID>` 기록.

### 3) LocalCDWExporter (공통 소비자)
- `ParseMatchedInfo()` — `<CDWGUID>` 파싱 추가(없으면 fallback).
- `MoveCDWDataFiles()` — GUID로 `EXAMDATA\<GUID>` 폴더 직접 선택(미존재 시 N회 재시도). `<GUID>.xml` 짝 파일도 Backup2 이동.
- 삭제 로직 2곳 제거: ① `SelectLatest...`의 타 폴더 삭제 봉인, ② 5단계 EXAMDATA 루트 청소 제거.
- 고아 폴더는 즉시 삭제 대신 나이 기반 quarantine 이동(감사 추적 확보).

---

## CISNEIS 반영 시 확인된 이슈 — `pExamData->m_GUID`가 빈 값

`SetMatchFlowEx()`에 CDWGUID 추가 코드를 넣었으나 로그상 skip됨.

- **`pExamData`는 null 아님** — `arCOPY.GetAt(i)`로 채워지며(6583행), 직후 `pExamData->IsLocalData()` 정상 실행. `arCOPY.Copy(arEXAM)`는 포인터 배열 복사라 GUID 유실 아님. → **실제로는 `m_GUID`가 빈 값**.
- **`m_GUID`는 맞는 필드** — `CRUZResult_GetExam.h` "CDW 시스템과 연동하기 위한 GUID 값", InBody 수신 시 `m_CDW.m_ContentGUID`로 저장되는 EXAMDATA\<GUID>와 동일 값.
- **빈 이유 = 검사 로드 단계에서 안 채워짐**:
  - 로컬(MDB): `NEISMDBHelper::GetExam()`이 **`m_bCDW == TRUE`** 일 때만 ContentGUID 로드. `m_bCDW`는 로컬 MDB `TBL_STUDY`에 `ContentGUID` 컬럼이 있어야 자동 TRUE.
  - 서버(CRUZ): `CRUZResult_GetExam.cpp` — `CIS_USE_CDW_PROTOCOL` 정의 **+ 프로토콜 버전 `V01000002`(또는 은평 빌드)** 일 때만 m_GUID 직렬화 전송.

### 진단 방법
MatchedInfo 생성 직전 `arCOPY` 전수 순회로 `ExKey / IsLocalData / m_GUID` 로그 출력 → 로컬(컬럼/m_bCDW) 문제인지 서버(프로토콜 버전) 문제인지 판별. 서버 프로토콜 버전 미스가 가장 유력.

---

## 남은 확인 사항

- [ ] 강북삼성 운영 프로그램이 CISNEISLite인지 CISNEIS인지 확정 (로그·MatchedInfo 파일상 CISNEISLite로 추정)
- [ ] CISNEIS 서버/클라이언트 프로토콜 버전(V01000002) 및 `CIS_USE_CDW_PROTOCOL` 빌드 일치 확인
- [ ] Backup2\20260707\6BAFD449 원본으로 박은영 측정 여부 대조, error 폴더 MatchedInfo_20260707111327.xml(누락분) 확인
- [ ] LocalCDWExporter 삭제 로직 제거 + GUID 페어링 반영 및 E2E 테스트
- [ ] 병원 EMR이 같은 cisLnkgNo 재전송을 마지막 값으로 덮어쓰는지 확인(46.1→46.0)

---

## 관련 파일

| 파일 | 관련 |
|---|---|
| `KBBroker\...\LocalCDWExporter\LocalCDWExportRoutine.cpp` | 페어링/삭제 로직 (핵심) |
| `CISNEISLite\CISNEISLiteDlg.cpp` `OnBnClickedMatch()` | MatchedInfo에 CDWGUID 추가 |
| `CISNEIS\NEISDlg.cpp` `SetMatchFlowEx()` | MatchedInfo 생성 이식 + CDWGUID |
| `CISNEIS\NEISMDBHelper.cpp` `GetExam()` | m_bCDW 조건부 ContentGUID 로드 |
| `CRUZ\CRUZResult_GetExam.cpp` | 서버 m_GUID 직렬화(프로토콜 버전 조건) |
| `CISLib\...\CISModality\CISParser.cpp` | CDW GUID 생성 |

## 관련 이슈

- [[260812-강북삼성화성건진-혈압,청력수치값 이슈\|강북삼성 화성건진 혈압·청력 수치값 이슈]]
- [[260812-강북화성-LocalCDWExporter수치값 이슈\|2026-08-12 통합 분석]]
