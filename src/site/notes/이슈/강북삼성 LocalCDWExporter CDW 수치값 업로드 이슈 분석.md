---
{"dg-publish":true,"permalink":"//local-cdw-exporter-cdw/","tags":["이슈","강북삼성","CIS분석","LocalCDWExporter","CDW"],"dg-note-properties":{"tags":["이슈","강북삼성","CIS분석","LocalCDWExporter","CDW"]}}
---

> [[HIE팀 이슈\|← 이슈 목록으로]]

---

## 개요

| 항목 | 내용 |
|---|---|
| 대상 병원 | 강북삼성병원 (화성) |
| 이슈 날짜 | 2026-06-11 |
| 관련 프로그램 | CISReceiver, NEIS(CIS_Lite), LocalCDWExporter |
| 로그 경로 | `D:\doc\이슈\260626-강북삼성-화성-LocalCDWExpoter 수치값 업로드 이슈 로그 분析(Receiver 포함)\20260611_프로그램압축` |
| 에러 메시지 | `MoveNumCdwFiles failed: No matching MoveCDWDataFiles files found.` |

---

## 전체 워크플로우 구조

```
[의료기기] ──► [CISReceiver] ──► [NEIS(CIS_Lite)] ──► [LocalCDWExporter] ──► [CDW API]
```

### 정상 처리 흐름

1. **CISReceiver** — 기기로부터 데이터 수신 후 생성:
   - `C:\INFINITT\CIS\CDW\EXAMDATA\{GUID}.xml` (CDW 인터페이스 flat XML)
   - `C:\INFINITT\CIS\CIS_Lite\Data\Interface\{filename}.xml` (NEIS 트리거)

2. **NEIS(CIS_Lite)** — Interface XML 감지 후 매칭 처리:
   - DB 오더 매칭 (`ExMultiMatchWithAll3`)
   - 사용자 "저장하시겠습니까?" 다이얼로그 → **YES** 선택
   - `Match_UploadExam SetSTORAGE`: 수치 XML → Storage 업로드
   - `SetMatchFlowEx()`:
     - `CDW\EXAMDATA\{GUID}\` 서브폴더 생성 + 수치 데이터 파일 배치
     - `LocalCDWExporter\Local\incoming\matchedinfo\MatchedInfo_{timestamp}.xml` 생성
   - "매칭이 완료되었습니다." 다이얼로그 → CANCEL (정상 흐름)

3. **LocalCDWExporter** — `CDW\EXAMDATA\` 서브폴더를 LastWriteTime 기준 최신 선택:
   - 수치 데이터 파일(`MoveCDWDataFiles`) 있으면 → CDW API 업로드 성공
   - 없으면 → **`MoveNumCdwFiles failed`** 에러

---

## 에러 케이스 분석

### 청력 실패 케이스 1: `33AEEA36` — 07:04:49

| 시각 | 컴포넌트 | 이벤트 |
|------|---------|--------|
| 07:04:45 | NEIS | InsertStudy → Match start → "저장하시겠습니까?" 표시 |
| 07:04:47 | NEIS | **[YES 선택]** → `20260611070445_043880E8_zfw2sdyo_*.xml` → Storage 업로드 성공 |
| 07:04:47 | NEIS | `ExMultiMatchWithAll3` 매칭 완료 → `MatchedInfo_20260611070447.xml` 생성 |
| 07:04:48 | NEIS | `Match_DeleteExamFileAll` → "매칭이 완료되었습니다." 표시 |
| 07:04:49 | NEIS | **[CANCEL 선택]** (확인 다이얼로그 닫기 — 정상 동작) |
| 07:04:49 | LocalCDWExporter | `Latest CDW folder: 33AEEA36-4DCB-44D7-8949-7CA179D86BF5` 선택 |
| 07:04:49 | LocalCDWExporter | ❌ `MoveNumCdwFiles failed: No matching MoveCDWDataFiles files found.` |
| 07:05:38 | LocalCDWExporter | `Latest CDW folder: 1861B60D-...` 선택 → ✅ 성공 (환자 02808000, EAR1120:5, EAR1110:0) |

### 청력 실패 케이스 2: `E57A8ED3` — 07:42:40

- NEIS 07:42:38: `ExMultiMatchWithAll3` 매칭 → `MatchedInfo_20260611074238.xml` 생성
- NEIS 07:42:40: "매칭이 완료되었습니다." → **CANCEL**
- LocalCDWExporter 07:42:40: `E57A8ED3` 폴더 선택 → ❌ `MoveNumCdwFiles failed`

### 혈압 실패 케이스: `A151F6DF` — 08:01:15

- 동일한 패턴으로 실패

---

## 근본 원인

### 핵심 발견

> `33AEEA36` GUID는 **CISReceiver의 CDW 로그(`CDW Info Save`)에 전혀 존재하지 않는다.**

즉, 이 서브폴더는 CDW 수치 데이터 저장 흐름을 타지 않은 경로에서 생성된 빈 폴더입니다.

### 에러 발생 메커니즘

```
CDW\EXAMDATA\
  ├── 33AEEA36\   ← 수치 데이터 없음 (빈 폴더), LastWriteTime = T2 (더 최신)
  └── 1861B60D\   ← 수치 데이터 있음,           LastWriteTime = T1 (더 오래됨)

