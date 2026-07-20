---
{"dg-publish":true,"permalink":"//cis-receiver-watcher/","dg-note-properties":{}}
---

[[CIS 2.0/CIS 분석\|CIS 분석]]
# CIS_RECEIVER_WATCHER 배치파일 분석 및 변경

## 1. 문서 목적

이 문서는 강북삼성 환경에 적용된 `CIS_RECEIVER_WATCHER.bat` 배치 파일의 동작 방식을 분석하고, 현재 발생 가능한 `CISReceiverU.exe` 재시작 조건을 정리하기 위한 문서입니다.

특히 다음 내용을 확인합니다.

- 배치 파일이 어떤 기준으로 `CISReceiverU.exe`를 감시하는지
- 정상 유휴 상태에서도 재시작될 가능성이 있는지
- 현재 설정상 5-8분 유휴 시 재시작되는 것이 맞는지
- 유휴시간 기준을 늘리거나 재시작 조건을 완화할 수 있는지
- 권장 변경 방향

## 2. 분석 대상

대상 파일:

```text
D:\doc\이슈\260716-CIS_RECEIVER_WATCHER 배치파일\CIS_RECEIVER_WATCHER.bat
```

대상 프로세스:

```text
CISReceiverU.exe
```

실행 대상 바로가기:

```text
C:\INFINITT\CIS\CISReceiver\CISReceiverU_Console.lnk
```

배치 파일의 주요 목적은 `CISReceiverU.exe`가 종료되었거나 hang 상태로 판단될 때 강제로 종료 후 재실행하는 것입니다.

## 3. 주요 설정값

배치 파일의 핵심 설정은 다음과 같습니다.

```bat
set "BASE_DIR=C:\INFINITT\CIS\CISReceiver"
set "RECEIVER_EXE=CISReceiverU.exe"
set "RECEIVER_LNK=CISReceiverU_Console.lnk"
set "CHECK_INTERVAL_SEC=30"
set "HANG_LIMIT=10"
```

각 항목의 의미는 다음과 같습니다.

| 설정값 | 의미 |
|---|---|
| `BASE_DIR` | CIS Receiver 설치 경로 |
| `RECEIVER_EXE` | 감시 대상 실행 파일명 |
| `RECEIVER_LNK` | 재실행 시 사용할 바로가기 파일 |
| `CHECK_INTERVAL_SEC` | 감시 주기. 현재 30초 |
| `HANG_LIMIT` | 동일 상태가 몇 번 반복되면 hang으로 볼지 결정. 현재 10회 |

현재 기준으로는 30초마다 한 번씩 상태를 확인하고, 동일한 상태가 10회 반복되면 hang으로 판단합니다.

계산식은 다음과 같습니다.

```text
CHECK_INTERVAL_SEC x HANG_LIMIT
= 30초 x 10회
= 약 300초
= 약 5분
```

따라서 설정값만 보면 약 5분 동안 상태 변화가 없을 경우 재시작될 수 있습니다.

## 4. 전체 동작 흐름

배치 파일의 전체 흐름은 다음과 같습니다.

```text
1. CMD 환경에서 재실행
2. 기본 변수 설정
3. tasklist 명령어 사용 가능 여부 확인
4. 무한 루프 시작
5. CISReceiverU.exe 파일 존재 여부 확인
6. tasklist로 CISReceiverU.exe 프로세스 존재 여부 확인
7. 프로세스가 없으면 재실행
8. 프로세스가 있으면 tasklist 출력 한 줄을 snapshot으로 저장
9. 이전 snapshot과 현재 snapshot 비교
10. snapshot이 계속 동일하면 SAME_COUNT 증가
11. SAME_COUNT가 HANG_LIMIT 이상이면 hang으로 판단
12. CISReceiverU.exe 강제 종료 후 바로가기 파일로 재실행
13. 30초 대기 후 반복
```

## 5. 항목별 상세 분석

### 5.1 CMD 환경 강제 실행

```bat
if not defined __RUN_IN_CMD (
    set "__RUN_IN_CMD=1"
    cmd /c "%~f0" %*
    exit /b
)
```

이 부분은 배치 파일이 어떤 환경에서 호출되더라도 다시 `cmd /c`를 통해 자기 자신을 실행하도록 하는 wrapper입니다.

`__RUN_IN_CMD` 변수를 사용해서 자기 자신을 무한히 다시 실행하는 것을 방지합니다.

의도는 PowerShell, 스케줄러, 기타 실행 환경 차이로 인한 batch 해석 문제를 줄이려는 것으로 보입니다.

