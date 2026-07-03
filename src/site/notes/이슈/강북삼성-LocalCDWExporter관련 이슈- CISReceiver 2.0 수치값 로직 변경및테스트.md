---
{"dg-publish":true,"permalink":"//local-cdw-exporter-cis-receiver-2-0/","tags":["이슈","강북삼성","CIS분석","LocalCDWExporter","CDW","CISReceiver"],"dg-note-properties":{"tags":["이슈","강북삼성","CIS분석","LocalCDWExporter","CDW","CISReceiver"],"작성일":"2026-07-03"}}
---

# 강북삼성-LocalCDWExporter관련 이슈- CISReceiver 2.0 수치값 로직 변경 및 테스트

> [[HIE팀 이슈\|← 이슈 목록으로]]
> 관련 분석: [[이슈/강북삼성 LocalCDWExporter CDW 수치값 업로드 이슈 분석\|강북삼성 LocalCDWExporter CDW 수치값 업로드 이슈 분석]]

---

## 개요

| 항목 | 내용 |
|---|---|
| 대상 | CISReceiver 2.0 (CIS_1400) — CISLib 공유 라이브러리 |
| 목적 | 수치값이 없는 검사에 대해 CDW 패스/인터페이스 XML이 생성되지 않도록 로직 변경 |
| 배경 | 강북삼성 LocalCDWExporter `MoveNumCdwFiles failed: No matching MoveCDWDataFiles files found.` 이슈 |
| 작업일 | 2026-07-03 |

---

## 문제 요약

수치값이 없는 검사(이미지만 포함)에서도 CDW 옵션이 켜져 있으면:

1. `CDW\EXAMDATA\{GUID}\` **패스(폴더)가 생성**되고 (수치 XML 없음)
2. **인터페이스 XML(`{GUID}.xml`)도 항상 생성**되어

LocalCDWExporter가 이 빈 폴더를 LastWriteTime 최신 순으로 선택 → `MoveNumCdwFiles failed` 에러 발생.

---

## 근본 원인 (코드 레벨)

**파일**: `CIS_LIB_2008\CISLib\trunk\Source\CISModality\CISParser.cpp` — `IsCDWUploader()` 분기

```cpp
// 기존 (문제)
if(OnCISParser_GenerateNumericItem(ndCDW))
    CISInterfaceInfo2::CloningEx(...);   // 수치 있음
else
    CISInterfaceInfo2::Cloning(...);     // ★ 수치 없어도 패스 생성

