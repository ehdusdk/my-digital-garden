---
{"dg-publish":true,"dg-permalink":"260811-cis_receiver_watcher_batfile_analysis","permalink":"/260811-cis_receiver_watcher_batfile_analysis/","title":"CIS_RECEIVER_WATCHER.bat 동작 분석 및 설명","tags":["CISReceiver","Watcher","배치파일","코드분석","강북삼성","트러블슈팅","CIS3.0"],"dg-note-properties":{"title":"CIS_RECEIVER_WATCHER.bat 동작 분석 및 설명","date":"2026-08-11","tags":["CISReceiver","Watcher","배치파일","코드분석","강북삼성","트러블슈팅","CIS3.0"]}}
---

# CIS_RECEIVER_WATCHER.bat 동작 분석 및 설명

> [!info] 개요
> CIS Receiver 3.0(`CISReceiverU.exe`) 프로세스를 30초 주기로 감시하여, **종료되었거나 무응답(Hang) 상태일 때 자동으로 강제 종료 후 재실행**하는 워치독(Watchdog) 배치 스크립트.

## 기본 정보

| 항목 | 내용 |
|---|---|
| 파일명 | `CIS_RECEIVER_WATCHER.bat` |
| 감시 대상 프로세스 | `CISReceiverU.exe` |
| 실제 실행 대상 | `CISReceiverU_Console.lnk` (바로가기) |
| 설치 경로 | `C:\INFINITT\CIS\CISReceiver` |
| 감시 주기 | 30초 |
| Hang 판정 기준 | 동일 스냅샷 30회 연속 (= 15분) |
| 관련 노트 | [[강북삼성-CISReceiver 3.0 비정상종료분석\|강북삼성-CISReceiver 3.0 비정상종료분석]] / [[260730-CISWatcher 분석\|260730-CISWatcher 분석]] |

---

## 1. CMD 강제 실행 래퍼 (5~9행)

```bat
if not defined __RUN_IN_CMD (
    set "__RUN_IN_CMD=1"
    cmd /c "%~f0" %*
    exit /b
)
```

- 환경변수 `__RUN_IN_CMD`가 정의되어 있지 않으면, 자기 자신(`%~f0` = 배치 파일의 전체 경로)을 `cmd /c`로 재실행하고 원본 프로세스는 즉시 종료한다.
- **목적**: PowerShell·작업 스케줄러·서비스 래퍼 등 다른 셸에서 호출되더라도 반드시 정통 `cmd.exe` 환경에서 실행되도록 보장.
- `setlocal`, 지연확장(`!VAR!`), `goto` 라벨 같은 배치 고유 문법이 다른 셸에서 깨지는 문제를 원천 차단한다.

## 2. 실행 환경 초기화 (14~15행)

- `setlocal ENABLEDELAYEDEXPANSION` — 루프 내부에서 값이 계속 변하는 변수를 `!VAR!` 형태로 읽기 위한 **지연 확장** 활성화. 이 스크립트의 `SAME_COUNT`, `PREV_LINE` 비교 로직이 여기에 의존한다.
- `title CIS_RECEIVER_WATCHER` — 콘솔 창 제목 지정. 작업 관리자에서 워처 창을 식별하기 쉽게 한다.

## 3. 경로 및 상수 정의 (21~27행)

