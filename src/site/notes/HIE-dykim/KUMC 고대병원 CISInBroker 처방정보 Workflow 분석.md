---
{"dg-publish":true,"permalink":"/hie-dykim/kumc-cis-in-broker-workflow/","tags":["KUMC","CISInBroker","EMR","CIS","처방정보","Workflow"],"dg-note-properties":{"tags":["KUMC","CISInBroker","EMR","CIS","처방정보","Workflow"],"created":"2026-06-26","project":"고대병원 CIS 연계"}}
---

[[CIS 2.0/CIS 분석\|CIS 분석]]
# 고대병원 CISInBroker 처방정보 Workflow 분석

> CISInBroker는 고대병원 EMR의 REST API를 주기적으로 폴링하여 신규 처방을 수신하고,  
> CIS Oracle DB에 저장한 뒤 처리 결과를 EMR에 다시 보고하는 **단방향 인바운드 브로커**입니다.

---

## 1. 처방정보 가져오는 Workflow 단계별 항목

### 전체 흐름

```
[EMR API 호출] → [데이터 파싱] → [CIS 검증/저장] → [EMR 결과 보고]
```

### 메인 루프 구조

```
Worker::RunInstance()
  └─ OrderRutine() / UserRutine()
      ├─ GetEmrOrder()         [EMR에서 처방 데이터 조회]
      ├─ GetEmrUser()          [EMR에서 사용자 데이터 조회]
      └─ SetOrder() / SetUser() [CIS DB에 데이터 저장]
          └─ UpdEmrOrder()      [EMR에 처리 결과 보고]
```

### 단계별 항목

| # | 단계 | 방향 | API / 처리 | 핵심 동작 |
|---|------|------|-----------|----------|
| 1 | 처방 조회 | EMR → CIS | `GET /szi/cis/infinitt/ordr/new` | 신규 처방 목록 수신 |
| 2 | 부서 검증/등록 | CIS DB | `IsExistDepartment` / `SetDeptCode` | 부서 없으면 생성 + 47개 권한 자동 부여 |
| 3 | 검사코드 검증/등록 | CIS DB | `IsExistExamCode` / `SetExamCode` | 처방 검사코드 없으면 생성 |
| 4 | 환자 검증/등록 | CIS DB | `IsExistPatient` / `SetPatient` | 4개 항목(ID·이름·생년월일·성별) 완전 일치 확인 |
| 5 | 의사 검증/등록 | CIS DB | `IsExistUser` / `SetUser` | 없으면 임시 의사 계정 생성 |
| 6 | 처방 저장 | CIS DB | `PkgOrder.SetOrder` (Oracle 프로시저) | CIS DB에 처방 최종 저장 |
| 7 | 결과 보고 | CIS → EMR | `POST /szi/cis/infinitt/ordr/prss` | 처리 결과 S(성공) / F(실패) 보고 |
| 8 | 사용자 동기화 | EMR → CIS | `GET /user/new` + `POST /user/prss` | 직원 정보 주기적 동기화 |

### 처리 주기

- 사용자 / 처방 데이터 있을 때 → 즉시 재처리 (처방은 3초 후)
- 데이터 없을 때 → **5초 대기**

---

## 2. EMR ↔ CIS 식별 키값 및 처방정보 필드

### 2-1. 처방 수신 API 응답 필드 전체

API: `GET /szi/cis/infinitt/ordr/new`

| EMR JSON 필드 | CIS 내부 변수 | 설명 | 키 여부 |
|--------------|-------------|------|:-------:|
| `cisLnkgNo` | `m_AccessNo` | **CIS 링크번호** — EMR이 CIS에 부여한 연계번호 | ★★ 핵심 연계 Key |
| `cisSno` | `m_EmrKey` | **EMR 처방 일련번호** — 결과 보고 시 사용 | ★ EMR PK |
| `ptno` | `m_Patient.m_PatID` | 환자 ID (병원 등록번호) | ★ 환자 식별 |
| `ptntNm` | `m_Patient.m_PatName` | 환자 이름 | |
| `btdt` | `m_Patient.m_PatBirth` | 생년월일 (YYYYMMDD) | |
| `gendCd` | `m_Patient.m_PatSex` | 성별 코드 | |
| `dprtCd` | `m_DeptCode` | 부서 코드 | |
| `dprtNm` | `m_DeptName` | 부서 명 | |
| `ordrCd` | `m_ExamCode` | 처방/검사 코드 | |
| `ordrNm` | `m_ExamName` | 처방/검사 명 | |
| `ordrYmd` | `m_OrderDT` | 처방 일시 (YYYYMMDDHHMMSS) | |
| `rptnDt` | `m_RegDT` | 등록/보고 일시 (필수값) | |
| `exorPrssCd` | `m_OrderState` | 처방 상태 코드 | |
| `oddrId` | `m_DoctorID` | 처방 의사 ID | |