// ★ 인터페이스 XML은 수치 여부와 무관하게 항상 저장
infoCDW.Save(...) → RenameFile(...)
```

- `Cloning()` 내부 `CISGF::CreateDir()`가 수치 유무와 무관하게 폴더를 무조건 생성
- 인터페이스 XML 저장이 if/else 바깥에 있어 항상 실행
- CIS 3.0 분기(else)는 수치 있을 때만 생성하는 올바른 패턴 → 두 모드 불일치

---

## 변경 내용

### 1차 변경 — CISParser.cpp (26/07/03 by dykim)

수치값이 있을 때만 CDW 처리 전체(패스 + 수치 XML + 인터페이스 XML)를 수행하도록 변경:

```cpp
if(OnCISParser_GenerateNumericItem(ndCDW) && ndCDW.m_NumData.GetCount())
{
    CISInterfaceInfo2::CloningEx(...);      // 패스 + 수치 XML
    infoCDW.Save(...) → RenameFile(...)     // 인터페이스 XML
}
// else: 아무것도 생성 안 함 → CDW 워크플로우 미발동
```

### 1차 테스트 결과 — ❌ 수치 있는 검사도 차단되는 문제 발견

| 시나리오 | 결과 |
|---|---|
| JPG만 (수치 없음) | ✅ CDW 생성 건너뜀 |
| DXA 골밀도 (수치 있음) | ❌ CDW 생성 안 됨 (`Before CDW Info Save` 로그 없음) |

**원인**: `m_NumData`는 **구버전** 컨테이너. Prodigy 파서는 `UseNewVersion(TRUE)` + `AddNumeric()`으로 수치를 **신버전 `m_Measurement` 트리**에 저장하므로 `m_NumData`는 항상 비어 있음.
또한 `GE_Prodigy_Parser::OnCISParser_GenerateNumericItem()`은 수치 유무와 무관하게 항상 TRUE 반환 → 반환값만으로 판단 불가.

### 2차 변경 — 신/구버전 모두 커버하는 헬퍼 추가

**① CISNDMeasurement.h** — 접근자 추가 (`m_Tree`가 protected라 외부 접근 불가했음):

```cpp
inline INT_PTR GetChildCount() const  {return m_Tree.GetChildCount();}
```

**② CISNDFile.h** — 수치값 존재 유무 판단 Help Method 추가:

```cpp
// 26/07/03 by dykim 수치값에 대한 값 존재유무 확인을 위한 Help Method 추가
inline BOOL HasNumericItem() const
{return m_bNewVer ? (m_Measurement.GetChildCount() > 0) : (m_NumData.GetCount() > 0);}
```

**③ CISNumericData.h** — C2662 빌드 오류 수정: `GetCount()`에 const 추가

```cpp
inline int GetCount() const {return (int)m_ITEMs.GetSize();};
```

**④ CISParser.cpp** — 조건을 `ndCDW.HasNumericItem()`으로 변경

---

## 최종 테스트 결과 (2026-07-03 16:44~16:46) ✅

로그: `CIS_1400\trunk\BIN\Win32\ReleaseUnicode\Log\Receiver\CIS Receiver_20260703.log`

### 테스트 1 — 골밀도 수치값 있음 (16:44:22, Prodigy DXA TXT+JPG)

```
CDW Part, bInterfaceCDW( TRUE )
CDW Part, IsCDWUploader() is True
Before CDW Info Save ( ...\CDW\56EE4DE7-....xml.tmp )
CDW Info Save Ok and Before RenameFile (.tmp → .xml)
```

→ ✅ 패스 + 수치 XML + 인터페이스 XML 정상 생성

### 테스트 2 — 수치값 없음 (16:46:06, Image Receiver JPG만)

```
CDW Part, bInterfaceCDW( TRUE )
CDW Part, IsCDWUploader() is True
(이후 "Before CDW Info Save" 로그 없음)
```

→ ✅ CDW 옵션이 켜져 있어도 산출물 전혀 생성 안 함 → 빈 폴더 이슈 원천 차단

### 결과 요약

| 시나리오 | 기대 동작 | 결과 |
|---|---|---|
| 수치값 있음 (DXA 골밀도) | CDW 폴더 + 수치 XML + 인터페이스 XML 생성 | ✅ |
| 수치값 없음 (이미지만) | CDW 산출물 미생성 | ✅ |

---

## 남은 확인 사항

- [ ] 파일 시스템에서 `CISModality\CDW\` 아래 테스트 2 시각의 산출물 부재 확인
- [ ] LocalCDWExporter 연동 End-to-End (업로드 성공) 확인
- [ ] "수치 없는 검사도 CDW에 이력 등록 필요" 요구사항이 병원에 있는지 사전 확인
- [ ] CISLib 공유 라이브러리 변경이므로 CIS 3.0 경로 영향 없음 재확인 (`IsCDWUploader()` 분기는 CIS_1400 모드에서만 실행)

---

## 관련 파일

| 파일 | 변경 |
|---|---|
| `CISLib\trunk\Source\CISModality\CISParser.cpp` | CDW 생성 조건 변경 + 로그 추가 |
| `CISLib\trunk\Include\CISNDFile.h` | `HasNumericItem()` 추가 |
| `CISLib\trunk\Include\CISNDMeasurement.h` | `GetChildCount()` 접근자 추가 |
| `CISLib\trunk\Include\CISNumericData.h` | `GetCount()` const 수정 |
