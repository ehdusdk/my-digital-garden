---
{"dg-publish":true,"permalink":"/cis-receiver-3-0/","tags":["강북삼성","CISReceiver","CIS","트러블슈팅","분석","Watcher"],"dg-note-properties":{"tags":["강북삼성","CISReceiver","CIS","트러블슈팅","분석","Watcher"],"작성일":"2026-07-02","환경":"강북삼성 CIS Receiver 3.0 (v3.0.1.9), 다이얼로그 모드(비서비스)"}}
---

# 강북삼성 CISReceiver 3.0 비정상종료 분석

> **작성일**: 2026-07-02
> **대상**: `CIS_3000\CISReceiver` (CIS Receiver 3.0, v3.0.1.9) — 강북삼성 운영 서버 (116.2.12.x / 10.10.140.217)
> **참고 소스**: `CIS_3000\trunk\source\CISReceiver`, `CIS_LIB_2008\CISLib`, `CIS_LIB_2008\CISModalityLib`
> **실행 모드**: 서비스 모드 아님 (다이얼로그/콘솔 모드) + `CIS_RECEIVER_WATCHER.bat` 상시 감시

---
## 김도연 결과
1. **현재 아래 AI 관련 분석 내용에 3, 4번 내용을 참고하여 볼때 정상적인 동작을하나 CIS_Receiver_Watcher.bat 에 hang 로직에 걸려 종료 되는 것으로 판단됨**
	1. **유사한 시간 간격( 대략 20-30분간격)의 CISReceiver 종료가 오히려 많아짐** 
	2. **26/06/5일 경우 새벽 내용 제외한 대략 30번이상의 재실행 됨** 
	3. **로그상 비정상적인 종료일 경우 보여야할 로그메세지가 없다고 함**
2. 신동민 부장님 적용한 일시 26/06/16 이후 26/06/17 dump 파일이 생성 이후에 파일을 삭제한 것인지는 CISReceiver.log 확인시에는 정상적인 동작수행 하고 유휴기간에 CIS_Receiver_Watcher.bat 가 CISReceiver3.0 프로세스를 주기적으로 Kill 한것으로 보임
	1. 26/06/17 dump 파일에 대한것은 좀더 확인이 필요할 수 있다.
	2. 로그나 덤프파일이 쌓이는것을 지운 것으로 보임 ( 26/06/25 이전 로그는 보이지 않음)
3. 코드 자체 잠재 이슈 분석 내용도 있으나 우선 제외한다.
4. AI(Claude Fable5 ) 분석 결과 내용에서 Watcher. 배치파일자체로도 코드 자체 미흡한 부분을 분석해 줬음 추후 필요시 코드 개선은 필요해 보임
	1. 미흡한 부분
		1. CIS_Receiver_Watcher.ba가 hang 걸리는 내용을 메모리 사용량과 유휴시간으로 판단지 않고  heartbit 관련 정보를 CISReceiver에서 남기고 그 시간을 확인하여 처리하는 방법을 AI가 분석 하여 제안하였으나 현재 적용 X
		2. 기타 코드상에 취약한 내용도 있긴 함 
		3. Watcher 프로세스 Kill 동작자체도 문제가 될수 있는 부분을 언급하긴 함함
	2. Watcher 실행을 하지않고 정상적으로 도는지 확인 했으면 함 or 미흡한 내용까지 적용할지 판단 필요 함 

## 1. 요약 (결론 먼저)

이 시스템의 재시작은 **두 종류가 섞여** 있다.

| 유형 | 증거 | 판정 |
|---|---|---|
| ① Watcher bat의 유휴 오판 강제 재시작 | 06-25 / 06-28 / 06-30 로그. 유휴 5~8분 후 재기동, 크래시 마커 없음 | **비정상 아님** (bat 로직에 의한 의도된 kill, 단 오판) |
| ② 실제 크래시 (0xC0000005 ACCESS_VIOLATION) | 06-04 로그. `Unhandled exception` 8건 + 미니덤프 8개 | **실존 결함** — 별도 트래킹 필요 |

