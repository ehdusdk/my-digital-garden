---
{"dg-publish":true,"permalink":"//260730-radar-pre-leak-wow-64-cis/","title":"RADAR_PRE_LEAK_WOW64 이벤트 분석 — CIS 서버 메모리 릭 진단","tags":["이슈","CIS2.0","CISDBServer","CISStorageServer","RADAR","메모리릭","WOW64","WindowsService","이벤트뷰어","트러블슈팅"],"dg-note-properties":{"title":"RADAR_PRE_LEAK_WOW64 이벤트 분석 — CIS 서버 메모리 릭 진단","date":"2026-07-30","status":"분석중","tags":["이슈","CIS2.0","CISDBServer","CISStorageServer","RADAR","메모리릭","WOW64","WindowsService","이벤트뷰어","트러블슈팅"]}}
---

# RADAR_PRE_LEAK_WOW64 이벤트 분석 — CIS 서버 메모리 릭 진단

> **한 줄 요약**
> `RADAR_PRE_LEAK_WOW64`는 메모리 릭 확정 통보가 **아니라** "이 프로세스가 커밋 메모리 최상위였고 물리 RAM의 5%를 넘었다"는 **임계 초과 알림**이다. 다만 `WOW64` 접미사로 **대상이 32비트 프로세스**임이 확정되므로, 2GB 주소공간 한계가 실질 리스크다.

## 1. 현상

- 이벤트뷰어에 `RADAR_PRE_LEAK_WOW64` 이벤트 발생 (엔지니어 전달)
- 대상 추정: `CISDBServer`, `CISStorageServer` (윈도우 서비스로 운영되는 서버 애플리케이션)
- 엔지니어 의견: 메모리 릭 관련 메시지로 추정

## 2. 이벤트 정체

| 항목 | 내용 |
|---|---|
| 로그 | Application |
| 소스 | Windows Error Reporting |
| 이벤트 ID | **1001** |
| Event Name | `RADAR_PRE_LEAK_WOW64` |
| 생성 주체 | **RADAR**(Resource Exhaustion Detection and Resolution) 의 **Memory Leak Diagnoser** |
| 구현 | `radardt.dll` / Diagnostic Policy Service (DPS) |
| 도입 | Windows Vista |

### RADAR 3개 구성요소

1. **Resource Exhaustion Detector** — 메모리 자원이 임계 수준에 근접하는지 감지
2. **Resource Exhaustion Resolver** — 상위 소비 프로세스 3개를 통지
3. **Memory Leak Diagnoser** — 누수 의심 애플리케이션 정보 제공 ← **본 이벤트의 주체**

### 접미사 의미

| 접미사 | 의미 |
|---|---|
| `_64` | 네이티브 64비트 프로세스 |
| `_WOW64` | **64비트 Windows 위에서 동작하는 32비트 프로세스** |

## 3. 트리거 조건 (리버스 엔지니어링 확인 내용)

`RdrpReadHeapLeakSettings` / `RdrpIdentifyTargetProcess` 분석 결과, 동작은 다음과 같다.

1. `TimerInterval`(분)마다 타이머 발동
2. 전체 프로세스를 **커밋 메모리 내림차순** 정렬
3. 아래 두 조건을 만족하는 **최상위 1개** 프로세스만 선정
   - 커밋량 ≥ **물리 RAM 총량 × `CommitThreshold`%** (기본 **5%**)
   - 최근 `DetectionInterval`(기본 **30일**) 내 선정 이력 없음
4. 레지스트리 등록 + `LastDetectionTime` 갱신 + WER 리포트 생성

> `CommitFloor` / `CommitCeiling` 값은 읽기만 하고 실제 사용되지 않는 것으로 확인됨.

### ⚠️ 여기서 오는 판독 주의사항

- **이벤트 발생 ≠ 메모리 릭.** 정상적으로 대용량 캐시를 쓰는 프로세스도 최상위면 잡힌다.
- **이벤트 미발생 ≠ 정상.** 주기당 1개, 30일에 1회만 기록되므로 CISDBServer와 CISStorageServer가 동시에 증가해도 **더 큰 쪽 하나만** 남는다.
- **기본적으로 덤프가 생성되지 않는다.** 이 이벤트만으로는 분석할 덤프가 없다.
- 이벤트 XML의 **P1(exe명), P2(버전)** 을 반드시 확인 — 실제 대상이 CIS가 아닐 수도 있다.

## 4. 핵심 리스크 — 32비트 주소공간

`WOW64` = 32비트 프로세스 → 사용자 모드 주소공간 상한 **2GB** (`/LARGEADDRESSAWARE` 적용 시 WOW64에서 최대 4GB).

트리거 조건(RAM의 5%)을 대입하면:

| 서버 물리 RAM | 트리거된 커밋량(5%) | 32비트 2GB 한계 대비 |
|---|---|---|
| 16 GB | ≈ 819 MB | 40% |
| 32 GB | ≈ 1.6 GB | **80% — OOM 임박** |
| 64 GB | ≈ 3.2 GB | LAA 미적용 시 도달 불가 |

