---
{"dg-publish":true,"permalink":"/cis-viewer/","tags":["강북삼성","CISViewer","CIS","Workflow","프로시저","검사조회","분석"],"dg-note-properties":{"tags":["강북삼성","CISViewer","CIS","Workflow","프로시저","검사조회","분석"]}}
---

[[CIS 2.0/CIS 분석\|← CIS 분석 인덱스로]]

# 강북삼성 CISViewer 실행파일 인자값 호출에 따른 프로시저 호출 내용 정리

> 작성일: 2026-07-10
> 대상: `CIS_1400\trunk\Source\CISViewer` (CISViewer 2.0)
> 목적: patientID, ExamCode, OrderDate, Sequence, SPCID 를 실행파일 인자로 받아 검사조회 시 호출되는 workflow 와 DB 프로시저 정리
> 참고 프로시저 dump: 강북삼성 `ORACIS / ORAE1,ORAS1`

---

## 1. 실행 인자 형식 및 파싱

CISViewer 는 다음 형식의 **단일 명령행 문자열**을 받는다. (`CISViewer.cpp::InitInstance`)

```
G | ExamDate_Sequence_ExamCode_PatientID_SPCID | UserID | [UserPW] | ServerInfo | Run
```

- 최상위 구분자 `|` = `CALL_DELIMITER_SECTION`
- 두 번째 필드(주문정보)를 `_` (= `CALL_DELIMITER_VIEW_OLD`) 로 다시 분해
- 파싱 위치: `Common.cpp::GetCallParam()`

`CALLWAY_BY_1300 = 1` (기본값) 일 때 두 번째 필드 매핑:

| 인자            | enum           | 분해 인덱스 |
| ------------- | -------------- | :----: |
| **ExamDate**  | `callOldDate`  |  [0]   |
| **Sequence**  | `callOldSeq`   |  [1]   |
| **ExamCode**  | `callOldCode`  |  [2]   |
| **PatientID** | `callOldPid`   |  [3]   |
| **SPCID**     | `callOldSpcId` |  [4]   |

**예시**: `G|20150917_1_HU0251_12345678_092351|smc|smc12345`
→ Date=20150917, Seq=1, Code=HU0251, PID=12345678, SPCID=092351

---

## 2. 호출 Workflow (함수 흐름)

진입 처리 핸들러: `CISViewerDlg::MakeUIDCopyData()`

```
CISViewer.exe (InitInstance, 인자 파싱)
   └─ CISViewerDlg::MakeUIDCopyData()               ← 5개 인자 추출
        │  (5개 인자가 모두 존재 → 특정 검사 지정 조회)
        ├─ Pkg_GetCISKeyByEmrKey(Date,Seq,Code,Pid,SpcId → OCISKey, PID)   ★DB①
        ├─ g_LOADPID = PID ; g_LOADORDNO = OCISKey
        └─ SetTimer(TIMER_STANDBY_CONNECT_GETLSTEDITDT)
              └─ RetryGetAtOnceView(PID, OCISKey)
                    └─ WRetryGetAtOnceView()
                          └─ Pkg_GetAtOnceView()      ← 실제 조회 핵심
                                ├─ PkgOrder_GetLastDt()                     ★DB② 갱신확인
                                ├─ CRUZQuery_ExGetPatientInfo3(PID,OCISKey) ★DB③ 환자+검사+인스턴스 일괄
                                ├─ PkgExam_RelatedExamList(PID)             ★DB④ 관련검사 목록
                                ├─ StorageDwn_View()                        이미지 다운로드
                                └─ PkgMemo_GetOrderMemo() / 리포트 타이머     메모·판독
```

> 핵심은 **2단계 DB 접근**이다.
> ① EMR 키(5개 인자) → 내부 **OCISKey** 변환
> ③ OCISKey 로 검사 데이터 일괄 조회

---

## 3. 호출되는 DB 프로시저

DB 접근은 CRUZ 엔진(`m_DBClient.RequestQuery`)을 통한 저장 프로시저 호출이며, 각 `CRUZQuery_*` 클래스의 `PrepareQuery()` 가 프로시저명을 지정한다.

### ★DB① EMR 키 → OCISKey 변환 (가장 중요)

- 클래스: `CRUZQuery_GetCISKeyByEMRKey`
- 프로시저: **`PKGORDER.GetCISKeyByEMRKey`**
  - IN: pvItem1~5 = Date, Seq, Code, Pid, SpcID
  - OUT: `O_KEY` (= OCISKey), `PAT_ID`
- 동작(ORACIS dump 기준):
  - 디스패처가 `T_CUSTOMIZING` 에서 `PkgOrder.GetCISKeyByEMRKey` + `NONE` 의 `CM_VALUE` 조회
  - `'Y'` → **`PKGCUSTOM.GetCISKeyByEMRKey`** 호출, 아니면 내부 `OnGetCISKeyByEMRKey` 호출
  - 실제 쿼리: `t_Order o, t_OrderHistory oh, t_Patient pat` 조인, `O_OCSKey1~5 = Item1~5` 매칭 (현재 이력 `oh_enddt = 99991231235959`) → `O_Key`, `PAT_ID` 반환

