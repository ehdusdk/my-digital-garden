---
{"dg-publish":true,"dg-permalink":"260730-ciswatcher-analysis","permalink":"/260730-ciswatcher-analysis/","dg-note-properties":{}}
---

# CISWatcher 프로젝트 코드 및 서비스 제어 동작 방식 분석 보고서

**작성일자:** 2026년 7월 30일  
**프로젝트 경로:** `D:\Proj\CIS_ETC\CISWatcher`  
**관련 문서:** `doc/CIS Watcher 설정 방법.pptx`

---
[[CIS 2.0/CIS 분석\|CIS 분석]]
## 1. 프로젝트 개요 및 폴더 구조 설명

`CISWatcher` 솔루션은 INFINITT CIS(Clinical Information System)의 주요 서버 프로그램 및 Windows Service들을 실시간으로 감시하고, 장애(Hang, Crash, 미응답) 발생 시 프로세스 강제 종료 및 Windows Service 재시작을 수행하여 시스템 연속성을 보장하는 **MFC 기반 감시(Monitoring Daemon) 프로그램**입니다.

### 프로젝트 폴더 구조
```
d:\Proj\CIS_ETC\CISWatcher
├── doc/
│   └── CIS Watcher 설정 방법.pptx       # 설정 가이드 문서 (주요 항목 및 파라미터 설명)
├── BIN/                                 # 빌드 결과물 (실행 파일 및 DLL 출력 디렉토리)
└── source/                              # C++ 소스 코드 솔루션 (Visual Studio 2008 기반)
    ├── CISWatcher/                      # 메인 감시 프로그램 (GUI, Worker Thread, 프로세스/서비스 제어)
    ├── CISManager/                      # 서버 설정, 이중화, 파일 관리, 업데이트/제품 관리 라이브러리
    ├── CommonDefine/                    # 프로젝트 공통 상수 및 매크로 정의 (ProductDefine.h 등)
    ├── CRUZ/                            # 데이터베이스 프로토콜 및 소켓 통신 모듈
    ├── SprintW/                         # Sprint 서버 연동 DB 모듈
    ├── CISKeyGenLib/                    # 라이선스 키 생성/검증 모듈
    └── CISWatcher.sln / *.vsprops       # Visual Studio 솔루션 파일 및 공통 속성 시트
```

### `doc/CIS Watcher 설정 방법.pptx` 문서 분석 내용 및 코드 매핑
프로젝트 내 문서 분석 결과, 설정 파라미터는 `ConfigManager`의 `CONFIG_COMMON` 및 `CONFIG_WATCHER` 구조체와 1:1로 매핑됩니다.

| 구 분 | pptx 문서 설명 내용 | 소스 코드 매핑 변수 |
| :--- | :--- | :--- |
| **Log Level** | 로그 상세 수준 설정 | `CONFIG_COMMON::m_LogLevel` |
| **Backup Archive** | 로그 및 백업 파일 보관 기간 (일 단위) | `CONFIG_COMMON::m_LogArchive` |
| **Auto Start** | 프로그램 시작 시 자동 감시 실행 여부 | `CONFIG_COMMON::m_AutoStart` |
| **Setting Title** | 감시 항목 식별 제목 (중복 불가) | `CONFIG_WATCHER::m_Title` |
| **Check Interval** | 감시 체크 주기 (초 단위) | `CONFIG_WATCHER::m_CheckInterval` |
| **Check Count** | 장애 감지 횟수 (해당 횟수 연속 실패 시 재시작) | `CONFIG_WATCHER::m_CheckCount` |
| **Product Type** | 감시 대상 제품 타입 (0: DB Server, 1+: 소켓 감시) | `CONFIG_WATCHER::m_ProductType` |
| **File Name** | 감시/종료 대상 프로세스 파일명 (예: `CISDBServerU.exe`) | `CONFIG_WATCHER::m_ProgramName` |
| **Service Name** | Windows Service 제어 명칭 (예: `CIS Database Server`) | `CONFIG_WATCHER::m_ServiceName` |
| **Server Setting** | 모니터링할 Server의 IP 및 Port 정보 | `CONFIG_WATCHER::m_ServerIP`, `m_ServerPort` |

---

## 2. [우선순위 1위] Windows Service 및 프로세스 제어 동작 방식

CISWatcher가 감시 대상을 제어하고 복구하는 핵심 로직은 `Worker` 스레드의 **유한 상태 머신(Finite State Machine)**으로 작동합니다.

### 1) 제어 상태 머신 (JobState 5단계)
`Worker::RunInstance()`는 5가지 상태를 순환하며 감시 및 복구를 수행합니다.