| 변수 | 값 | 설명 |
|---|---|---|
| `BASE_DIR` | `C:\INFINITT\CIS\CISReceiver` | 설치 폴더. 22행에서 끝에 `\`가 없으면 자동 추가 (경로 결합 오류 방지) |
| `RECEIVER_EXE` | `CISReceiverU.exe` | `tasklist` / `taskkill`에서 사용하는 **프로세스 이름** |
| `RECEIVER_LNK` | `CISReceiverU_Console.lnk` | 실제 **실행에 사용하는 바로가기** |
| `RECEIVER_TARGET` | `BASE_DIR` + `LNK` | 재실행 시 호출 대상 |
| `RECEIVER_PATH` | `BASE_DIR` + `EXE` | 파일 존재 확인 대상 |
| `CHECK_INTERVAL_SEC` | `30` | 감시 주기(초) |

> [!note] 실행과 감시의 분리
> **실행은 `.lnk`**(작업 디렉터리·실행 인수가 포함된 바로가기), **감시는 `.exe`**(프로세스명)로 분리된 구조다. 바로가기를 통해야 정상적인 작업 폴더와 옵션이 적용되기 때문.

## 4. tasklist 사용 가능 여부 판정 (30~31행)

```bat
set "TASKLIST_OK=0"
where tasklist >nul 2>&1 && set "TASKLIST_OK=1"
```

- `where` 명령으로 `tasklist` 존재 여부를 확인해 스위치를 설정.
- 제한된 계정 권한이나 축소 설치(Server Core 등) 환경에서 `tasklist`를 쓸 수 없을 때를 대비한 **폴백 분기 플래그**.

## 5. Hang 감지용 변수 초기화 (33~39행)

- `CUR_LINE` / `PREV_LINE` — `tasklist` 출력 한 줄(프로세스명·PID·세션·**메모리 사용량**)을 보관.
- `SAME_COUNT` — 스냅샷이 연속으로 동일했던 횟수.
- `HANG_LIMIT=30` — 동일 스냅샷이 30회 연속이면 Hang으로 판정.
    - 주석에 변경 이력 기재: `HANG_LIMIT 10 => 30 유휴시간 확인하도록 변경 26/07/20 김도연`

## 6. 시작 배너 출력 (41~47행)

- 시작 시각, `BASE_DIR`, 대상 경로, 감시 주기, 동작 모드(`tasklist + hang detection` 또는 `blind start`)를 콘솔에 출력.
- 로그 파일로 리다이렉션 시 그대로 기록되어 **가동 시작 시점 추적**에 사용된다.

---

## 7. MAIN_LOOP — 감시 루프 (49행 ~ )

### 7-1. 실행 파일 존재 확인 (54~59행)

```bat
dir "%RECEIVER_PATH%" >nul 2>&1
if errorlevel 1 ( ... 30초 대기 후 재루프 ... )
```

- `exist` 대신 `dir`을 사용 (주석에 `no 'exist'` 명시). 네트워크 경로·권한 문제 상황에서 더 확실한 판정을 노린 의도.
- 파일이 없으면 **재실행을 시도하지 않고** 30초 대기 후 루프 재시작 → 설치 중·업데이트 중 오작동 방지.

### 7-2. Blind start 모드 (61~66행)

- `TASKLIST_OK=0`이면 프로세스 상태를 알 수 없으므로 무조건 `start "" /b /min` 으로 실행 시도.
- `/b` = 새 창 없이 실행, `/min` = 최소화 실행.
- **중복 실행 위험이 있는 최후의 수단 모드**.

### 7-3. 프로세스 생존 확인 및 재시작 (70~81행)

```bat
tasklist /FI "IMAGENAME eq %RECEIVER_EXE%" | findstr /I "%RECEIVER_EXE%"
if %errorlevel% neq 0 (
    taskkill /f /im "%RECEIVER_EXE%" >nul 2>&1
    timeout /t 3 /nobreak >nul
    start "" /b /min "%RECEIVER_TARGET%"
    ...
)
```

- `tasklist` 필터 결과에 exe 이름이 없으면(`errorlevel ≠ 0`) → **프로세스가 죽은 것으로 판단**.
- 처리 순서: `taskkill /f`(좀비 프로세스 정리) → 3초 대기 → `.lnk` 재실행 → 30초 대기 → 루프 처음으로.
- `tasklist` 자체가 응답하지 않는 경우도 동일 분기로 처리된다.

### 7-4. 프로세스 스냅샷 수집 (84~86행)

```bat
for /f "tokens=*" %%a in ('tasklist /FI "IMAGENAME eq %RECEIVER_EXE%" ^| findstr /I "%RECEIVER_EXE%"') do (
    set "CUR_LINE=%%a"
)
```

- `tasklist` 출력 줄 전체를 `CUR_LINE`에 저장.
- 이 줄에는 **메모리 사용량(K)** 이 포함되어 있어, 값의 변화 여부가 곧 "실제로 일하고 있는가"의 간접 지표가 된다.

### 7-5. 기준값 초기화 (88~90행)

- 첫 루프에서 `PREV_LINE`이 비어 있으면 현재 값으로 채운다.

### 7-6. 스냅샷 비교 및 카운팅 (95~103행)

| 조건 | 처리 |
|---|---|
| `PREV_LINE == CUR_LINE` | `SAME_COUNT` +1 (변화 없음 = 정지 의심) |
| `PREV_LINE != CUR_LINE` | `SAME_COUNT = 1` 리셋, `PREV_LINE` 갱신, `Process active` 로그 |

### 7-7. Hang 확정 및 강제 재시작 (105~112행)

```bat
if !SAME_COUNT! geq %HANG_LIMIT% (
    taskkill /f /im "%RECEIVER_EXE%" >nul 2>&1
    timeout /t 2 /nobreak >nul
    start "" /b /min "%RECEIVER_TARGET%"
    set SAME_COUNT=0
)
```

- `SAME_COUNT >= 30` → 강제 종료 → 2초 대기 → `.lnk` 재실행 → 카운터 초기화.
- **프로세스는 살아 있으나 메모리 변동이 전혀 없는 "무응답 상태"** 를 잡아내는 핵심 로직.

### 7-8. 대기 후 반복 (113~115행)

- 현재 `SAME_COUNT` 출력 → 30초 대기 → `goto MAIN_LOOP`.

---

## 동작 흐름 요약

```
시작
 └─ cmd 환경 강제 전환
     └─ 변수/모드 초기화 → 배너 출력
         └─ [MAIN_LOOP] ──────────────────────────────┐
             ├─ EXE 파일 존재?           No → 30초 대기 ┤
             ├─ tasklist 사용 가능?      No → 무조건 실행 ┤
             ├─ 프로세스 살아있나?       No → kill+재실행 ┤
             ├─ 스냅샷 수집 후 이전값과 비교              │
             │    ├─ 동일 → SAME_COUNT++               │
             │    └─ 변경 → SAME_COUNT=1               │
             ├─ SAME_COUNT >= 30 → Hang 확정, kill+재실행│
             └─ 30초 대기 ─────────────────────────────┘
