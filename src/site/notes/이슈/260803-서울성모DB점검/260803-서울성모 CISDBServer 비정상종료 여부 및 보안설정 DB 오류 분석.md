---
{"dg-publish":true,"permalink":"//260803-db/260803-cisdb-server-db/","title":"260803-서울성모 CISDBServer 비정상종료 여부 및 보안설정 DB 오류 분석","tags":["이슈","CIS2.0","서울성모","CISDBServer","CISWatcher","이벤트뷰어","WER","Oracle","PKGSECURITY","힙손상","트러블슈팅"],"dg-note-properties":{"title":"260803-서울성모 CISDBServer 비정상종료 여부 및 보안설정 DB 오류 분석","date":"2026-08-03","tags":["이슈","CIS2.0","서울성모","CISDBServer","CISWatcher","이벤트뷰어","WER","Oracle","PKGSECURITY","힙손상","트러블슈팅"],"status":"분석완료","updated":"2026-08-03"}}
---

# 260803-서울성모 CISDBServer 비정상종료 여부 및 보안설정 DB 오류 분석

## 1. 개요

| 항목 | 내용 |
|---|---|
| 발생일시 | 2026-08-03(월) 오전 10시 초반 |
| 발생부서 | 서울성모병원 류마티스 검사실 |
| 증상 | CIS ↔ NEIS 매칭 시 **"보안설정관련 DB 작업이 실패되었습니다."** 메시지 발생 |
| 조치 | 재실행 후 매칭 정상 확인 |
| 분석목적 | 1/2호기 CISDBServer의 **8/2~8/3 비정상 종료 여부** 확인 및 원인 정리 |

### 분석 대상 로그

| 구분 | 파일 |
|---|---|
| 1호기 (172.17.33.54 / knmemap1) | `CISDBServer_20260802.log`, `CISDBServer_20260803.log`, `CISWatcher_20260801.log`, `260803-eventlogfile.evtx` |
| 2호기 (172.17.33.55 / knmemap2) | `CISDBServer_20260802.log`, `CISDBServer_20260803.log`, `CISWatcher_20260802.log`, `CISWatcher_20260803.log`, `260803-2호기EventLog.evtx` |
| App 버전 | CIS Database Server **v2.0.1.2**, CISWatcher **v1.0.0.1** |

---

## 2. 결론 요약

> [!결론]
> **8/2 ~ 8/3 양일간 1호기·2호기 모두 CISDBServer 비정상 종료(크래시)는 발생하지 않았다.**
> 유일한 프로세스 중단은 **매일 03:00 정기 재기동**이며, 로그상 정상 종료 절차(graceful shutdown)를 완주했다.
> 금일 장애는 서버 다운이 아니라 **특정 단말 1대의 세션 컨텍스트 유실로 인한 `PKGSECURITY.GetOrderSecurity` 조회 실패**가 원인이다.
> 단, **별건으로 1호기 CISWatcher가 8/1 19:08:30에 힙 손상으로 크래시한 뒤 재기동 정황이 확인되지 않아 감시 공백 가능성**이 있다.

| 확인 항목 | 결과 |
|---|---|
| 8/2~8/3 CISDBServer 비정상 종료 | **없음** (1호기·2호기 모두) |
| 프로세스 재시작 | 매일 03:00 정기 재기동 4건 — 전부 정상 절차 |
| 이벤트뷰어 신규 APPCRASH | CISDBServer 관련 **0건** |
| 실제 장애 원인 | 1호기 / 클라이언트 `10.10.44.85` / `GetOrderSecurity` -605 (NO_DATA_FOUND) |
| 2호기 오류 | 8/2·8/3 전체 기간 ERROR **0건** |
| **별건 이슈** | **1호기 `CISWatcherU.exe` 크래시 (8/1 19:08:30, `ntdll.dll` / `c0000005`)** |

---

## 3. 프로세스 기동/종료 이력 (KST)