### 2-2. EMR-CIS 처방 동일 식별 핵심 키

```
EMR: cisLnkgNo  ←→  CIS: AccessNo (m_AccessNo)
```

- `cisLnkgNo`: EMR이 처방 생성 시점에 CIS에 부여한 연계번호. **양쪽 시스템이 동일 처방임을 확인하는 핵심 식별자**
- `cisSno`: EMR 내부 처방 일련번호. CIS 저장 후 EMR에 처리 결과를 보고할 때(`UpdEmrOrder`) 사용

### 2-3. EMR 결과 보고 시 사용하는 필드

API: `POST /szi/cis/infinitt/ordr/prss`

```json
{
  "cisSno": "{EMR 처방 일련번호}",
  "cisWodvCd": "S 또는 F"
}
```

| 값 | 의미 |
|----|------|
| `S` | Success — CIS 저장 성공 |
| `F` | Fail — CIS 저장 실패 |

---

## 3. 가져오는 정보 종류 정리

### 3-1. 처방 정보 (Order) — EMR → CIS

- EMR REST API를 **주기적 폴링**하여 신규 처방 수신
- 처방 코드/명, 부서, 환자정보, 의사 ID, 처방 상태, 처방 일시 포함
- CIS Oracle DB(`PkgOrder.SetOrder`)에 저장
- 처리 결과를 EMR에 재보고

**CIS DB 저장 파라미터 (`PkgOrder.SetOrder`)**

| 파라미터 | 값 출처 | 설명 |
|---------|--------|------|
| `pvItem1` | `m_AccessNo` | 접근번호 (CIS 링크번호) |
| `pvDeptCode` | `m_DeptCode` | 부서 코드 |
| `pvExCode` | `m_ExamCode` | 검사 코드 |
| `pvPatId` | `m_Patient.m_PatID` | 환자 ID |
| `pvOrdDt` | `m_OrderDT` | 처방 일시 (YYYYMMDDHHMMSS) |
| `pvRegDt` | `m_RegDT` | 등록 일시 (필수) |
| `pvAttendDocId` | `m_DoctorID` | 담당의 ID |
| `pvEmerFlag` | `"N"` | 응급 여부 (기본값 N) |
| `pvOrdStat` | `m_OrderState` | 처방 상태 |

### 3-2. 사용자 정보 (User) — EMR → CIS

API: `GET /szi/cis/infinitt/user/new`

| EMR JSON 필드 | 설명 |
|--------------|------|
| `rltnInfmKeyVl` | 관계정보 키 값 (EMR 직원 고유 ID) — CIS `m_EmrKey`로 저장 |
| `lginId` | 로그인 ID |
| `userNm` | 사용자 명 |
| `dprtCd` | 부서 코드 |
| `userSttsCd` | 재직 상태 코드 |

**재직 상태 변환 (EMR → CIS)**

| EMR 값 | EMR 의미 | CIS 값 | CIS 의미 |
|--------|---------|--------|---------|
| `0` | 재직 | `0` | 근무중 |
| `8` | 휴직 | `1` | 휴직 |
| `9` | 퇴직 | `2` | 퇴직 |
| 기타 | — | `0` | 근무중 (기본값) |

### 3-3. 검사 결과 정보 (OutBroker) — CIS → EMR (역방향)

API: `POST /szi/cis/infinitt/exmn/rslt`

| 필드 | 설명 |
|------|------|
| `cisLnkgNo` | CIS 링크번호 |
| `ptno` | 환자 ID |
| `cisWodvCd` | 작업 코드 |
| `emprId` | 시행자 ID |
| `eqpmCd` | 장비 코드 |
| `exrsCtn` | 검사 결과 텍스트 |
| `rsltTrasDt` | 결과 전송 일시 |

**작업 코드 (cisWodvCd)**