- Watcher bat은 `tasklist` 스냅샷(메모리 사용량 포함)이 30초 × 10회 연속 동일하면 "행(hang)"으로 판정하고 `taskkill /f` 후 재실행한다. **정상 유휴 상태에서도 메모리는 변하지 않으므로**, 검사 유입이 없는 시간대에는 건강한 프로세스를 약 5분마다 죽였다 살리는 동작이 반복된다.
- 06-04에 확인된 0xC0000005 크래시는 watcher와 무관한 실제 크래시로, 동일 주소(`0x5945C762`, DLL 대역) 반복 → 재현성 있는 결함. 미니덤프 + pdb 심볼 분석이 필요하다.

---

## 2. 재시작 판별 기준 (로그 마커)

CISReceiver 3.0에는 26/03/30 `InitRuntimeBehavior()` 패치로 크래시 핸들러가 들어가 있다 (`CISReceiver.cpp`).

| 마커 | 의미 | 소스 위치 |
|---|---|---|
| `EnableRuntimeAppLog()::[Runtime] AppGlobal logger connected.` | **프로세스 기동 배너** — InitInstance에서 1회만 출력. 이 라인 수 = 기동 횟수 | `CISReceiver.cpp:313` |
| `[Runtime] Unhandled exception detected. code[0x...]` | 크래시 핸들러 발동 | `CISReceiver.cpp:261` |
| `[Runtime] Dump saved. path[...dmp]` | 미니덤프 저장 | `CISReceiver.cpp:244` |
| `Terminate the service` / `... has been destroyed` | 정상 종료 시퀀스 | `CISReceiver.cpp:491`, `T_AutoMatch.cpp:197`, `T_WatingOrder.cpp:168` |

**판별 공식**:
- 크래시 = 기동 배너 직전에 `Unhandled exception` + `Dump saved` 존재
- Watcher kill = 종료 흔적 0 + 크래시 마커 0 + 곧바로 기동 배너 (`taskkill /f`는 로그를 남길 틈이 없음)

서버에서 일괄 확인:
```bat
findstr /C:"Unhandled exception" /C:"Dump saved" "CIS Receiver_*.log"
```

---

## 3. 06-25 로그 — 재시작 13회 (Watcher 소행)

`CIS Receiver_20260625.log` (v3.0.1.9) 캡처. `logger connected` 배너 기준 재시작 시각:

| # | 재시작 시각 | 직전과 간격 |
|---|---|---|
| 1 | 00:16:39 | (로그 시작) |
| 2 | 00:42:04 | 25분 25초 |
| 3 | 01:09:08 | 27분 4초 |
| 4 | 01:36:39 | 27분 31초 |
| 5 | 02:05:57 | 29분 18초 |
| 6 | 02:31:22 | 25분 25초 |
| 7 | 02:58:29 | 27분 7초 |
| 8 | 03:34:49 | 36분 20초 |
| 9 | 04:01:54 | 27분 5초 |
| 10 | 04:29:24 | 27분 30초 |
| 11 | 04:54:50 | 25분 26초 |
| 12 | 05:21:53 | 27분 3초 |
| 13 | 05:48:55 | 27분 2초 |

- 캡처 범위(00:16~06:11) 내 13회, 평균 약 27분 간격.
- 각 재기동 직전 정상 종료 로그·크래시 마커 모두 없음 → 외부 강제 종료.
- 심야(검사 유입 적음)의 ~27분 주기는: 재기동 직후 DB 연결/스레드 기동/10초 주기 wakeup으로 메모리가 한동안 흔들리다가, 안정화되면 10연속 동일 스냅샷 → kill 사이클의 반복으로 설명된다.

### 캡처 원본

