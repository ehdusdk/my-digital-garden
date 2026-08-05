---
{"dg-publish":true,"permalink":"/cis-remover-analysis/","dg-note-properties":{}}
---

# CISRemover 프로젝트 구조 및 코드 상세 분석 보고서

## 1. 개요 및 프로젝트 역할

**CISRemover**는 인피니트 헬스케어(INFINITT)의 CIS(Clinical Information System) / PACS 솔루션 환경에서 생성되는 영상, 이미지, 데이터 파일 및 로그를 디스크 용량 관리 목적으로 **설정된 보관 기간(유효 기간)에 따라 주기적으로 자동 삭제(Purge / Housekeeping)**해주는 **Windows MFC GUI 기반 파일 관리 및 청소 유틸리티**입니다.

---

## 2. 프로젝트 디렉토리 및 파일 구조

`D:\Proj\CIS_SOLUTION\CISRemover` 경로의 주요 구성 요소는 다음과 같습니다:

```
D:\Proj\CIS_SOLUTION\CISRemover\
├── CIS_Remover.sln               # Visual Studio 솔루션 파일
├── CIS_Remover.vcproj            # Visual Studio C++ 프로젝트 파일 (VS 2008 / 2005)
├── CIS_Remover.dsp / .dsw        # VC++ 6.0 프로젝트 및 워크스페이스 파일
├── CIS_Remover.h / .cpp          # MFC CWinApp 응용 프로그램 메인 클래스 (CCIS_RemoverApp)
├── CIS_RemoverDlg.h / .cpp       # 메인 다이얼로그 UI 및 핵심 삭제/탐색/타이머 로직 (CCIS_RemoverDlg)
├── KbcBmp.h / .cpp               # 커스텀 비트맵 조작 헬퍼 클래스
├── KbcButton.h / .cpp            # 커스텀 스킨/그래픽 버튼 컨트롤 클래스
├── resource.h / CIS_Remover.rc   # 리소스 ID 정의 및 다이얼로그/아이콘 리소스 스크립트
├── res\                          # 아이콘 및 버튼/스킨 이미지 리소스 디렉토리
├── CIS Common Library.vsprops    # 공통 CIS 라이브러리 (CISLib, CISModalityLib, CISVideoLib) 빌드 설정
├── CIS Common Build Events.vsprops# 빌드 이벤트 설정
├── Config.ini (실행 시 생성)     # 5개 제거 항목의 TYPE, DATE, PATH 설정을 저장하는 설정 파일
└── ReadMe.txt                    # AppWizard 기본 설명서
```

---

## 3. 삭제 가능한 파일 확장자 확인 (중요)

> [!IMPORTANT]
> **삭제 대상 확장자 제한 여부: 제한 없음 (모든 확장자 삭제 가능)**

* **확장자 필터링 방식**: `CISRemover` 코드 내에는 특정 확장자(예: `.jpg`, `.dcm`, `.raw`, `.log` 등)만 골라서 삭제하거나 제외하는 확장자 검사 조건문이 **존재하지 않습니다.**
* **탐색 패턴**: 파일 및 디렉토리 검색 시 API로 `*.*` (모든 파일 및 폴더) 패턴을 사용합니다.
* **삭제 결정 기준**: 확장자 종류가 아니라 **① 지정된 삭제 탐색 방식(Type)**, **② 폴더명 날짜 규칙(YYYY/MMDD/YYYYMMDD)**, **③ 파일의 생성 날짜(`ftCreationTime`) 및 최종 수정 날짜(`ftLastWriteTime`)**를 기준으로 기준일보다 오래된 모든 파일을 삭제합니다.

따라서 **삭제 대상 경로 내에 존재하는 모든 확장자의 파일이 삭제 조건 충족 시 일괄 삭제**됩니다.

---

## 4. 핵심 기능 상세

### ① 5개 독립 경로 규칙 동시 관리 (`REMOVER1` ~ `REMOVER5`)
* 최대 5개의 서로 다른 경로(`PATH1`~`PATH5`)를 지정하여 개별적으로 탐색 타입(`TYPE`)과 보관 기한(`DATE`)을 다르게 설정 가능합니다.

### ② 3가지 디렉토리/파일 삭제 탐색 타입 (`TYPE`)

| Type 코드 | 탐색 모드 명칭 | 작동 및 삭제 방식 |
| :--- | :--- | :--- |
| **0** | **INFINITT TREE** | • 의료 영상/데이터가 연/월/일(`YYYY`, `MMDD`, `YYYYMMDD`) 폴더로 구조화된 인피니트 전용 구조 탐색<br>• `YYYY` 폴더가 삭제 기준년도보다 이전이면 하위 폴더 전체 삭제(`Perfect_Delete_Dir`)<br>• `MMDD` 또는 `YYYYMMDD` 폴더명이 삭제 기준일 이하이면 디렉토리 전체 및 내부 파일 일괄 삭제 |
| **1** | **BASIC TREE** | • 일반 계층형 디렉토리 구조 재귀 탐색(`Perfect_Delete_Dir`)<br>• 모든 하위 폴더를 수직 탐색하며 파일의 **최종 수정 날짜(`ftLastWriteTime`)**가 기준일 이하이면 파일 삭제(`DeleteFile`)<br>• 비어 있는 디렉토리는 자동 삭제(`RemoveDirectory`) |
| **2** | **FILE** | • 단일 디렉토리 평면 탐색(`Search_File`)<br>• 경로 바로 아래에 있는 파일들의 **생성 날짜(`ftCreationTime`)**를 확인하여 기준일 이하인 모든 파일 삭제 |