즉 **이벤트가 떴다는 사실 자체로 주소공간 잔여량을 역산할 수 있다.** 그리고 주소공간 단편화 때문에 실제로는 한계치보다 훨씬 이전(**1.2 ~ 1.5GB**)에 `E_OUTOFMEMORY` / `STATUS_NO_MEMORY`가 발생한다.

### 선행 확인 2건

- [ ] 해당 서버 **물리 RAM 용량** → 실제 트리거 임계 MB 역산
- [ ] `dumpbin /headers CISDBServer.exe | findstr /i "large"` → **LARGE_ADDRESS_AWARE** 여부
- [ ] CISStorageServer.exe 도 동일 확인

## 5. 지금 바로 수집 가능한 정보

### 이벤트 XML

- P1 = 실행 파일명, P2 = 버전 → 대상 프로세스 확정

### 레지스트리 (탐지 이력 추적)

```
HKLM\SOFTWARE\Microsoft\RADAR\HeapLeakDetection\DiagnosedApplications\<exe명>
  └ LastDetectionTime  (QWORD, Windows FILETIME)

HKLM\SOFTWARE\Microsoft\RADAR\HeapLeakDetection\Settings
  ├ CommitThreshold    (물리 RAM 대비 %, 기본 5)
  ├ TimerInterval      (분)
  ├ DetectionInterval  (일, 기본 30)
  └ MaxReports
```

→ `DiagnosedApplications` 하위에 CISDBServer / CISStorageServer 항목이 있는지, 마지막 탐지 시각이 언제인지 확인.

### WER 리포트 원본

```
C:\ProgramData\Microsoft\Windows\WER\ReportArchive\...\Report.wer
C:\ProgramData\Microsoft\Windows\WER\ReportQueue\
```

## 6. Windows 기본 제공 — 누수 / 리소스 미해제 진단 정보

### 6-1. 상관관계 확인용 이벤트 로그

| 소스 / ID | 내용 |
|---|---|
| `Microsoft-Windows-Resource-Exhaustion-Detector` **2004** | 가상 메모리 부족 진단. **상위 소비 프로세스 3개를 이름과 함께 기록** (**2005** = 해소) |
| `Application Error` **1000** | 예외코드 `0xC0000017`(STATUS_NO_MEMORY), `0xE0434352`(.NET 미처리 예외 / OOM) |
| `Service Control Manager` **7031 / 7034** | 서비스 비정상 종료 · 자동 재시작 → **누수 → 크래시 사이클의 직접 증거** |

`RADAR_PRE_LEAK_WOW64` 발생 시각과 7031/7034 재시작 시각이 겹치면 누수 가능성이 크게 올라간다.

### 6-2. 성능 카운터 (PerfMon) — 실질 판단 근거

**데이터 수집기 집합(Data Collector Set)** 으로 30~60초 간격, 수일간 순환 기록 권장. 별도 설치 불필요.

| 카운터 | 판독 |
|---|---|
| `Process\Private Bytes` | **1차 지표.** 계단식 상승 후 유휴 시에도 내려오지 않으면 누수 |
| `Process\Virtual Bytes` | Private Bytes와의 격차 확대 = **주소공간 단편화 / 예약 누수** (32비트에 치명적) |
| `Process\Working Set` | 트리밍되므로 단독 판단 금지 |
| `Process\Handle Count` | 파일 · 소켓 · 이벤트 · 레지스트리 키 **핸들 미해제** |
| `Process\Thread Count` | 스레드 누수 |
| `Process\Pool Nonpaged Bytes` / `Pool Paged Bytes` | 커널 리소스 미반환 |
| `GDI Objects` / `USER Objects` | 프로세스당 기본 상한 10,000. 리포트 · 이미징 모듈 사용 시 확인 |
| `.NET CLR Memory\# Bytes in all Heaps`, `Gen 2 heap size`, `Large Object Heap size`, `% Time in GC` | 관리 힙 누수 판단 |
| `.NET CLR Loading\Current Assemblies` | 동적 어셈블리 누수 |
| `.NET Data Provider for SqlServer\NumberOfPooledConnections`, `NumberOfActiveConnections` | **CISDBServer의 DB 커넥션 · 커맨드 미해제 여부** |
| `Memory\Committed Bytes`, `Commit Limit` | 시스템 전체 커밋 압박 |

#### 판별 요령

- `Private Bytes` ↑ + CLR 힙 평평 → **네이티브 / COM / interop 또는 핸들 누수**
- `Private Bytes` ↑ + `Gen 2` · `LOH` ↑ → **관리 힙 누수** (이벤트 핸들러 미해제, static 컬렉션 누적 등)
- `Handle Count` 단독 ↑ → **리소스 미해제** (`using` / `Dispose` / `CloseHandle` 누락)
- `Virtual Bytes` ↑ 인데 `Private Bytes` 완만 → **단편화**. 32비트에서 OOM 조기 유발

### 6-3. 원인 지목용 도구 (전부 Microsoft 무료)