![강북삼성-CISR30-0625로그-01.png](/img/user/%EA%B0%95%EB%B6%81%EC%82%BC%EC%84%B1-CISR30-0625%EB%A1%9C%EA%B7%B8-01.png)
![강북삼성-CISR30-0625로그-02.png](/img/user/%EA%B0%95%EB%B6%81%EC%82%BC%EC%84%B1-CISR30-0625%EB%A1%9C%EA%B7%B8-02.png)
![강북삼성-CISR30-0625로그-03.png](/img/user/%EA%B0%95%EB%B6%81%EC%82%BC%EC%84%B1-CISR30-0625%EB%A1%9C%EA%B7%B8-03.png)
![강북삼성-CISR30-0625로그-04.png](/img/user/%EA%B0%95%EB%B6%81%EC%82%BC%EC%84%B1-CISR30-0625%EB%A1%9C%EA%B7%B8-04.png)
![강북삼성-CISR30-0625로그-05.png](/img/user/%EA%B0%95%EB%B6%81%EC%82%BC%EC%84%B1-CISR30-0625%EB%A1%9C%EA%B7%B8-05.png)

---

## 4. 06-28 / 06-30 로그 — 유휴 5~8분 후 재시작 (Watcher 확정 패턴)

| 날짜 | 마지막 작업 완료 | 재시작 배너 | 유휴 간격 |
|---|---|---|---|
| 06-30 | 07:13:53 (CopyOutputXML 완료) | 07:19:23 | 5분 30초 |
| 06-30 | 07:48:47 | 07:54:52 | 6분 05초 |
| 06-28 | 07:36:31 | 07:41:39 | **5분 08초** (이론 최소치와 일치) |
| 06-28 | (캡처 범위 밖) | 08:07:06 | 판단 보류 |
| 06-28 | 08:18:16 | 08:25:52 | 7분 36초 |
| 06-28 | 08:36:56 | 08:44:40 | 7분 44초 |

- 모든 재시작이 **마지막 작업 완료 후 5~8분 유휴** 시점에 발생. 작업 도중 끊긴 사례 없음.
- Watcher 이론값 `HANG_LIMIT(10) × CHECK_INTERVAL(30s) = 300초`와 최단 간격 5분 08초가 정확히 부합.
- +1~3분 편차는 작업 종료 직후 메모리(working set)가 안정될 때까지 스냅샷이 바뀌며 `SAME_COUNT`가 리셋된 시간.

### 캡처 원본

![강북삼성-CISR30-0628_0630로그-01.png](/img/user/%EA%B0%95%EB%B6%81%EC%82%BC%EC%84%B1-CISR30-0628_0630%EB%A1%9C%EA%B7%B8-01.png)
![강북삼성-CISR30-0628_0630로그-02.png](/img/user/%EA%B0%95%EB%B6%81%EC%82%BC%EC%84%B1-CISR30-0628_0630%EB%A1%9C%EA%B7%B8-02.png)
![강북삼성-CISR30-0628_0630로그-03.png](/img/user/%EA%B0%95%EB%B6%81%EC%82%BC%EC%84%B1-CISR30-0628_0630%EB%A1%9C%EA%B7%B8-03.png)
![강북삼성-CISR30-0628_0630로그-04.png](/img/user/%EA%B0%95%EB%B6%81%EC%82%BC%EC%84%B1-CISR30-0628_0630%EB%A1%9C%EA%B7%B8-04.png)
![강북삼성-CISR30-0628_0630로그-05.png](/img/user/%EA%B0%95%EB%B6%81%EC%82%BC%EC%84%B1-CISR30-0628_0630%EB%A1%9C%EA%B7%B8-05.png)

---

## 5. CIS_RECEIVER_WATCHER.bat 분석

### 핵심 로직

```bat
set "CHECK_INTERVAL_SEC=30"   ← 30초마다 검사
set "HANG_LIMIT=10"           ← 동일 스냅샷 10회 연속이면 행 판정

for /f "tokens=*" %%a in ('tasklist /FI "IMAGENAME eq CISReceiverU.exe" ^| findstr ...') do set "CUR_LINE=%%a"
if "!PREV_LINE!"=="%CUR_LINE%" ( set /a SAME_COUNT+=1 ) else ( SAME_COUNT=1 )
if !SAME_COUNT! geq %HANG_LIMIT% (
    taskkill /f /im CISReceiverU.exe
    start "" /b /min CISReceiverU_Console.lnk
)
```