### 5.2 대상 경로 및 실행 파일 설정

```bat
set "BASE_DIR=C:\INFINITT\CIS\CISReceiver"
if not "%BASE_DIR:~-1%"=="\" set "BASE_DIR=%BASE_DIR%\"
set "RECEIVER_EXE=CISReceiverU.exe"
set "RECEIVER_LNK=CISReceiverU_Console.lnk"
set "RECEIVER_TARGET=%BASE_DIR%%RECEIVER_LNK%"
set "RECEIVER_PATH=%BASE_DIR%%RECEIVER_EXE%"
```

감시 대상은 다음 파일입니다.

```text
C:\INFINITT\CIS\CISReceiver\CISReceiverU.exe
```

재시작 시 직접 실행하는 대상은 exe가 아니라 다음 바로가기입니다.

```text
C:\INFINITT\CIS\CISReceiver\CISReceiverU_Console.lnk
```

즉 프로세스 감시는 `CISReceiverU.exe`로 하지만, 재실행은 `.lnk` 바로가기 파일을 통해 수행합니다.

### 5.3 감시 주기

```bat
set "CHECK_INTERVAL_SEC=30"
```

감시 주기는 30초입니다.

배치 파일은 매 30초마다 다음을 반복합니다.

- exe 파일 존재 여부 확인
- 프로세스 존재 여부 확인
- tasklist snapshot 비교
- hang 의심 카운트 증가 여부 판단

### 5.4 tasklist 사용 가능 여부 확인

```bat
set "TASKLIST_OK=0"
where tasklist >nul 2>&1 && set "TASKLIST_OK=1"
```

Windows의 `tasklist` 명령어가 사용 가능한지 확인합니다.

`tasklist`가 있으면 일반 감시 모드로 동작합니다.

`tasklist`가 없으면 blind start 모드로 동작합니다.

### 5.5 blind start 모드

```bat
if "%TASKLIST_OK%"=="0" (
  echo [%TIME%] tasklist unavailable. Blind start...
  start "" /b /min "%RECEIVER_TARGET%"
  timeout /t %CHECK_INTERVAL_SEC% /nobreak >nul
  goto MAIN_LOOP
)
```

`tasklist`를 사용할 수 없는 경우에는 프로세스 상태를 확인할 수 없으므로 매 주기마다 바로가기를 실행합니다.

주의할 점은 이 경우 기존 프로세스가 실행 중인지 확인하지 못하므로 중복 실행 가능성이 있습니다.

일반적인 Windows 서버/PC 환경에서는 `tasklist`가 존재하므로 이 분기가 실행될 가능성은 낮습니다.

### 5.6 CISReceiverU.exe 파일 존재 확인

```bat
dir "%RECEIVER_PATH%" >nul 2>&1
if errorlevel 1 (
  echo [%TIME%] CISReceiver file missing. Waiting...
  timeout /t %CHECK_INTERVAL_SEC% /nobreak >nul
  goto MAIN_LOOP
)
```

`CISReceiverU.exe` 파일이 실제 경로에 존재하는지 확인합니다.

파일이 없으면 재시작하지 않고 30초 대기 후 다시 확인합니다.

다만 실제 재시작에 사용하는 `.lnk` 파일의 존재 여부는 별도로 확인하지 않습니다.

따라서 `CISReceiverU.exe`는 존재하지만 `CISReceiverU_Console.lnk`가 없거나 깨져 있으면 재시작 명령이 실패할 수 있습니다.

### 5.7 프로세스 존재 여부 확인

```bat
tasklist /FI "IMAGENAME eq %RECEIVER_EXE%" | findstr /I "%RECEIVER_EXE%"
if %errorlevel% neq 0 (
    echo [%TIME%] - tasklist failed or hung. Restarting CISReceiver...
    taskkill /f /im "%RECEIVER_EXE%" >nul 2>&1
    timeout /t 3 /nobreak >nul
    start "" /b /min "%RECEIVER_TARGET%"
    timeout /t %CHECK_INTERVAL_SEC% /nobreak >nul
    goto MAIN_LOOP
) else (
    echo [%TIME%] CISReceiver is running normally.
)
```

이 부분은 `tasklist` 결과에서 `CISReceiverU.exe`가 있는지 확인합니다.

프로세스가 없으면 다음 작업을 수행합니다.

```text
1. CISReceiverU.exe 강제 종료 명령 실행
2. 3초 대기
3. CISReceiverU_Console.lnk 실행
4. 30초 대기
5. 메인 루프로 복귀
```