LocalCDWExporter: LastWriteTime 기준 최신 선택 → 33AEEA36 선택 → 실패
다음 사이클(약 1분 후): 1861B60D 선택 → 성공
```

CDW 수치 데이터가 없는 케이스에서도 `{GUID}/` 서브폴더가 생성되고, 이 빈 폴더가 수치 데이터 있는 폴더보다 더 최신 LastWriteTime을 가지는 경우 잘못 선택되어 에러 발생.

### 에러 메시지 버전 변천사

| 날짜 | 에러 메시지 |
|------|-----------|
| 2025-12 | `No matching NUM_CDW files found.` |
| 2026-03 | `No subfolders found under: C:\INFINITT\CIS\CDW\EXAMDATA` (당시 서브폴더 자체가 없었음) |
| 2026-06 | `No matching MoveCDWDataFiles files found.` (현재) |

---

## 데이터 유실 여부

**데이터 유실 없음.**

실패 사이클 직후 다음 polling 사이클(약 1분)에서 수치 데이터가 있는 폴더가 정상 처리됩니다. 단, CDW 업로드가 약 1 사이클 지연됩니다.

---

## 수정 방향 제안

### 방법 1 — LocalCDWExporter 수정 (권장)

`MoveCDWDataFiles` 함수에서 빈 폴더를 건너뛰고 수치 파일이 존재하는 폴더 중 최신 것을 선택하도록 변경:

```
// 현재: LastWriteTime 기준 최신 폴더 1개 선택 → 비어있으면 실패
// 개선: 수치 파일(MoveCDWDataFiles)이 존재하는 폴더 중 LastWriteTime 최신 선택
```

### 방법 2 — CISReceiver / NEIS 수정

CDW 수치 데이터가 없는 케이스에서는 `{GUID}/` 서브폴더를 생성하지 않거나, 폴더 생성과 수치 파일 쓰기를 원자적으로 처리하여 빈 폴더가 `EXAMDATA`에 남지 않도록 함.

### 방법 3 — 근본 원인 추적 후 처리

`33AEEA36`처럼 CDW Info Save 로그 없이 EXAMDATA 서브폴더가 생성되는 코드 경로를 CISReceiver/NEIS 소스에서 추적하여 차단.

---

## 관련 로그 파일

| 파일 | 내용 |
|------|------|
| `INFINITT-청력\CIS\LocalCDWExporter\Log\LocalCDWExporter_20260611.log` | 청력 CDW 업로드 로그 (성공/실패 케이스 모두 포함) |
| `INFINITT-혈압\CIS\LocalCDWExporter\Log\LocalCDWExporter_20260611.log` | 혈압 CDW 업로드 로그 |
| `INFINITT-청력\CIS\CISReceiver\Log\Receiver\CIS Receiver_20260611.log` | CISReceiver CDW Info Save 로그 |
| `INFINITT-청력\CIS\CIS_Lite\Log\NEIS\CIS NEIS_20260611.log` | NEIS 매칭 처리 및 SetMatchFlowEx 로그 |

---

> [[HIE팀 이슈\|← 이슈 목록으로]]