| 호기 | 일자 | Shutdown initialized | Server has been stopped | Logger started | Database server successfully started | 판정 |
|---|---|---|---|---|---|---|
| 1호기 | 08-02 | 03:00:00 | 03:00:03 | 03:00:34 | 03:00:36 | 정상 |
| 1호기 | 08-03 | 03:00:00 | 03:00:02 | 03:00:34 | 03:00:37 | 정상 |
| 2호기 | 08-02 | 03:00:02 | 03:00:09 | 03:00:18 | 03:00:21 | 정상 |
| 2호기 | 08-03 | 03:00:02 | 03:00:04 | 03:00:13 | 03:00:16 | 정상 |

### 정상 종료로 판단한 근거

- 4건 모두 아래 순서를 **완주**했다. 비정상 종료(크래시) 시 나타나는 **로그 단절 후 무예고 재시작** 패턴이 없다.

```
Shutdown initialized
  → Server has been stopped
  → Logger successfully started
  → IO/WORKER THREAD STARTED, LISTNER STARTED!
  → Server successfully started [172.17.33.5x.4002]
  → Database server successfully started
```

- 이벤트뷰어에도 동일 시각(UTC 18:00 = KST 03:00)에 `INFINITT CIS Database Service` **Level 4(정보)** 이벤트만 기록되었다. 오류/경고 레벨 서비스 이벤트 없음.
- 로그 커버리지: 1호기 `00:33:07 ~ 10:26:31`, 2호기 `00:00:00 ~ 10:34:49` (8/3 기준) — 사고 시간대 전 구간 확보.

### CISWatcher (2호기) 교차 검증

`CISWatcher`는 03:00 재기동 구간을 제외하면 **전 시간대 `The server state is normal`** 만 기록했다.

| 일자 | 시각 | 내용 |
|---|---|---|
| 08-02 | 03:00:05 ~ 03:00:21 | `abnormal(check count:0~1)` → `Unable to find the executed program (1~3)` → `The Program is excuted successfully` → `monitoring mode` |
| 08-03 | 03:00:07 ~ 03:00:16 | `check process mode` → `Unable to find the executed program (1~3)` → `The Program is excuted successfully` → `monitoring mode` |

- 비정상 로그 라인 수: 8/2 **15줄**, 8/3 **13줄** (헤더 5줄 포함) → 03:00 재기동 구간이 전부다.
- 오전 10시 전후 감시 이상 감지 **없음**.

---

## 4. 이벤트뷰어 APPCRASH 분석 (해석 주의)

### 4-1. 원시 건수는 과대 계상되어 있음

| 호기 | WER 이벤트 총건수 | **고유 크래시 수** |
|---|---|---|
| 1호기 | 14,705 | **41** |
| 2호기 | 13,662 | **11** |

- WER(Windows Error Reporting) EventID 1001이 하루 2,000건 가까이 찍히지만, `ReportQueue` 경로 기준으로 중복 제거하면 고유 리포트는 41건 / 11건이다.
- **원인**: `C:\ProgramData\Microsoft\Windows\WER\ReportQueue` 에 적체된 동일 리포트를 WER이 약 30분 주기로 **반복 재전송**하고 있다. 신규 크래시가 아니다.
- 앱별 이벤트 건수(1호기: CISDBServerU 3,652 / CIS_Remover 2,560 / eFTPd 1,464 …)를 그대로 크래시 횟수로 읽으면 **오판**한다.

> [!warning] 정정 사항 (2026-08-03 추가 분석)
> 초판에서 1호기 `CISWatcherU.exe`를 **2건**(`ffffbaad`, `ntdll.dll`)으로 계상했으나, 두 WER 리포트의 **Report Id가 `44f15294-fb43-4871-a74f-39b317d6483b`로 동일**하다. 즉 **한 번의 크래시에 대한 후속 리포트 2건**이므로 실제 고유 크래시는 **1건**이며, 1호기 고유 크래시 총계도 42 → **41건**으로 정정한다.

### 4-2. 고유 크래시 내역

**1호기 (총 41건)**