여기서 로그 메시지는 `tasklist failed or hung`라고 되어 있지만, 실제 의미는 대부분 다음에 가깝습니다.

```text
CISReceiverU.exe 프로세스를 찾지 못함
```

즉 `tasklist` 자체가 실패했다기보다는 감시 대상 프로세스가 없어서 재실행하는 경우가 일반적입니다.

### 5.8 tasklist snapshot 저장

```bat
for /f "tokens=*" %%a in ('tasklist /FI "IMAGENAME eq %RECEIVER_EXE%" ^| findstr /I "%RECEIVER_EXE%"') do (
    set "CUR_LINE=%%a"
)
```

이 부분은 현재 실행 중인 `CISReceiverU.exe`의 `tasklist` 출력 한 줄을 `CUR_LINE` 변수에 저장합니다.

예상 출력 형태는 다음과 비슷합니다.

```text
CISReceiverU.exe             1234 Console                    1     50,000 K
```

이 출력에는 일반적으로 다음 정보가 포함됩니다.

- 이미지 이름
- PID
- 세션 이름
- 세션 번호
- 메모리 사용량

중요한 점은 이 값이 실제 프로그램이 정상적으로 업무를 처리 중인지 직접 나타내지는 않는다는 것입니다.

### 5.9 이전 snapshot과 현재 snapshot 비교

```bat
if "!PREV_LINE!"=="%CUR_LINE%" (
    set /a SAME_COUNT+=1
    echo [%TIME%] PREV_LINE_OLD= %PREV_LINE%
) else (
    set "SAME_COUNT=1"
    set "PREV_LINE=%CUR_LINE%"
    echo [%TIME%] PREV_LINE_NEW= %PREV_LINE%
    echo [%TIME%] Snapshot changed. Process active.
)
```

이 배치 파일의 hang 판단 핵심 로직입니다.

판단 기준은 다음과 같습니다.

```text
이전 tasklist 출력 한 줄 == 현재 tasklist 출력 한 줄
```

두 값이 같으면 `SAME_COUNT`를 증가시킵니다.

두 값이 다르면 프로세스 상태가 변한 것으로 보고 `SAME_COUNT`를 1로 다시 설정합니다.

이 방식의 문제는 실제 업무 처리 여부가 아니라 `tasklist` 출력 문자열 변화 여부만 본다는 점입니다.

예를 들어 `CISReceiverU.exe`가 정상적으로 대기 중이고, 일정 시간 동안 신규 작업이 없어서 메모리 사용량이 변하지 않으면 snapshot은 계속 동일할 수 있습니다.

이 경우 프로그램이 정상 유휴 상태임에도 hang으로 오판될 수 있습니다.

### 5.10 hang 판단 및 재시작

```bat
if !SAME_COUNT! geq %HANG_LIMIT% (
    echo [%TIME%] SanapShot identical. Possible Hang.
    echo [%TIME%] Hang Confirmed. Restarting Process!
    taskkill /f /im "%RECEIVER_EXE%" >nul 2>&1
    timeout /t 2 /nobreak >nul
    start "" /b /min "%RECEIVER_TARGET%"
    set SAME_COUNT=0
)
```

`SAME_COUNT`가 `HANG_LIMIT` 이상이면 hang으로 확정하고 프로세스를 재시작합니다.

현재 설정은 다음과 같습니다.

```text
SAME_COUNT >= 10
```

즉 같은 snapshot이 10회 연속 확인되면 다음 작업을 수행합니다.

```text
1. CISReceiverU.exe 강제 종료
2. 2초 대기
3. CISReceiverU_Console.lnk 실행
4. SAME_COUNT 초기화
```

## 6. 5-8분 유휴 시 재시작 여부

현재 설정 기준으로 5-8분 유휴 시 재시작될 가능성이 높습니다.

근거는 다음과 같습니다.

```bat
set "CHECK_INTERVAL_SEC=30"
set "HANG_LIMIT=10"
```

계산:

```text
30초 x 10회 = 300초 = 약 5분
```

따라서 `CISReceiverU.exe`가 정상적으로 실행 중이더라도 약 5분 동안 `tasklist` 출력이 변하지 않으면 재시작 조건에 도달할 수 있습니다.

현장에서 5-8분으로 보이는 이유는 다음 요인 때문일 수 있습니다.

- 배치 시작 시점과 실제 유휴 시작 시점 차이
- 각 loop의 실제 수행 시간
- `tasklist` 실행 시간
- `timeout` 대기 시간 오차
- 메모리 사용량이 간헐적으로 바뀌는 경우 카운트가 일부 초기화될 수 있음