| 도구 | 용도 | 비고 |
|---|---|---|
| **DebugDiag 2.x** | "Memory and Handle Leak" 룰. leaktrack 주입 후 **누수 호출 스택 포함 분석 리포트** 자동 생성 | MS 공식. **윈도우 서비스에 가장 현실적인 1순위** |
| **procdump** | `procdump -ma -m 1500 CISDBServer.exe` → Private Bytes 1500MB 도달 시 풀 덤프 자동 캡처 | Sysinternals |
| **VMMap** | 32비트 주소공간을 Heap / Image / Private / Free 로 분해 → **단편화 확인 필수** | Sysinternals |
| **UMDH + gflags** | `gflags -i CISDBServer.exe +ust` 후 스냅샷 2개 diff → **할당 호출 스택 특정** | 네이티브 누수의 결정적 증거. **오버헤드 크므로 운영 반영 전 검증 필요** |
| **handle.exe** | `handle -p CISDBServer.exe` → 어떤 *종류*의 핸들이 증가하는지 | Sysinternals |
| **Application Verifier** | Basics → Handles 체크로 핸들 오용 탐지 | 개발/검증 환경 전용 |
| **poolmon** | 비페이지 풀 증가 시 커널 태그 추적 | WDK |
| **WER LocalDumps** | 크래시 시 풀 덤프 자동 확보 | 아래 참조 |

#### WER LocalDumps 설정

```
HKLM\SOFTWARE\Microsoft\Windows\Windows Error Reporting\LocalDumps\CISDBServer.exe
  DumpFolder   (REG_EXPAND_SZ)  = D:\Dumps
  DumpCount    (REG_DWORD)      = 5
  DumpType     (REG_DWORD)      = 2      ; 2 = Full Dump
```

### 6-4. 임시 완화 (근본 해결 아님)

```cmd
sc failure CISDBServer reset= 86400 actions= restart/60000/restart/60000/restart/60000
sc failure CISStorageServer reset= 86400 actions= restart/60000/restart/60000/restart/60000
```

+ 야간 계획 재시작(작업 스케줄러). 원인 분석 기간 동안 가용성 확보 목적.

## 7. 조치 순서 (제안)

1. **이벤트 XML의 P1 확인** — 대상 프로세스 확정 (CIS인지 타 프로세스인지)
2. **서버 물리 RAM + LARGE_ADDRESS_AWARE 확인** — 주소공간 잔여량 역산
3. **레지스트리 `DiagnosedApplications` 확인** — 탐지 이력 및 재발 주기
4. **이벤트 로그 상관 분석** — 2004 / 1000 / 7031·7034 와 시각 대조
5. **PerfMon 데이터 수집기 집합 구성** — Private Bytes · Virtual Bytes · Handle Count · Thread Count, 최소 3~7일
6. **추세 확인 후 분기**
   - 우상향 확정 → **DebugDiag** 로 스택 확보
   - 단편화 의심 → **VMMap**
   - 핸들만 증가 → **handle.exe** 로 종류 특정
7. **소스 레벨 검토** — DB 커넥션 / 파일 핸들 / 소켓 / COM 객체 해제 경로

## 8. 미확인 / 확인 필요

- [ ] 이벤트 P1이 실제로 CISDBServer.exe / CISStorageServer.exe 인지
- [ ] 대상 병원 · 서버 사이트 정보
- [ ] 발생 빈도 (1회성인지 반복인지)
- [ ] 서비스 비정상 종료 · 재시작 동반 여부
- [ ] CISDBServer / CISStorageServer 빌드 타깃 (x86 확정인지, x64 전환 계획 유무)
- [ ] 네이티브(MFC/ATL) 인지 .NET 인지 → 진단 도구 선택이 달라짐

## 관련 노트

- [[CIS 2.0/CIS 분석\|CIS 2.0/CIS 분석]]
- [[이슈/260728-강북삼성-CISStorageServerSDS 사본출력 다운로드 장애 분석\|이슈/260728-강북삼성-CISStorageServerSDS 사본출력 다운로드 장애 분석]]
- [[이슈/ISAPI 확장모듈 dll 관련 AppPool 따로 해야하는 이유\|이슈/ISAPI 확장모듈 dll 관련 AppPool 따로 해야하는 이유]]
- [[260728-강동성심CISViewer3.0 비정상종료 이슈 확인\|260728-강동성심CISViewer3.0 비정상종료 이슈 확인]]

## 참고 자료

- [Memory Leak Diagnoser — Microsoft Learn](https://learn.microsoft.com/en-us/previous-versions/windows/it-pro/windows-server-2008-R2-and-2008/cc774661(v=ws.10))
- [Event ID 1005 — Memory Leak Diagnoser](https://learn.microsoft.com/en-us/previous-versions/windows/it-pro/windows-server-2008-R2-and-2008/cc774656(v=ws.10))
- [The Mystery of the HeapLeakDetection Registry Key — Harel Segev](https://harelsegev.github.io/posts/the-mystery-of-the-heapleakdetection-registry-key/) (RADAR 트리거 조건 리버싱)
- [RADAR_PRE_LEAK — Microsoft Q&A](https://learn.microsoft.com/en-us/answers/questions/3728275/radar-pre-leak)