```
[eMonitoring] ---> (서버 이상 감지 >= CheckCount) ---> [eKillProcess]
      ^                                                      |
      |                                              (taskkill /F 성공)
      |                                                      v
[eCheckExcute] <--- (SCM Service Start 성공) <--- [eCheckKilledProcess]
      |                                                      |
 (프로세스 확인)                                     (OS 상 종료 확인)
      v                                                      v
      +----------------------------------------------> [eExcute]
```

#### 상태별 상세 제어 루틴
1. **`eMonitoring` (`MonitoringRoutine`)**: 
   * `ProcessUtil::IsExist`로 프로세스 존재를 확인하고 `IsServerAbnormal()`로 헬스체크를 수행합니다.
   * `CheckCount` 회 연속으로 이상 상태가 검출되면 `eKillProcess` 상태로 전환합니다.
2. **`eKillProcess` (`KillProcessRoutine`)**: 
   * `ProcessUtil::Kill()`을 호출하여 멈춰있는(Hang) 대상 프로세스를 OS 레벨에서 강제 종료합니다.
   * 종료 후 `eCheckKilledProcess` 상태로 전환합니다.
3. **`eCheckKilledProcess` (`CheckKilledProcess`)**: 
   * 프로세스가 완전히 종료되었는지 확인하고, 완전 종료가 확인되면 `eExcute` 상태로 전환합니다.
4. **`eExcute` (`ExcuteRoutine`)**: 
   * Windows Service Control Manager(SCM)를 호출하여 해당 Windows Service를 **Start** 시킵니다.
   * 성공 시 `eCheckExcute` 상태로 전환합니다.
5. **`eCheckExcute` (`CheckExcuteRoutine`)**: 
   * 서비스 실행 결과로 프로세스가 재구동되어 상주 중인지 최종 확인 후 정상 감시 상태(`eMonitoring`)로 복귀합니다.

---

### 2) Windows Service 상태 확인 및 구동 메커니즘 (`CISNTService`)

Windows Service 제어는 `CISLib` 라이브러리의 `CISNTService` 클래스를 활용하며, Win32 Native API를 통해 Service Control Manager(SCM)를 조작합니다.

```cpp
// Worker.cpp (L198)
void Worker::ExcuteRoutine(int nWaitTime)
{	
    DWORD dwErr    = 0;
    DWORD dwStatus = 0;

    // 1. Windows Service 상태 확인 및 서비스 구동(Start) 요청
    if(!CISNTService::GetServiceStatus(m_WatcherConfig.m_ServiceName, dwStatus, dwErr) || 
       !CISNTService::Start(m_WatcherConfig.m_ServiceName, dwErr))
    {	
        m_Retry++;
        m_ErrorLog.CISLog_Error(cis_log_category_APP, NULL, 
            CISGF::FormatString(_T("%s (Retry Count:%d)"), CISGF::FormatMsg(dwErr), m_Retry), _T(""));
                
        if(m_Retry >= 3)
            SetState(eMonitoring);		
        else
            EnterIdle(nWaitTime);

        return;
    }

    SetLog_MinorInfo(cis_log_category_APP, _T("The Program is excuted successfully"));
    SetState(eCheckExcute);		
}
```

* **`GetServiceStatus` 메커니즘**: `OpenSCManager` -> `OpenService` -> `QueryServiceStatus` API를 호출하여 해당 서비스의 상태(`SERVICE_RUNNING`, `SERVICE_STOPPED` 등)를 확인합니다.
* **`Start` 메커니즘**: `OpenSCManager(..., SC_MANAGER_ALL_ACCESS)` 및 `OpenService(..., SERVICE_ALL_ACCESS)`로 서비스를 연 후 `StartService()` API를 호출하여 Windows Service를 즉시 구동합니다.

---

### 3) 프로세스 강제 종료 및 생존 검증 메커니즘 (`ProcessUtil`)

서비스가 멈춰(Hang) 단순 서비스 정지 명령이 작동하지 않을 수 있으므로, OS 강제 종료 명령 및 프로세스 스냅샷 검증 방식을 결합하여 사용합니다.

#### 강제 프로세스 종료 (`ProcessUtil::Kill`)
```cpp
// ProcessUtil.cpp (L19)
BOOL ProcessUtil::Kill(CString strProgramName)
{
    // TerminateProcess 대신 system cmd 명령을 이용한 강제 종료
    CString strCmd;
    strCmd.Format(_T("taskkill /IM \"%s\" /F"), strProgramName);	
        
    if(system(CT2A(strCmd)) == 0)
        return TRUE;

    return FALSE;
}
```
* Windows 명령 프롬프트의 `taskkill /IM "<ProgramName>" /F` 명령을 실행하여 관련 프로세스 트리를 즉시 강제 종료합니다.

