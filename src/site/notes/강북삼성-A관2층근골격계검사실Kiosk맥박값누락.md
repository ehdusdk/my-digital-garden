---
{"dg-publish":true,"permalink":"/a-2-kiosk/","tags":["CISKiosk","강북삼성","버그분석"],"dg-note-properties":{"tags":["CISKiosk","강북삼성","버그분석"],"created":"2026-06-30"}}
---


# 강북삼성 A관 2층 근골격계검사실 Kiosk 맥박값 누락

> **관련 노드:** [[CIS 2.0/CIS 분석\|CIS 분석]]

---

## 1. 이슈 개요

| 항목 | 내용 |
|------|------|
| 병원 | 강북삼성병원 |
| 위치 | A관 2층 근골격계검사실 |
| 장비 | A&D TM-2655P (혈압계) |
| 증상 | 검사결과 DB 전송 시 맥박(Pulse) 값이 DB에 저장되지 않거나 0으로 입력됨 |
| 소스 경로 | `D:\Proj\CISKiosk\source\Programs\강북삼성` |
| 설정 파일 경로 | `C:/INFINITT/CISKioskU/DatabaseScript/` , `C:/INFINITT/CISKiosk/DatabaseScript/` |

---

## 2. 관련 설정 파일

| 파일 | 역할 |
|------|------|
| `DatabaseScript/1AB45860-E72A-46d6-AFF9-9B5CC998366A.xsl` | DB 전송 파라미터 매핑 (XSL 변환) |
| `DisplayScript/1AB45860-E72A-46d6-AFF9-9B5CC998366A.xsl` | 화면 표시 값 매핑 |
| `Page/PageStep4.xml` | 결과 표시 화면 (환자 인식 성공) |
| `Page/PageStep5.xml` | 결과 표시 화면 (진료번호 미등록) |

---

## 3. 데이터 흐름

```
장치 RS232 RAW 데이터 (.dat)
    ↓  AND_TM2655P_Parser::OnCISNumericParser_Parsing()
INFINITT_CIS XML (Pulse 노드 포함)
    ↓  WRXml::ConvertXSLT(xml, DatabaseScript.xsl)
KIOSK_DATABASE_QUERY XML (m_xmlDBSendData) → 파라미터 값 확정
    ↓  DatabaseScriptParser::Procedure_SetParam()
DB 프로시저 호출 (PC_PREMET_INF_UPDATE / PC_DMBEST_UPDATE)
```

---

## 4. 근본 원인: `Pluse` 오타

### 4-1. 문제 위치

**DatabaseScript XSL** 및 **DisplayScript XSL** 내 XPath에서 `Pulse` 를 `Pluse` (오타)로 기술:

```xml
<!-- 오타: Pluse -->
<Param direction="in" type="varchar2" name="InPulse"
  value="{INFINITT_CIS/Measurement/item[@name='TONOMETER']/item[@name='Pluse']/@value}"/>
```

### 4-2. 파서 코드의 실제 저장 키

**`AND_TM2655P.cpp:188`** 에서 XML에 저장할 때는 올바른 `"Pulse"` 를 사용:

```cpp
num.AddNumeric(hTonometer, _T("Pulse"), _T("INT"), strPulse, _T("bpm"), strPulse);
// 주석 원문(인코딩 깨짐): 강북삼성 Pulse인데 Pluse로 설정되어 있어
//                          혹시 일치하게되면 설정 파일도 모두 바꿔야
```

### 4-3. 결과

| 단계 | 키 이름 | 결과 |
|------|---------|------|
| 파서가 XML에 저장 | `Pulse` (정상) | ✓ 저장됨 |
| DatabaseScript XSL이 읽을 때 | `Pluse` (오타) | ✗ 매칭 실패 → 빈값 |
| DB 프로시저 `InPulse` 수신 | 빈값 `""` | DB에 0 또는 NULL 저장 |

---

## 5. 외래 / 병동 프로시저 구분

두 Kiosk 가 서로 **다른 프로시저**를 호출하며, **두 XSL 모두 `Pluse` 오타** 보유.

| 구분 | 경로 | 프로시저 | 파라미터 차이 |
|------|------|---------|--------------|
| 병동 | `CISKiosk/DatabaseScript/` | `PC_PREMET_INF_UPDATE` | InPatno, InHeight, InWeight, InBldpress, InBldpress2, InPulse, InGubun, IoErrMsg |
| 외래 | `CISKioskU/DatabaseScript/` | `PC_DMBEST_UPDATE` | 병동 파라미터 + **InBodytemp, InHeadgir, InFbs, InPp2hr** 추가 |