정리하면, 사용자가 관찰한 "5-8분 유휴 후 재시작" 현상은 현재 배치 파일 로직과 일치합니다.

## 7. 현재 방식의 주요 문제점

### 7.1 정상 유휴 상태를 hang으로 오판 가능

현재 배치는 실제 Receiver의 업무 처리 상태를 확인하지 않습니다.

다음 조건만 확인합니다.

```text
tasklist 출력 한 줄이 이전과 같은가?
```

따라서 정상적으로 대기 중인 상태도 hang으로 판단될 수 있습니다.

### 7.2 기준 시간이 짧음

현재 기준은 약 5분입니다.

CISReceiver 특성상 정상적으로 5분 이상 신규 요청이나 처리 이벤트가 없을 수 있다면, 이 값은 운영 환경에서는 너무 짧을 수 있습니다.

### 7.3 tasklist 정보는 hang 판단 기준으로 부정확

`tasklist`의 기본 출력은 주로 프로세스 존재 여부와 메모리 사용량 정도를 보여줍니다.

메모리 사용량이 변하지 않는다고 해서 프로그램이 hang 상태라고 볼 수는 없습니다.

### 7.4 바로가기 파일 존재 여부 미확인

배치는 `CISReceiverU.exe` 파일 존재 여부는 확인하지만, 실제 실행에 사용하는 `CISReceiverU_Console.lnk` 존재 여부는 확인하지 않습니다.

### 7.5 불필요하거나 부정확한 코드 존재

다음과 같은 정리 대상이 있습니다.

```bat
set "CUR_LINE ="
set "PREV_LINE ="
```

위 코드는 `CUR_LINE`, `PREV_LINE` 변수를 초기화하는 것이 아니라 공백이 포함된 다른 변수명을 만들 수 있습니다.

또한 중간에 불필요한 닫는 괄호가 있습니다.

```bat
)
```

실행에 치명적이지 않을 수 있으나 유지보수 관점에서는 제거하는 것이 좋습니다.

## 8. 변경 방향

변경 방향은 크게 3가지입니다.

## 8.1 변경안 A: 유휴 허용 시간만 증가

가장 간단한 변경입니다.

기존:

```bat
set "HANG_LIMIT=10"
```

변경 예시:

```bat
set "HANG_LIMIT=60"
```

30초 주기 기준 예상 시간:

| HANG_LIMIT | 예상 재시작 기준 |
| ---------: | --------: |
|         10 |      약 5분 |
|         20 |     약 10분 |
|         60 |     약 30분 |
|        120 |     약 1시간 |
|        240 |     약 2시간 |

장점:

- 수정 범위가 작음
- 기존 hang 감지 로직 유지
- 빠르게 적용 가능

단점:

- 정상 유휴 상태를 hang으로 오판하는 근본 문제는 남아 있음
- 시간이 길어질 뿐, 언젠가는 동일 조건에서 재시작될 수 있음

권장 수준:

```bat
set "HANG_LIMIT=120"
```

즉 30초 x 120회 = 약 1시간입니다.

## 8.2 변경안 B: snapshot hang 감지 제거, 프로세스 미존재 시에만 재실행

현재 상황에서 가장 권장하는 방향입니다.

배치 적용 목적이 과거의 비정상 종료 대응이었고, 현재는 정상 동작 중임에도 유휴 시간 때문에 재시작되는 문제가 더 크다면, hang 감지 로직은 제거하거나 비활성화하는 것이 안전합니다.

이 방식에서는 다음 경우에만 재실행합니다.

```text
CISReceiverU.exe 프로세스가 존재하지 않을 때
```

즉 정상 유휴 상태에서는 재시작하지 않습니다.

예시 로직:

```bat
tasklist /FI "IMAGENAME eq %RECEIVER_EXE%" | findstr /I "%RECEIVER_EXE%" >nul 2>&1
if errorlevel 1 (
    echo [%TIME%] CISReceiver is not running. Starting...
    start "" /b /min "%RECEIVER_TARGET%"
) else (
    echo [%TIME%] CISReceiver is running.
)

timeout /t %CHECK_INTERVAL_SEC% /nobreak >nul
goto MAIN_LOOP
```

장점:

- 정상 유휴 상태에서 재시작하지 않음
- 운영상 예측 가능성이 높음
- 오탐으로 인한 Receiver 재기동 방지

단점:

- 실제 hang 상태이지만 프로세스가 살아 있는 경우에는 자동 복구하지 못함

권장 상황:

- 현재 CISReceiver 비정상 종료 문제가 해소됨
- 정상 유휴 중 재시작되는 것이 더 큰 문제임
- 프로세스가 아예 종료된 경우만 복구하면 충분함