`tasklist` 출력 한 줄 = 이미지명 + PID + 세션 + **메모리 사용량(KB)** → 이 로직은 사실상 **"메모리가 5분간 동일하면 행"** 판정이다.

### 문제점

1. **정상 유휴 ≠ 행** — CISReceiver는 유휴 시 정상적으로 잠든다 (매칭 스레드 `EnterIdle(10000)` 10초 대기, `T_AutoMatch.cpp:79-85`). 이때 working set이 변하지 않는 것이 정상이므로 **건강한 프로세스를 5분마다 재시작**하게 된다.
2. **재시작 순간 유실 위험** — kill 직전 새 XML이 폴링되면 작업 도중 강제 종료:
   - TC-35 `FixBOM()`은 원본 XML을 truncate 후 재작성 (`Philips_TC35.cpp:116-122`) → 그 사이 kill되면 수신 원본 소실
   - `SetExam`/`SetMatch` DB 처리 도중이면 반쪽 매칭 가능
3. **진짜 행은 놓칠 수 있음** — 메모리가 계속 변하는 busy-loop형 행은 스냅샷이 계속 바뀌어 영원히 감지 안 됨.

### 확정 검증 방법

```bat
CIS_RECEIVER_WATCHER.bat >> D:\INFINITT\CISReceiver3.0\watcher_history.log 2>&1
```
bat의 `[%TIME%] Hang Confirmed. Restarting Process!` 시각 + 2~3초 = receiver 로그의 `logger connected` 시각이면 100% 확정.

### 캡처 원본

![강북삼성-CISR30-watcherbat-01.png](/img/user/%EA%B0%95%EB%B6%81%EC%82%BC%EC%84%B1-CISR30-watcherbat-01.png)
![강북삼성-CISR30-watcherbat-02.png](/img/user/%EA%B0%95%EB%B6%81%EC%82%BC%EC%84%B1-CISR30-watcherbat-02.png)

---

## 6. 개선안 — 하트비트 방식

### 앱 쪽 (한 줄 수준 추가, 다이얼로그 모드 기준)

**1순위: `CISReceiverDlg::OnTimer()`** — `CISReceiverDlg.cpp:727`
- 이미 5초 주기 타이머가 상시 동작 중 (`SetTimer(TIMER_ID_CLOSE_CRASH_POPUP, 5000, NULL)` — `CISReceiverDlg.cpp:475`, 종료 시 `:716`에서 KillTimer)
- 유휴/작업 여부와 무관하게 항상 돌기 때문에 최적 위치

```cpp
void CISReceiverDlg::OnTimer(UINT_PTR nIDEvent)
{
    if(nIDEvent == TIMER_ID_CLOSE_CRASH_POPUP)
    {
        CloseRuntimeCrashPopup();

        // Heartbeat (60초마다 갱신)
        static DWORD s_dwLastBeat = 0;
        if(::GetTickCount() - s_dwLastBeat >= 60000)
        {
            s_dwLastBeat = ::GetTickCount();
            // D:\INFINITT\CISReceiver3.0\heartbeat.txt 에 현재시각 덮어쓰기
        }
    }
    __super::OnTimer(nIDEvent);
}
```

**2순위(보완): `T_AutoMatch::RunInstance()` while 루프** — `T_AutoMatch.cpp:74-96`
- 유휴 시에도 10초마다 깨어남. `PopJob` 실패 분기에 추가.

| 위치 | 증명하는 것 | 한계 |
|---|---|---|
| OnTimer (UI 스레드) | 프로세스 생존 + 메시지펌프 정상 | 워커 스레드 행은 못 잡음 |
| T_AutoMatch 루프 (워커) | 매칭 스레드 생존 | AutoMatch/CDW OFF 구성이면 스레드 없음 (`AppGlobal.cpp:288-292`) |