> ⚠️ **강북삼성(KUMC) 특이사항**
> `PKGCUSTOM.GetCISKeyByEMRKey` 버전에서 5번째 조건 `O_OCSKey5 = SPCID` 이 **주석 처리**되어 있음
> → 주석 근거: `-- KUMC 요청으로 인한 제거 2016-03-28 skchoi`
> → 즉 강북삼성 커스텀 경로에서는 **SPCID 를 무시하고 Date / Seq / Code / PID 4개로만 검사를 식별**한다.
> 관련: [[강북삼성 CIS Viewer2.0 매칭 검사 조회 이슈\|강북삼성 CIS Viewer2.0 매칭 검사 조회 이슈]], [[강북삼성 CIS Viewer2.0 매칭 검사 조회 이슈 DB 조회\|강북삼성 CIS Viewer2.0 매칭 검사 조회 이슈 DB 조회]]

### ★DB② 갱신 확인 (로컬 캐시 유효성)

- 함수: `CISViewerDlg::PkgOrder_GetLastDt()`, 클래스 `CRUZQuery_GetOrderLastDt`
- 프로시저: **`PKGORDER.GetOrderLastDt`** (IN: OCISKey → OUT: `LastEditDt`)
- 로컬 DB `WORKLIST.LastModiDt` 와 서버 최종수정일 비교 → 동일하면 서버 재조회 없이 **로컬 캐시(LDB)** 사용
- 옵션: `USE_EXAM_UPDATE_CHECK` (기본 1)

### ★DB③ 검사 데이터 일괄 조회 (ExGetPatientInfo3 = 복합 쿼리)

- 클래스: `CRUZQuery_ExGetPatientInfo3(PatId, OCISKey)`
- 단일 프로시저가 아니라, CRUZ 서버 측 `CRUZPackage_EXTENDED::DR_ExGetPatientInfo3` 에서 **여러 프로시저를 순차 실행**하는 복합 쿼리:

| 순서 | 서브 쿼리 클래스 | 프로시저 | 입력 / 용도 |
|:---:|------|------|------|
| 1 | GetPatientInfo | **`PKGPATIENT.GetPatientInfo`** | PatId — 환자 인적정보 |
| 2 | GetWorklist4 | **`PKGWORKLIST.GetWorkList`** | OCISKey — 워크리스트/처방 |
| 3 | GetUserOrderAuthority | **`PKGSECURITY.GetUserOrderAuthority`** | OrdKey — 열람 권한 |
| 4 | GetExamByOCISKey2 | **`PKGEXAM.GetExamByOCISKey`** | OCISKey — 검사/스터디 |
| 5 | GetInstanceList2 | **`PKGINSTANCE.GetInstanceList`** | 검사별 인스턴스/이미지 목록 |
| 6 | GetExtraDataByCase | **`PKGINSTANCE.GetExtraDataByCase`** | NUMERIC 타입 시 수치 데이터 |

### ★DB④ 관련검사 목록

- 함수: `PkgExam_RelatedExamList(PID)` → StudyList 컨테이너 채움
- 옵션: `GET_RELATED_EXAM_ALWAYS` (기본 1)

---

## 4. 프로시저 존재 확인 (강북삼성 ORACIS dump)

| 프로시저 | dump 위치(라인) |
|------|:---:|
| PKGORDER.GetCISKeyByEMRKey | 25991 |
| PKGCUSTOM.GetCISKeyByEMRKey (커스텀) | 4982 |
| PKGORDER.GetOrderLastDt | 26238 |
| PKGPATIENT.GetPatientInfo | 26780 |
| PKGEXAM.GetExamByOCISKey | 7281 |
| PKGINSTANCE.GetInstanceList | 13053 |
| PKGINSTANCE.GetExtraDataByCase | 13340 |
| PKGSECURITY.GetUserOrderAuthority | 30574 |
| PKGWORKLIST.GetWorkList | 34388 |

---

## 5. 요약

- 5개 인자로 검사조회 시 **핵심 진입 프로시저는 `PKGORDER.GetCISKeyByEMRKey`** (EMR 키 → 내부 OCISKey 변환)
- 이후 **`ExGetPatientInfo3` 복합 쿼리가 PKGPATIENT / PKGWORKLIST / PKGSECURITY / PKGEXAM / PKGINSTANCE 프로시저를 연달아 호출**하여 환자·처방·검사·이미지·수치 데이터를 한 번에 로드
- **강북삼성 환경에서는 `PKGCUSTOM.GetCISKeyByEMRKey` 가 사용되며 SPCID 매칭 조건이 제거**되어 있어(2016-03-28), Date/Seq/Code/PID 4개로만 검사를 식별하는 것이 가장 주의할 커스터마이징

---

[[CIS 2.0/**CIS 분석**\|← CIS 분석 인덱스로]]