---

## 6. Raw 데이터 파일 분석

파일: `CISRS232Receiver_20260604153444_03FCE990_7mkjdx8o_00000a3b.dat`

```
└┌r00↑ TM2655 2606041532 ABME00 S116 M 86 D 60 P 89 100 L143 ...
```

| 필드 | 값 | 비고 |
|------|-----|------|
| `TM2655` | — | 파서 헤더 탐지 기준 ✓ |
| `S116` | SYS = 116 | 수축기 |
| `M 86` | MAP = 86 | 평균혈압 (파서에서 무시) |
| `D 60` | DIA = 60 | 이완기 |
| `P 89` | Pulse = **89** | 맥박 — 파서 정상 추출 확인 |

파서의 `"TM2655"` 헤더 탐지 및 `S/D/P` 값 추출은 이 장비 포맷에 정상 동작함.

---

## 7. 추가 발견된 코드 버그

**`AND_TM2655P.cpp:195-201`** — 파싱 실패 시에도 항상 `TRUE` 반환:

```cpp
catch(...)
{
    bReturn = FALSE;  // 실패 설정
}
// ...
return TRUE;  // ← bReturn 무시하고 항상 TRUE 반환 (버그)
```

파싱이 실패해도 상위 코드에서 오류를 감지하지 못함.

---

## 8. 수정 방법 (방법 A 권장)

### 수정 대상 파일 (총 4개)

```
C:/INFINITT/CISKiosk/DatabaseScript/1AB45860-E72A-46d6-AFF9-9B5CC998366A.xsl  ← 병동
C:/INFINITT/CISKioskU/DatabaseScript/1AB45860-E72A-46d6-AFF9-9B5CC998366A.xsl ← 외래
C:/INFINITT/CISKiosk/DisplayScript/1AB45860-E72A-46d6-AFF9-9B5CC998366A.xsl
Page/PageStep4.xml
Page/PageStep5.xml
```

### 수정 내용

```xml
<!-- 변경 전 -->
item[@name='Pluse']

<!-- 변경 후 -->
item[@name='Pulse']
```

DisplayScript XSL은 3곳, DatabaseScript XSL은 각 1곳씩 수정.

---

## 9. 로그를 통한 검증 방법

### 정상 로그 예시 (2026-06-30)

```
PARAM 01 : InPatno   = 82299932
PARAM 04 : InBldress  = 136
PARAM 05 : InBldress2 = 98
PARAM 06 : InPulse    = 64       ← 값이 있으면 XSL 정상
PARAM 07 : InGubun    = 2
PARAM 08 : IoErrMsg   = 0        ← 프로시저 성공
```

`InPulse` 값이 빈값(`= `)으로 출력되면 XSL `Pluse` 오타 미수정 상태.

---

## 10. 로그 추가 권장 위치

| 우선순위 | 파일 | 줄 | 목적 |
|---------|------|----|------|
| **1순위** | `DatabaseScriptParser.cpp` | **63줄 직후** | XSL에서 읽힌 InPulse raw 값 확인 |
| **2순위** | `DatabaseScriptParser.cpp` | **72줄 직후** | 치환 후 최종 값 확인 |
| **3순위** | `CISKioskDlg.cpp` | **1134줄 직후** | SetParam 완료 후 프로시저명 확인 |

```cpp
// DatabaseScriptParser.cpp 63번 줄 직후 추가 예시 (미적용)
strValue = WRXml::GetAttributeText2(pNode, _T("value"));
// ↓ 로그 추가 예정 위치
// SetLog_DebugInfo(cis_log_category_CIS,
//     CISGF::FormatString(_T("[ParamCheck] name=%s value=%s"), strName, strValue));
```

---

## 11. 향후 확인 사항

- [ ] 병동 XSL `Pluse` → `Pulse` 수정 적용
- [ ] 외래 XSL `Pluse` → `Pulse` 수정 적용
- [ ] DisplayScript XSL 3곳 수정
- [ ] PageStep4.xml / PageStep5.xml 수정
- [ ] DB 프로시저 `PC_DMBEST_UPDATE` 내부에서 `InPulse` 처리 로직 확인 (DB 담당자)
- [ ] `AND_TM2655P.cpp` `return TRUE` 버그 수정 검토