두 곳에서 각각 다른 파일(`heartbeat_ui.txt`, `heartbeat_match.txt`)을 갱신하면 구분 감지 가능.
주의: 하트비트 쓰기는 실패해도 무시(try/반환값 무시) — 디스크 풀/권한 문제로 본체가 죽으면 본말전도.

### bat 쪽

`tasklist` 스냅샷 비교 대신 하트비트 파일 갱신 시각만 검사:

```bat
REM heartbeat.txt가 300초 이상 갱신 안 됐을 때만 재시작
powershell -nop -c "exit ((Get-Date)-(Get-Item 'D:\INFINITT\CISReceiver3.0\heartbeat.txt').LastWriteTime).TotalSeconds -gt 300"
if %errorlevel% equ 1 ( ... taskkill 후 재시작 ... )
```

추가 권고:
- kill 시 `taskkill /f` 직행 대신 → 정상 종료 시도(`taskkill`(no /f) → WM_CLOSE) 후 10초 대기 → 미종료 시에만 `/f`. 로그에 정상 종료 흔적이 남아 이후 크래시와 즉시 구분됨.
- 코드 수정 없이 bat만 고치는 차선책: `tasklist /v`의 **CPU Time** 컬럼 비교 — 유휴 프로세스도 10초 주기 wakeup으로 CPU 시간이 미세하게 증가하므로 메모리 스냅샷보다 정확.

---

## 7. 별건 ① — 06-04 실제 크래시 (0xC0000005)

디스크의 `CIS_3000\trunk\bin\Win32\ReleaseUnicode\Log\CISReceiver\CIS Receiver_20260604.log` 집계:

| 마커 | 횟수 |
|---|---|
| `AppGlobal logger connected` (기동) | 11 |
| `Terminate the service` (정상종료) | **0** |
| `Unhandled exception detected` | **8** |
| `Dump saved` | **8** |

크래시 시그니처 (반복 동일):
```
[Runtime] Unhandled exception detected. code[0xC0000005] exceptionAddr[0x5945C762]
```

- `0xC0000005` = ACCESS_VIOLATION. 동일 주소 반복 → 같은 코드 경로의 재현성 결함.
- 주소 `0x5945C762`는 `0x59...` 대역 = 메인 exe(0x00400000 대역) 아닌 **로드된 DLL 내부** → CISLib / CISModalityLib 계열 유력.
- 후행 `0xC015000F`/`0xC0150010`(ntdll)은 언와인딩 중 SxS 오류로 2차 파생.
- 일부는 기동 20초 만에 크래시(18:08:55 기동 → 18:09:17) → 시작/매칭 초기 경로 의심.

**후속 조치**: 운영 서버의 `CISReceiver_*.dmp` + 해당 빌드 `.pdb`(CISReceiverU / CISLib / CISModalityLib)로 WinDbg 심볼 분석 → 함수/라인 특정.

---

## 8. 별건 ② — TC-35 모달리티 파싱 잠재 이슈

TC-35는 `Philips_TC35_Parser` → `Philips_TRIM3_Parser` → `CISECGParser` 상속 구조. 캡처된 TC-35 파싱은 전부 성공(`Total: 1, Success: 1, Failure: 0`)이며, `exitCode[57005]` = 0xDEAD로 **정상 종료 코드**다(에러 아님). `Empty : Patient Name`도 경고성 로그일 뿐 파싱은 계속된다 — 단 매칭이 PatID에 전적으로 의존하게 됨.

### 잠재 이슈 (심각도 순)