| 건수 | 프로세스 | 오류 모듈 | 예외코드 |
|---|---|---|---|
| 10 | `CISDBServerU.exe` (2.0.1.2) | **`oracore19.dll` (12.0.0.0)** | `c0000005` (액세스 위반) |
| 7 | `CIS_Remover.exe` | `ntdll.dll` | `c00000fd` (스택 오버플로우) |
| 4 | `eFTPd.exe` | `KERNELBASE.dll` | `c0000028` |
| 3 | `DB_Linker.exe` | `KERNELBASE.dll` | `c0000005` |
| 3 | `CDWDBServer.exe` | **`oracore19.dll`** | `c0000005` |
| 2 | `CDWExporter.exe` | `KERNELBASE.dll` | `c0000005` |
| 2 | `MobileGateway.exe` / `FriendlyGateway.exe` | `StackHash_0441` | `c0000374` (힙 손상) |
| **1** | **`CISWatcherU.exe` (1.0.0.1)** | **`ntdll.dll` (10.0.17763.5933)** | **`c0000005`** ← [5장](#5-1호기-ciswatcher-크래시-상세-2026-08-01) |
| 기타 | `CISOutbrokerU`, `CISReceiverU`, `mmc`, `explorer` 등 | - | - |

**2호기 (총 11건)**

| 건수 | 프로세스 | 오류 모듈 | 예외코드 |
|---|---|---|---|
| 2 | `CISDBServerU.exe` | **`oracore19.dll`** | `c0000005` |
| 2 | `FriendlyGateway.exe` | `StackHash_0441` | `c0000374` |
| 2 | `ConsentGateway.exe` | `StackHash_0441` | `c0000374` |
| 2 | `explorer.exe` | - | - |
| 2 | `eFTPd.exe` | `KERNELBASE.dll` | `c0000005` / `c0000028` |
| 1 | `explorer.exe` | - | - |

### 4-3. 발생 시점 — 8/2~8/3 신규 크래시 없음

고유 리포트의 **최초 등장 시각** 분포:

| 호기 | 2026-07-14 | 07-21 | 07-26 | 07-28 | 08-01 |
|---|---|---|---|---|---|
| 1호기 | - | - | **40** | - | **1** |
| 2호기 | **8** | 1 | - | 2 | - |

- 1호기 40건은 이벤트로그 보존 시작 시점(07-26 19:02 UTC)에 몰려 있다 → **그 이전에 발생해 큐에 적체된 리포트**이며 실제 크래시 시각은 로그 롤오버로 확인 불가.
- **07/28 이후 신규 발생분**은 아래 3건뿐이며, **CISDBServer는 한 건도 없다.**

| 호기 | 발생(KST) | 프로세스 | 비고 |
|---|---|---|---|
| 1호기 | **2026-08-01 19:08:30** | **`CISWatcherU.exe`** | Report Id `44f15294…` — 5장 참조 |
| 2호기 | 2026-07-28 19:22:54 | `explorer.exe` | - |
| 2호기 | 2026-07-28 19:24:01 | `explorer.exe` | - |

---

## 5. 1호기 CISWatcher 크래시 상세 (2026-08-01)

> [!결론]
> **CISWatcher 로그 단절 시각과 이벤트뷰어 크래시 기록이 2.15초 차이로 일치 — 동일 사건이다.**

### 5-1. 상관관계 타임라인 (KST, knmemap1)

| 시각 | 출처 | 내용 |
|---|---|---|
| 19:08:22 | `CISWatcher_20260801.log` | `App.DB Server` — The server state is normal |
| 19:08:25 | `CISWatcher_20260801.log` | `App.Storage Server` — normal |
| **19:08:28** | `CISWatcher_20260801.log` | `App.Storage Server` — normal ← **로그 마지막 줄, 여기서 단절** |
| **19:08:30.65** | 이벤트뷰어 `Application Error` (EventID 1000, Level 2) | **CISWatcherU.exe 크래시** |
| 19:08:51.75 | 이벤트뷰어 WER (EventID 1001) | `FaultTolerantHeap` / `ffffbaad` |
| 19:08:54.07 | 이벤트뷰어 WER (EventID 1001) | `APPCRASH` + `memory.hdmp` 생성 |

- 19:08:51 / 19:08:54 두 WER 이벤트의 **Report Id가 EventID 1000과 동일(`44f15294-fb43-4871-a74f-39b317d6483b`)** → 별개 크래시가 아니라 **단일 크래시의 후속 리포트**.
- 로그에는 종료 메시지가 전혀 없다 → **정상 종료가 아닌 프로세스 강제 종료(크래시)** 확정.

### 5-2. 크래시 시그니처

```
Faulting application : CISWatcherU.exe   1.0.0.1   (62a17b52)
Faulting module      : ntdll.dll   10.0.17763.5933  (34e80bed)
Exception code       : c0000005   (Access Violation)
Fault offset         : 0x0003b0e5
Faulting process id  : 0x1d04
Path                 : C:\INFINITT\CISWatcher\CISWatcherU.exe
Report Id            : 44f15294-fb43-4871-a74f-39b317d6483b
Dump                 : C:\ProgramData\Microsoft\Windows\WER\ReportQueue\
                       AppCrash_CISWatcherU.exe_6a6bfb58...dd535059_cab_2aa1a7d8\memory.hdmp
```

### 5-3. 원인 해석 — 힙 손상(Heap Corruption) 유력

| 근거 | 해석 |
|---|---|
| 오류 모듈 `ntdll.dll` + `c0000005` | 힙 관리자(`RtlFreeHeap` / `RtlpLowFragHeap` 계열) 내부에서 발생하는 전형적 패턴. 애플리케이션 코드가 아닌 런타임 내부에서 터짐 |
| WER `FaultTolerantHeap` + **`ffffbaad`** | `baadf00d` 계열 마커 = **해제된 메모리 / 손상된 힙 블록 접근**. Windows FTH가 해당 프로세스를 완화(mitigation) 대상으로 등록했다는 뜻이며, **이전에도 반복 크래시 이력이 있었을 가능성**을 시사 |
| 원인 후보 | double-free, 이미 해제된 포인터 재사용(use-after-free), 버퍼 오버런 |

### 5-4. 크래시 직전 이상 징후 없음

| 항목 | 값 |
|---|---|
| 시간당 체크 건수 (8/1) | 00시~18시 내내 **1,634 ~ 1,642건으로 완전히 일정** |
| 19시대 | 231건 (19:08:28에서 단절) |
| 대상별 총 체크 | `App.Storage Server` 22,713 / `App.DB Server` 8,584 (총 31,297) |
| 8/1 비정상 로그 | 03:00:04 ~ 03:00:16 DB Server **정기 재기동 감지 구간 뿐** |

- 폴링 주기 저하·경고 누적·타임아웃 없이 **정상 동작 중 즉사**했다.
- 특정 이벤트 처리 중 터진 것이 아니라, **장시간 누적된 힙 손상이 임의 시점에 발현**한 형태로 보인다.
- 참고: 3초(Storage) / 8초(DB Server) 주기 폴링을 19시간 동안 31,297회 반복.

### 5-5. ⚠️ 감시 공백 가능성 (확인 필요)

> [!warning]
> 제공된 1호기 로그에 **`CISWatcher_20260802.log` / `CISWatcher_20260803.log`가 없으며**, `CISWatcher_20260801.log`의 파일 수정시각도 **8/1 19:08**이다.
> → **8/1 19:08 크래시 이후 1호기 CISWatcher가 재기동되지 않아, 8/2~8/3 내내 1호기 감시가 공백 상태였을 가능성**이 크다.
> (2호기는 8/2 23:59, 8/3 10:35까지 정상 기록 중 — 대조적)
>
> **확인 필요**: 1호기 서버의 `CISWatcherU.exe` 프로세스 기동 여부, `C:\INFINITT\CISWatcher\Log` 폴더에 8/2 이후 로그 생성 여부.
> 실제로 중단 상태였다면 금일(8/3) 오전 장애 당시 1호기는 **감시 없이 운영**된 것이므로 별도 이슈로 다뤄야 한다.

관련: [[260730-CISWatcher 분석\|260730-CISWatcher 분석]]

---

## 6. 실제 장애 원인 — 보안설정 조회 실패

### 6-1. 발생 범위

- **1호기에서만**, **클라이언트 `10.10.44.85` (세션 사용자 `cm`) 단 1대**에서만 발생
- 같은 시간대 1호기 전체 `GetOrderSecurity` 호출 **1,091건 중 실패 14건** → 서버 전역 장애 아님
- **2호기는 8/2·8/3 전체 기간 `Failed to execute the query` 0건**

### 6-2. 타임라인 (2026-08-03 KST, 1호기)

| 시각 | 쿼리 | 코드 | 내용 |
|---|---|---|---|
| 07:44:28 | `GetNotifyInToday` | -607 | 선행 오류 (동일 단말) |
| 09:30:31, 09:32:22 | `GetOrderSecurity` | **-605** | OrderKey `12790702`, `pnErrcode=100` |
| 09:54:32 ~ 10:06:53 (12회) | `GetOrderSecurity` | **-605** | OrderKey `12790883`, `pnErrcode=100` |
| 10:07:08 ~ 10:07:24 (6회) | `ExLogin4` | -607 / -300001 | 재로그인 실패 (`PKGSYSTEMPROFILE.GetProfile`, `Passport verifying has been failed`) |
| **10:14:56** | `ExLogin4` | 정상 | **재로그인 성공** (0.125 sec) |
| 10:15:00 ~ 10:15:09 | `GetUserInfo`, `GetNotifyInToday`, `GetWorklist4` | 정상 | 세션 재구성 완료 |
| **10:15:16 ~ 10:15:18** | `GetOrderSecurity` → `ExMultiMatchWithAll2` → `SetOrderLastDt` | 정상 | **매칭 정상 완료** |
| 10:19:42 ~ 10:19:44 | 동일 흐름 | 정상 | 재확인 |

### 6-3. 실패 로그 상세

```
<TM>10:00:21</TM> <CT>1:CIS</CT> <TP>1:MAJOR</TP> <PF>10.10.44.85</PF>
  <LG>Query has been requested (GetOrderSecurity)</LG>
<TM>10:00:21</TM> <CT>6:ADO</CT> <TP>3:ERROR</TP> <PF>10.10.44.85.DB</PF>
  <LG>Failed to perform the procedure</LG> <CM>Failed to open the recordset</CM>
  <CD>-605</CD> <DB>CISDatabase.cpp:CISDatabase::OpenProcedure:609</DB>
  PARAM 01 : pvSessionUserId = cm
  PARAM 05 : pnErrcode = 100
  PARAM 06 : pvOrderKey  = 12790883
  → PKGSECURITY.GetOrderSecurity
<TM>10:00:21</TM> <CT>1:CIS</CT> <TP>3:ERROR</TP> <PF>10.10.44.85</PF>
  <LG>Failed to execute the query (GetOrderSecurity)</LG>
  <CM>Failed to perform the procedure</CM> <CD>-605</CD>
```

### 6-4. 원인 해석

| 코드 | 의미 |
|---|---|
| `-605` | `CISDatabase::OpenProcedure` 실패 — recordset 오픈 불가 |
| `pnErrcode = 100` | Oracle **`NO_DATA_FOUND`** — 조회 결과 없음 |
| `PKGSECURITY.GetOrderSecurity` | 오더 보안설정 조회 패키지 → **화면 메시지 "보안설정관련 DB 작업이 실패되었습니다."와 정확히 일치** |
| `-300001` / `Passport verifying has been failed` | 세션 Passport 검증 실패 |

- 실패한 OrderKey가 `12790702`, `12790883` **2건에 한정**되고, 동일 키로 12회 연속 실패 → 일시적 부하가 아닌 **결정적(deterministic) 조회 실패**
- 이후 **재로그인(세션 재생성)만으로 동일 오더가 즉시 성공** → **서버측 데이터 문제가 아니라 클라이언트 세션/Passport 컨텍스트 유실**이 유력
- `pvSessionUserId = cm` 이 다른 정상 단말의 숫자형 사번(`21700545` 등)과 형태가 다른 점도 세션 컨텍스트 이상을 뒷받침

---

## 7. 참고 — 동일자 기타 오류 (별건)

| 시각 | 클라이언트 | 쿼리 | 코드 | 내용 |
|---|---|---|---|---|
| 08:59:09 | 10.10.54.74 | `ExMultiMatchWithAll3` | -1400 → Rollback → -607 | 매칭 실패 1회성. `RB_SetExam` 후 `PkgExtraDataInterface.SetExtraData` 구간에서 발생, 트랜잭션 롤백 |
| 09:45:37 / 09:50:51 | 10.10.39.134 | `GetWorklist4` | -85 | WinSock 오류 (클라이언트측 연결 끊김) |
| 10:07:34 | 10.10.44.160 | `GetWorklist4` | -85 | WinSock 오류 |
| 06:10:39 / 07:41:26 / 09:04:19~56 | - | - | -4 | `Passport verifying has been failed` (산발) |

---

## 8. 조치 및 권고

### 8-1. 금일 장애 (보안설정 조회 실패)

- [ ] `PKGSECURITY.GetOrderSecurity` 에서 OrderKey `12790702` / `12790883` 대상 `NO_DATA_FOUND` 발생 조건 DB 확인 (해당 오더의 보안설정 레코드 존재 여부)
- [ ] 세션 유실 상황에서 `-605`를 "보안설정 DB 작업 실패"로 노출하지 말고 **재로그인 유도 메시지**로 분기 처리 검토 (사용자 혼선 방지)

### 8-2. 1호기 CISWatcher 크래시 (우선순위 높음)

- [ ] **1호기 `CISWatcherU.exe` 기동 여부 즉시 확인 및 재시작** — 8/1 19:08 이후 중단 정황
- [ ] `C:\INFINITT\CISWatcher\Log` 에 8/2 이후 로그 생성 여부 확인 (감시 공백 기간 확정)
- [ ] `memory.hdmp` 확보 후 WinDbg `!analyze -v` / `!heap -p` 분석
      (`C:\ProgramData\Microsoft\Windows\WER\ReportQueue\AppCrash_CISWatcherU.exe_6a6bfb58…`)
- [ ] CISWatcher를 **Windows 서비스 자동 복구(실패 시 재시작)** 로 등록해 크래시 시 자가 회복되도록 구성
- [ ] 2호기에는 동일 크래시 이력 없음 → **1호기 한정 문제**로 환경/모듈 버전 차이 확인

### 8-3. 서버 위생

- [ ] 1호기 WER `ReportQueue` 적체분 정리 — 이벤트로그 오염 및 향후 장애 조사 방해 요인 (덤프 확보 후 진행)
- [ ] `CISDBServerU.exe` × `oracore19.dll` `c0000005` 과거 크래시 이력 별도 트래킹 (1호기 10건 / 2호기 2건, 현재 재발 없음). Oracle Client 19c 버전·패치 확인 필요
- [ ] 1호기 이벤트로그가 07-26부터만 보존됨 (21MB full roll) → **Application 로그 최대 크기 상향** 권고

---

## 9. 링크

- [[260730-CISWatcher 분석\|260730-CISWatcher 분석]]
- [[이슈/260730-RADAR_PRE_LEAK_WOW64 이벤트 분석-CIS 서버 메모리 릭 진단\|260730-RADAR_PRE_LEAK_WOW64 이벤트 분석-CIS 서버 메모리 릭 진단]]
- [[HelpDesk - 서울성모 센트럴모니터링 오류 건\|HelpDesk - 서울성모 센트럴모니터링 오류 건]]