| 코드 | 의미 |
|------|------|
| `1` | 일치 (Match) |
| `2` | 재일치 / 추가일치 (ReMatch / AddMatch) |
| `3` | 일치 취소 (Match Cancel) |
| `4` | 보고서 작성 (Report Create) |
| `5` | 보고서 삭제 (Report Delete) |
| `6` | 임시 보고서 (Temporary Report) |

---

## 4. 종합 요약 표

### 4-1. Workflow 단계 요약

| # | 단계 | 방향 | API / 처리 | 핵심 동작 |
|---|------|------|-----------|----------|
| 1 | 처방 조회 | EMR → CIS | `GET /ordr/new` | 신규 처방 목록 수신 |
| 2 | 부서 검증/등록 | CIS DB | `IsExistDepartment` / `SetDeptCode` | 부서 없으면 생성 + 47개 권한 부여 |
| 3 | 검사코드 검증/등록 | CIS DB | `IsExistExamCode` / `SetExamCode` | 처방 검사코드 없으면 생성 |
| 4 | 환자 검증/등록 | CIS DB | `IsExistPatient` / `SetPatient` | 4개 항목 완전 일치 확인 |
| 5 | 의사 검증/등록 | CIS DB | `IsExistUser` / `SetUser` | 없으면 임시 의사 계정 생성 |
| 6 | 처방 저장 | CIS DB | `PkgOrder.SetOrder` (Oracle) | CIS DB에 처방 최종 저장 |
| 7 | 결과 보고 | CIS → EMR | `POST /ordr/prss` | 처리 결과 S(성공) / F(실패) 보고 |
| 8 | 사용자 동기화 | EMR → CIS | `GET /user/new` + `POST /user/prss` | 직원 정보 주기적 동기화 |

### 4-2. EMR-CIS 식별 키 요약

| 구분 | 필드명 | 역할 | 비고 |
|------|--------|------|------|
| **처방 연계 핵심키** | `cisLnkgNo` | EMR-CIS 동일 처방 식별 | CIS가 `AccessNo`로 저장 |
| **EMR 처방 일련번호** | `cisSno` | EMR 내부 PK, 결과 보고 시 사용 | EMR 측 식별자 |
| **환자 식별** | `ptno` | 병원 환자 등록번호 | 양측 공통 사용 |
| **사용자 식별** | `rltnInfmKeyVl` | EMR 직원 고유 ID | CIS `EmrKey`로 저장 |

### 4-3. 처방 데이터 필드 카테고리별 요약

| 카테고리 | EMR 필드 | 설명 |
|---------|---------|------|
| **연계 키** | `cisLnkgNo`, `cisSno` | 처방 식별 키 (핵심) |
| **환자** | `ptno`, `ptntNm`, `btdt`, `gendCd` | 환자 기본정보 |
| **처방** | `ordrCd`, `ordrNm`, `ordrYmd`, `exorPrssCd` | 처방 내용 및 상태 |
| **부서/의사** | `dprtCd`, `dprtNm`, `oddrId` | 처방 발생 부서 및 의사 |
| **시간** | `rptnDt` | 등록/보고 일시 |

---

## 5. 시스템 연계 구성

```
[고대병원 EMR]
    │
    │  REST API (JSON)
    │  x-ncp-apigw-api-key 인증 (NCP API Gateway)
    │
[CISInBroker] ──── Oracle OLE DB ────► [CIS Oracle DB]
    │                                    PkgOrder.SetOrder
    │                                    PkgPatient.SetPatientInfo_SMC
    │                                    PkgUser.SetUserInfo_SMC
    │
    └─ [CISOutBroker] ──► POST /exmn/rslt ──► [EMR] (검사결과 역전송)
```

**인증 정보**

| 항목 | 값 |
|------|---|
| API Gateway | NCP (Naver Cloud Platform) |
| 헤더 | `x-ncp-apigw-api-key` |
| CIS DB | Oracle (`OraOLEDB.Oracle.1`) |
| 기본 SID | `orcl` |
| 기본 DB 계정 | `cis2011` |

---

> **분석 일자:** 2026-06-26  
> **분석 대상:** `D:\KUMC\ANAM\CIS_SI\고대병원\CISInBroker\`  
> **관련 소스:** `Worker.cpp`, `CISInBrokerConfig.h`, `ConfigManager.h`