### ③ 삭제 기준 보관 기간 설정 (`DATE`)
현재 시각(`CurTime`)을 기준으로 보관 기한을 계산하여 기준 날짜(`RemoveTime`)를 설정합니다:

* `0`: 미지정/비활성화
* `1`: 5일 전 (`CurTime - 5일`)
* `2`: 15일 전 (`CurTime - 15일`)
* `3`: 20일 전 (`CurTime - 20일`)
* `4`: 30일 전 (`CurTime - 30일`)
* `5`: 60일 전 (`CurTime - 60일`)
* `6`: 90일 전 (`CurTime - 90일`)
* `7`: 180일 전 (`CurTime - 180일`)
* `8`: 365일 전 (`CurTime - 365일`)

### ④ 6시간 주기 자동 실행 타이머 (`Timer`)
* 수동 삭제 실행(`OnExecuteRemove`) 버튼 클릭 시 **6시간 간격(`21600000ms`)**의 Windows 타이머(`SetTimer(100, ELAPSEDTIME, NULL)`)가 동작합니다.
* 타이머가 작동 중일 때 6시간마다 자동으로 `Execute()` 함수가 호출되어 디스크 청소를 지속적으로 수행합니다.

### ⑤ Windows System Tray 연동 (백그라운드 실행)
* 최소화 버튼 클릭 또는 삭제 실행 시 윈도우 작업 표시줄이 아닌 **시스템 트레이(Notify Icon)**로 숨김(`ShowWindow(SW_HIDE)`) 전환됩니다.
* 트레이 아이콘 더블 클릭 시 다시 메인 다이얼로그 UI가 표시됩니다.

### ⑥ 설정 자동 저장 및 복원 (`Config.ini`)
* 프로그램 실행 시 실행 파일 동일 경로의 `Config.ini` 파일에서 `REMOVER1`~`REMOVER5` 섹션의 `TYPE`, `DATE`, `PATH` 값을 읽어와 UI 콤보박스 및 텍스트박스에 복원합니다.
* 삭제 실행 시 변경된 설정이 `Config.ini`에 즉시 저장됩니다.

### ⑦ 정밀 로깅 시스템 (`CISLog` / `WRLogger`)
* `CISLog` 및 `WRLogger` 모듈을 통한 로그 기록.
* 삭제 기준 일자, 삭제된 파일의 전체 경로(`[DELETE FILE]`), 기준 시간과의 비교 내역 등을 상세히 로그 파일에 남겨 오삭제 추적 및 감사를 지원합니다.

### ⑧ 커스텀 UI 및 스킨 렌더링 (`CKbcButton`, `CKbcBmp`)
* MFC 기본 윈도우 틀 대신 둥근 모서리 윈도우(`CreateRoundRectRgn`) 및 비트맵 이미지를 활용한 커스텀 UI 스킨(`DrawSkin`) 렌더링 적용.

---

## 5. 핵심 소스코드 구조 분석

### 1) [CIS_Remover.cpp](file:///D:/Proj/CIS_SOLUTION/CISRemover/CIS_Remover.cpp)
* `CCIS_RemoverApp` (응용 프로그램 기본 클래스)
* `InitInstance()`에서 단일 인스턴스 중복 실행 방지 기능(`CISInstance::IsAlreadyRunning`) 및 메인 다이얼로그(`CCIS_RemoverDlg`) 호출.

### 2) [CIS_RemoverDlg.h](file:///D:/Proj/CIS_SOLUTION/CISRemover/CIS_RemoverDlg.h) & [CIS_RemoverDlg.cpp](file:///D:/Proj/CIS_SOLUTION/CISRemover/CIS_RemoverDlg.cpp)
* `CCIS_RemoverDlg` (다이얼로그 및 핵심 비즈니스 로직 클래스)
* **주요 메서드**:
  * `OnInitDialog()`: UI 초기화, INI 파일 읽기(`Read_INI`), 스킨 로드(`LoadSkin`).
  * `OnExecuteRemove()`: 6시간 타이머 시작, INI 저장, 삭제 실행(`Execute()`), UI 제어 요소 비활성화.
  * `Execute()`: 5개 설정 항목을 순회하며 TYPE(0: INFINITT TREE, 1: BASIC TREE, 2: FILE)에 따라 탐색 및 삭제 로직 분기.
  * `Search_YYYY_Dir()`, `Search_MMDD_Dir()`, `Search_YYYYMMDD_Dir()`: 연도/월일/8자리 일자 기반 인피니트 전용 폴더 구조 분석 및 삭제.
  * `Perfect_Delete_Dir()`: 재귀 폴더 탐색 및 파일 삭제 (`DeleteFile`), 디렉토리 삭제 (`RemoveDirectory`).
  * `Search_File()`: 평면 파일 탐색 및 생성일 기반 삭제.
  * `Get_RemoveTime()`: 콤보박스 선택값(0~8)에 따른 삭제 기준 CTime 계산.
  * `Read_INI()` / `Write_INI()`: `Config.ini` 연동.
  * `RegistTrayIcon()` / `TrayIconMsg()`: 백그라운드 트레이 상주 및 메시지 처리.

---

## 6. 요약 결론

`CISRemover`는 인피니트 의료 영상 솔루션 환경에서 **디스크 용량 고갈을 방지하기 위해 최대 5개의 지정 경로를 6시간 주기로 자동 감시하며, 설정된 보관 기간(5일~365일)이 지난 모든 파일(확장자 무관) 및 폴더를 안전하게 자동 삭제**하는 정교한 백그라운드 관리 유틸리티입니다.