## 8.3 변경안 C: hang 감지를 유지하되 더 정확한 기준으로 변경

정교한 감지가 필요하다면 `tasklist` snapshot 비교 대신 다음 기준 중 하나를 사용하는 것이 더 좋습니다.

- CISReceiver 자체 로그의 마지막 갱신 시간 확인
- Receiver가 사용하는 포트 응답 확인
- DB heartbeat 또는 처리 테이블 timestamp 확인
- Windows Event Log 확인
- 애플리케이션이 제공하는 health check 기능 확인

다만 이 방식은 CISReceiver의 구조와 실제 운영 방식에 대한 추가 정보가 필요합니다.

## 9. 권장 변경안

현재 사용자 의견을 기준으로 하면 다음 판단이 적절합니다.

```text
기존 목적:
비정상 종료 또는 hang 발생 시 자동 재시작

현재 상황:
비정상 종료 문제는 줄어들었고, 정상 유휴 상태에서 재시작되는 것이 문제로 보임

권장 방향:
snapshot 기반 hang 감지 로직은 비활성화하고, 프로세스 미존재 시에만 재실행
```

즉 권장 순서는 다음과 같습니다.

1. 우선 `HANG_LIMIT`를 크게 늘려 긴급 완화
2. 운영 확인 후 snapshot hang 감지 로직 제거
3. 필요 시 더 정확한 health check 방식으로 재설계

## 10. 최소 변경 예시

### 10.1 단순 시간 증가

기존:

```bat
set "HANG_LIMIT=10"
```

변경:

```bat
set "HANG_LIMIT=120"
```

효과:

```text
약 5분 기준 -> 약 1시간 기준
```

이 변경은 가장 간단하지만, 정상 유휴 상태를 hang으로 오판하는 구조는 그대로 남습니다.

### 10.2 hang 감지 비활성화

다음 구간을 사용하지 않도록 처리합니다.

```bat
if "!PREV_LINE!"=="%CUR_LINE%" (
    set /a SAME_COUNT+=1
) else (
    set "SAME_COUNT=1"
    set "PREV_LINE=%CUR_LINE%"
)

if !SAME_COUNT! geq %HANG_LIMIT% (
    taskkill /f /im "%RECEIVER_EXE%" >nul 2>&1
    timeout /t 2 /nobreak >nul
    start "" /b /min "%RECEIVER_TARGET%"
    set SAME_COUNT=0
)
```

대신 프로세스 존재 여부만 확인하도록 단순화합니다.

```bat
tasklist /FI "IMAGENAME eq %RECEIVER_EXE%" | findstr /I "%RECEIVER_EXE%" >nul 2>&1
if errorlevel 1 (
    echo [%TIME%] CISReceiver is not running. Starting...
    start "" /b /min "%RECEIVER_TARGET%"
) else (
    echo [%TIME%] CISReceiver is running.
)

timeout /t %CHECK_INTERVAL_SEC% /nobreak >nul
goto MAIN_LOOP
```

## 11. 최종 결론

현재 배치 파일은 CISReceiver의 실제 유휴 시간이나 업무 처리 상태를 직접 확인하지 않습니다.

대신 `tasklist` 출력 한 줄이 계속 동일한지를 보고 hang 여부를 판단합니다.

현재 설정은 다음과 같습니다.

```text
CHECK_INTERVAL_SEC=30
HANG_LIMIT=10
```

따라서 약 5분 동안 `tasklist` snapshot이 동일하면 hang으로 판단하고 `CISReceiverU.exe`를 강제 종료 후 재시작합니다.

이 때문에 강북삼성 환경에서 CISReceiver가 정상적으로 대기 중인 상태라도 5-8분 정도 변화가 없으면 재실행될 수 있습니다.

운영상 CISReceiver의 비정상 종료 문제가 현재 해소되었다면, 기존 hang 감지 로직은 더 이상 필요하지 않을 가능성이 높습니다.

권장 조치는 다음과 같습니다.

```text
1순위: snapshot 기반 hang 감지 비활성화
2순위: 프로세스가 없을 때만 재시작
3순위: 즉시 변경이 어렵다면 HANG_LIMIT를 60-120 이상으로 증가
```

가장 보수적인 임시 변경은 다음입니다.

```bat
set "HANG_LIMIT=120"
```

가장 권장되는 운영 변경은 다음입니다.

```text
CISReceiverU.exe 프로세스가 없을 때만 CISReceiverU_Console.lnk로 재실행
```