```

---

## 점검이 필요한 부분

- [ ] **81행 고아 괄호 `)`** — 78~80행 `else` 블록이 80행에서 이미 닫혔는데 괄호가 하나 더 존재. 실행 시 문법 오류 메시지가 출력된다. 삭제 권장.
- [ ] **33~34행 `set "CUR_LINE ="`** — 변수명 뒤 공백 때문에 `CUR_LINE `(공백 포함)이라는 별개 변수가 생성됨. 의도한 초기화가 되지 않는다.
- [ ] **89행 `set "PREV_LINE= %CUR_LINE%"`** — 값 앞에 공백이 붙어 첫 비교가 항상 불일치 처리된다.
- [ ] **HANG_LIMIT 주석과 실제 값 불일치** — 30회 × 30초 = **15분**. 주석의 "30분"에 맞추려면 `HANG_LIMIT=60` 이어야 한다.
- [ ] **83행 주석 오류** — `REM` 뒤에 `findstr` 명령이 같은 줄에 붙어 있어 전체가 주석 처리됨(실행되지 않는 죽은 코드).
- [ ] **97·101행 로그 값 부정확** — 괄호 블록 내부에서 `%PREV_LINE%`를 사용해 **변경 전 값**이 출력된다. `!PREV_LINE!`로 수정 필요.
- [ ] **서비스 여부 확인** — 이 스크립트는 Windows 서비스가 아니라 `.lnk` 기반 **콘솔 프로세스**를 감시·재실행한다. 대상이 실제로 서비스로 등록되어 있다면 `sc query` / `net start` 방식이 더 안정적.
- [ ] **메모리 기반 Hang 판정의 한계** — 정상 동작 중이라도 유휴 시간에는 메모리 사용량이 변하지 않을 수 있어 **오탐(false positive) 재시작** 가능성이 있다. 로그 파일 갱신 시각이나 DB 하트비트 기반 판정 병행 검토 필요.