#### 프로세스 생존 검증 (`ProcessUtil::IsExist`)
```cpp
// ProcessUtil.cpp (L31)
BOOL ProcessUtil::IsExist(CString strProgramName)
{
    HANDLE hProcessSnap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
    PROCESSENTRY32 pe32;

    if(hProcessSnap == INVALID_HANDLE_VALUE)
        return FALSE;

    pe32.dwSize = sizeof(PROCESSENTRY32);

    if(!Process32First(hProcessSnap, &pe32))
    {
        CloseHandle(hProcessSnap);
        return FALSE;
    }

    do
    {
        if(strProgramName.Compare(pe32.szExeFile) == 0)
        {
            CloseHandle(hProcessSnap);
            return TRUE;
        }
    }
    while(Process32Next(hProcessSnap, &pe32));

    CloseHandle(hProcessSnap);
    return FALSE;
}
```
* Windows Native API인 **Toolhelp32 Snapshot** (`CreateToolhelp32Snapshot`, `Process32First`, `Process32Next`)을 사용하여 현재 실행 중인 프로세스 목록 전체를 순회하고 `m_ProgramName`과 비교합니다.

---

## 3. 서버 헬스체크 및 내부 구조 분석

### 1) 서버 이상 상태 감지 (`Worker::IsServerAbnormal`)
감시 대상의 `ProductType`에 따라 헬스체크 방식을 다르게 가져갑니다.

* **`ProductType == 0` (DB 서버/NEIS 패킷 헬스체크)**:
  * `DatabaseClient` (`CRUZClient` 비동기 IOCP 소켓 통신)를 이용합니다.
  * `administrator` 계정으로 `CRUZQuery_ExLogin4` 패킷을 전송하여 실제 DB 응답 및 로그인 패킷이 정상이면 `CIS_SUCCESS`로 판별합니다.
* **`ProductType != 0` (소켓 커넥션 감시)**:
  * `CISIOCP2_Checker::CheckServer()`를 호출하여 서버의 IP와 Port로 TCP 소켓 연결을 시도하고 응답 여부를 체크합니다.

### 2) 멀티 스레드 감시 체계 (`WorkerManager` & `Worker`)
* `WorkerManager`는 `ConfigManager::Watcher()`에 정의된 감시 대상 개수만큼 독립된 `Worker` 스레드(`CISThread2` 상속)를 생성 및 가동합니다.
* 각 `Worker` 스레드는 독립적인 상태 머신, 소켓 클라이언트, 로거(`m_ErrorLog`), Retry 카운터를 유지하므로 개별 서비스의 장애 복구가 다른 서비스 감시에 영향을 주지 않습니다.

### 3) 로그 관리 및 자동 파일 정리
* **`WRLogger` 시스템**: 일반 로그와 `ERROR` 전용 로그를 분리 기록하며, `m_LogLevel`에 따라 로그 출력 수준을 제어합니다.
* **자동 정리 (`CleanFile`)**: `TIMER_CLEANER` 타이머가 주기적으로 발동하여 `m_LogArchive` 보관 기간을 초과한 오래된 로그 및 백업 파일들을 자동 삭제합니다.

### 4) UI 및 시스템 상주 (System Tray)
* MFC Dialog 기반 메인 윈도우(`CISWatcherDlg`)는 `CISTray` 모듈을 결합하여 창 최소화 시 시스템 트레이 영역으로 숨겨집니다.
* `CISInstance::IsInstanceExist`를 통해 중복 실행을 차단하고 기존 윈도우를 최상단으로 끌어올립니다.

---

## 4. 종합 요약

1. **서비스 제어 방식**: `taskkill /F` 명령을 사용한 프로세스 강제 종료와 `CISNTService` (Win32 SCM API: `OpenSCManager`, `OpenService`, `StartService`)를 이용한 서비스 구동 방식을 조화롭게 사용합니다.
2. **복구 시퀀스**: `eMonitoring` -> `eKillProcess` -> `eCheckKilledProcess` -> `eExcute` -> `eCheckExcute` 5단계 유한 상태 머신 기반으로 동작하여 복구 실패 시 안전하게 재시도합니다.
3. **헬스체크 정밀도**: 단순 프로세스 생존 검사뿐만 아니라 실제 DB 로그인 패킷(`CRUZQuery_ExLogin4`) 처리 검사까지 병행하여 먹통(Hang) 상태를 정확히 판별합니다.