| # | 심각도 | 내용 | 위치 |
|---|---|---|---|
| 1 | 높음 | **V1.04 계열 SVG 변환 실패 시 폴백 없음** — `ConvertWave_SVG()` 반환값 무시. V1.03은 실패 시 `ConvertWave()` 폴백 있으나 V1.04는 없음 → 파형 없는 검사 업로드 가능 | `Philips_TRIM3_Parser.cpp:808-811` |
| 2 | 높음 | **ConvertWave 버퍼 경계 미검증** — 비압축 시 실제 디코딩 길이와 선언값(`durationperchannel × numberofleads`) 불일치 시 OOB read. `GetWave(Lead)` NULL 체크 없이 `GetWaveBuffer()` 호출 → 비표준 리드 라벨 유입 시 AV. `catch(...)`는 /EHa 아니면 SEH AV 못 잡음 → **0xC0000005 크래시 후보 경로** | `Philips_TRIM3_Parser.cpp:1313-1363` |
| 3 | 중간 | **FixBOM의 원본 in-place 재작성** — `modeCreate`로 truncate 후 재작성. 도중 kill/크래시 시 원본 소실. `CFileException` 미처리. UTF-16 **BE** BOM(FE FF) 유입 시 0xFE만 제거되어 파일 훼손. 4바이트 미만 파일 무조건 실패 | `Philips_TC35.cpp:84-146` |
| 4 | 중간 | **지원 문서버전 하드코딩** — 1.03 / 1.04 / 1.04.01 / 1.04.02만. 펌웨어 업데이트로 다른 버전이 오면 전량 파싱 실패 | `Philips_TRIM3_Parser.cpp:59-89` |
| 5 | 낮음 | **PatientID 필수** — 비어 있으면 파싱 실패. 미등록 환자/응급 시나리오 확인 필요 | `Philips_TRIM3_Parser.cpp:505-512` |
| 6 | 참고 | `bWaveFormLast10Sec` 마지막 10초 고정, 임의 구간 옵션 TODO (26/06/23 주석) | `Philips_TRIM3_Parser.cpp:1334-1350` |

미니덤프 분석 시 `ConvertWave` / `ConvertWave_SVG` 스택 여부를 우선 확인 권장.

### 캡처 원본 (Philips_TC-35_TC-35_20260625.log)

![강북삼성-CISR30-TC35로그-01.png](/img/user/%EA%B0%95%EB%B6%81%EC%82%BC%EC%84%B1-CISR30-TC35%EB%A1%9C%EA%B7%B8-01.png)
![강북삼성-CISR30-TC35로그-02.png](/img/user/%EA%B0%95%EB%B6%81%EC%82%BC%EC%84%B1-CISR30-TC35%EB%A1%9C%EA%B7%B8-02.png)
![강북삼성-CISR30-TC35로그-03.png](/img/user/%EA%B0%95%EB%B6%81%EC%82%BC%EC%84%B1-CISR30-TC35%EB%A1%9C%EA%B7%B8-03.png)
![강북삼성-CISR30-TC35로그-04.png](/img/user/%EA%B0%95%EB%B6%81%EC%82%BC%EC%84%B1-CISR30-TC35%EB%A1%9C%EA%B7%B8-04.png)
![강북삼성-CISR30-TC35로그-05.png](/img/user/%EA%B0%95%EB%B6%81%EC%82%BC%EC%84%B1-CISR30-TC35%EB%A1%9C%EA%B7%B8-05.png)
![강북삼성-CISR30-TC35로그-06.png](/img/user/%EA%B0%95%EB%B6%81%EC%82%BC%EC%84%B1-CISR30-TC35%EB%A1%9C%EA%B7%B8-06.png)

---

## 9. 액션 아이템

- [ ] Watcher bat 출력 리다이렉트로 kill 시각 ↔ 기동 배너 시각 1:1 대조 (확정 검증)
- [ ] 하트비트 방식 적용: 앱(`CISReceiverDlg::OnTimer` 60초 스로틀) + bat(파일 mtime 검사)
- [ ] `taskkill /f` 직행 → 2단계 종료(정상 종료 시도 후 강제)로 변경
- [ ] 06-04 크래시: 운영 서버 `.dmp` + `.pdb` 확보 → WinDbg 심볼 분석 (`0x5945C762` 특정)
- [ ] TC-35: V1.04 SVG 폴백 부재 / ConvertWave NULL·경계 검증 / FixBOM 임시파일+rename 방식 개선 검토

---

[[CIS 2.0/CIS 분석\|← CIS 분석 인덱스로]]
