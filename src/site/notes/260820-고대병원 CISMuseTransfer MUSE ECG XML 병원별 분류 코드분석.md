---
{"dg-publish":true,"permalink":"/260820-cis-muse-transfer-muse-ecg-xml/","tags":["코드분석","고려대","KUMC","CISMuseTransfer","MUSE","ECG","XML","안암","구로","안산","CIS_SI"],"dg-note-properties":{"tags":["코드분석","고려대","KUMC","CISMuseTransfer","MUSE","ECG","XML","안암","구로","안산","CIS_SI"],"작성일":"2026-08-20"}}
---

> [[CIS 2.0/CIS 분석\|← CIS 분석 인덱스로]]
> [[HIE팀 이슈\|← HIE팀 이슈로]]
> 관련: [[HIE-dykim/KUMC 고대병원 CISInBroker 처방정보 Workflow 분석\|고대병원 CISInBroker 처방정보 Workflow 분석]] · [[CISReceiver-12lead-ECG-Waveform-IOD-기능확인\|CISReceiver 12-lead ECG Waveform IOD 기능 확인]]

# 260820-고대병원 CISMuseTransfer MUSE ECG XML 병원별 분류 코드분석

> 작성일: 2026-08-20
> 대상: `D:\Proj\CIS_SI\고대병원\CISMuseTransfer` (고대 서버 상주 CIS Application)
> 근거: 소스 코드 전수 + 운영 서버(10.1.2.242) 원격 UI/설정 캡처
> 배경: 엔지니어 부장님 전달 건 — "고대 안암/구로/안산 관련 처리" 애플리케이션의 실제 동작 확인 요청

---

## 1. 한 줄 결론

**GE MUSE(Resting ECG, 심전도) 장비가 네트워크 공유 폴더로 내보낸 XML을 주기적으로 감시하다가, XML 안의 `Site` 노드 값을 읽어 안암/구로/안산 병원별 폴더로 파일을 이동시키는 상주형 파일 라우터(디스패처)** 입니다.

- 데이터 변환·DB 적재·DICOM 변환은 **하지 않습니다.**
- XML에서 **단 1개 노드만** 읽고 "어느 폴더로 보낼지"만 결정합니다.
- MUSE가 3개 병원 검사를 **한 폴더에 섞어서** 떨구기 때문에, 이를 병원별로 갈라 주는 것이 존재 이유입니다. 이후 각 병원 EMR/CIS 연계는 자기 폴더만 바라보면 됩니다.

---

## 2. 기본 정보

| 항목 | 내용 |
|---|---|
| 형태 | MFC 대화상자 기반 Win32 EXE (VC++ 2008, `.vcproj`, Win32) |
| 버전 리소스 | `FILEVERSION 2.0.1.0` |
| 의존 라이브러리 | `CISCommonLib`, `CISControlLib`, `CISECGLib` (사내 `CIS_LIB_2008`) |
| 설정 파일 | `<EXE경로>\Config\CISMuseTransfer.ini` |
| 로그 | `<EXE경로>\Log\LogFile_%Y-%m-%d.log` |
| 오류 파일 격리 | `<EXE경로>\ErrorBackup\` |
| 운영 서버 | 10.1.2.242 (원격 캡처 기준) |

### 주요 소스 파일

| 파일 | 역할 |
|---|---|
| `CISMuseTransfer.cpp/.h` | `CWinApp` 진입점 |
| `CISMuseTransferDlg.cpp/.h` | 메인 다이얼로그 (시작/정지/설정/디버그, 로거) |
| `WorkerThread.cpp/.h` | **핵심 로직** — 폴링·XML 파싱·파일 이동 |
| `ConfigManager.cpp/.h` | INI 로드/저장, 분류 규칙 맵 관리 |
| `DlgConfig.cpp/.h` | 설정 다이얼로그 |
| `DlgConfigRule.cpp/.h` | 개별 분류 규칙 편집 다이얼로그 |
| `DlgProcessMsg.cpp/.h` | "쓰레드 종료 중..." 진행 표시 |
| `test.cpp/.h` | 빈 껍데기, **미사용** |

---

## 3. 운영 설정 (캡처 화면 기준)

| 항목 | 값 | 의미 |
|---|---|---|
| 모니터링 경로 | `\\10.1.23.85\ekg_xml` | MUSE가 XML을 떨구는 원본 공유 폴더 |
| 네트워크 ID / PW | `emr` / (마스킹, 3자) | 위 공유 폴더 접속 계정 |
| 파싱노드 경로 | `RestingECG/TestDemographics/Site` | 판단 기준 XML 노드 (MUSE 표준 스키마) |
| 분류 간격 | `3` sec | 폴링 주기 |

### 분류 규칙 (노드 값 → 저장 위치)

| Site 노드 값 | 저장 위치 | 병원 |
|---|---|---|
| `1` | `\\10.1.23.85\ekg_xml\ANAM` | 고대 **안암** |
| `2` | `\\10.1.23.85\ekg_xml\GURO` | 고대 **구로** |
| `3` | `\\10.1.23.85\ekg_xml\ANSAN` | 고대 **안산** |

운영 로그도 이 동작과 일치합니다.

```
[2026-08-20 14:56:26] (MINOR) [CISMuseTransfer] MUSE_20260820_145601_52000.xml -> \\10.1.23.85\ekg_xml\...
[2026-08-20 14:55:56] (MINOR) [CISMuseTransfer] MUSE_20260820_145530_40000.xml -> \\10.1.23.85\ekg_xml\...
```
(형식: `원본 파일명 -> 이동 대상 폴더`)

---

## 4. 동작 흐름

### 4-1. 기동 — `CISMuseTransferDlg::OnInitDialog()`

1. 로거 시작 (`Log\LogFile_%Y-%m-%d.log`, 기본 레벨 `cis_logger_level_Full`)
2. `ConfigManager::LoadConfig()` 로 INI 로드
3. 모니터링 경로가 비어 있으면 경고 후 대기, 아니면 **`OnBnClickedStart()` 자동 호출** → 무인 상주 운용 전제
4. 로드 실패 시 `"설정파일 로드에 실패하였습니다."` 메시지 박스

### 4-2. 워커 스레드 — `WorkerThread::RunInstance()`

```cpp
while (!IsTerminate())
{
    if (ConnetNetDrive())    // 감시경로 + 모든 규칙 저장경로 네트워크 드라이브 연결
        OnRunning();         // 실제 분류 1회 수행
    EnterIdle(1000 * m_pConfig->m_nInterval);   // 캡처 기준 3초
}
```

> `DisconnetNetDrive()` 호출부는 주석 처리되어 있어 **연결을 유지**하고 매 루프마다 재연결을 시도합니다.

### 4-3. 1회 처리 — `WorkerThread::OnRunning()`

1. `GetDirFiles(감시경로, "*.xml", &arPath)` — **한 주기당 최대 10개만** 수집 (`if(nCount == 10) break;`)
2. 각 파일에 대해:

| 단계 | 실패 시 처리 |
|---|---|
| `CISXml::Open(원본)` | `"xml 파일 읽기 실패"` 로그 + `ErrorBackup\` 이동 |
| `GetNodeText2("RestingECG/TestDemographics/Site")` | 값이 비면 `"xml 노드값이 없음"` 로그 + `ErrorBackup\` 이동 |
| `m_mapSavePath.Lookup(노드값)` | `"xml 노드값(%s)과 일치하는 저장 경로가 없음"` 로그 + `ErrorBackup\` 이동 |
| `CISGF::MoveFile(원본, 저장위치\원본파일명)` | `"파일이동실패"` + 원본/이동 경로 로그 |

3. 성공 시 MINOR 레벨 로그: `원본파일명 -> 저장경로`

> 파일은 **이동(Move)** 입니다. 복사가 아니므로 원본 폴더에는 남지 않습니다.

### 4-4. UI 동작

| 버튼 | 동작 |
|---|---|
| 시작 | `WorkerThread` 생성 + `ResumeThread(TRUE)` |
| 정지 | `DlgProcessMsg`("쓰레드 종료 중...") 표시 후 `TerminateThread()` |
| 설정 | INI 재로드 후 `DlgConfig` 모달 표시 |
| 디버그(체크박스) | 로그 레벨 `Full` ↔ `Debug` 전환 |

설정 다이얼로그에서 `+` / `-` 로 규칙 추가·삭제, 목록 더블클릭으로 수정(이때 노드 값은 `EnableWindow(FALSE)`로 편집 불가). `저장` 시 INI에 기록.

---

## 5. 설정 파일 포맷

`Config\CISMuseTransfer.ini`

```ini
[MonitoringInfo]
PATH = \\10.1.23.85\ekg_xml
ID   = emr
PW   = ***

[Common]
Interval    = 3
ParsingNode = RestingECG/TestDemographics/Site

[ParsingRule]
Count = 3
RULE0 = 1^\\10.1.23.85\ekg_xml\ANAM^<ID>^<PW>
RULE1 = 2^\\10.1.23.85\ekg_xml\GURO^^
RULE2 = 3^\\10.1.23.85\ekg_xml\ANSAN^^
```

- RULE 형식: `노드값 ^ 저장경로 ^ 저장경로ID ^ 저장경로PW` (구분자 `^`, `AfxExtractSubString`)
- 저장 경로별로 **별도 네트워크 계정**을 부여할 수 있게 설계됨
- 비밀번호는 **평문** 저장

---

## 6. 유지보수 시 알아둘 점 / 잠재 이슈

1. **처리량 상한 10개/주기** — `GetDirFiles()` 가 10개에서 `break`. 3초 주기 기준 이론상 약 200건/분. MUSE 백로그가 쌓이면 소진에 시간이 걸립니다. 의도적 부하 제한으로 보이나 문서화 필요.
2. **감시 경로와 저장 경로가 같은 루트** — `\\...\ekg_xml` 아래에 `ANAM/GURO/ANSAN`. `GetDirFiles()`가 재귀하지 않고 `IsDirectory()`를 건너뛰므로 무한 재처리는 없지만 구조상 위험한 배치.
3. **네트워크 연결 실패 시 전체 스킵** — `ConnetNetDrive()`는 규칙 중 하나라도 연결 실패하면 `FALSE` 반환 → 그 주기 **전체**가 처리되지 않아 정상 병원 건도 함께 지연됩니다.
4. **`DlgConfig::OnBnClickedAdd()` 중복 검사 버그** — 빈 `CString strKey`로 `Lookup(strKey, pRule)`을 호출해 중복 노드값 검사가 실질적으로 무효. 같은 노드값 추가 시 `SetAt`이 덮어써 **기존 `Rule*` 메모리 릭 + 리스트 항목 dangling 포인터**. (참고: `LoadConfig()` 쪽 중복 검사는 정상 동작 → INI에 중복이 있으면 로드 실패)
5. **`OnInitDialog()`에 디버그용 `AfxMessageBox` 잔존** — `AfxMessageBox(CISGF::FormatString(_T("0x%02X"),'\n'));`. 이 소스 그대로 빌드·배포하면 **기동 시 메시지 박스가 떠 무인 자동 시작이 막힙니다.** 운영 EXE는 이 코드 없는 이전 빌드로 추정되므로 **재빌드 전 반드시 제거**.
6. **`TerminateThread()` 기반 정지** — 파일 이동 도중 강제 종료 시 파일 상태가 애매해질 수 있음.
7. **자격증명 평문 저장** — 병원 보안 점검 시 지적 가능 항목.
8. **`ErrorBackup\` 무한 적재** — 정리 정책·알림 없음. 규칙에 없는 신규 Site 코드가 생기면 **조용히** 여기에 쌓입니다.
9. **`test.cpp` / `test.h`** — 빈 껍데기 다이얼로그, 실제 미사용.

---

## 7. 후속 확인 필요 항목

- [ ] 운영 서버(10.1.2.242) 실제 `Config\CISMuseTransfer.ini` 원본 확보 (규칙별 ID/PW 설정 여부)
- [ ] 배포 EXE의 파일 버전이 소스의 `2.0.1.0`과 일치하는지 확인
- [ ] `ANAM/GURO/ANSAN` 폴더를 이후에 소비하는 주체 확인 (병원별 EMR 연계 모듈 / CISNEIS 등)
- [ ] MUSE XML `Site` 값 부여 규칙(장비 설정) 확인 — 신규 병원/장비 추가 시 규칙 추가만으로 되는지
- [ ] `ErrorBackup\` 현황 점검 (규칙 미매칭 건 누적 여부)
- [ ] 5번 디버그 `AfxMessageBox` 제거 후 재빌드 여부 결정 (형상 정리)

---

## 8. 관련 노트

- [[CIS 2.0/CIS 분석\|CIS 분석 인덱스]]
- [[HIE팀 이슈\|HIE팀 이슈]]
- [[HIE-dykim/KUMC 고대병원 CISInBroker 처방정보 Workflow 분석\|고대병원 CISInBroker 처방정보 Workflow 분석]]
- [[CIS 2.0/고대병원 CISIn-OutBroker 이중화 적용 변경 가이드\|고대병원 CISInBroker·CISOutBroker 이중화 적용 변경 가이드]]
- [[CISReceiver-12lead-ECG-Waveform-IOD-기능확인\|CISReceiver 12-lead ECG Waveform IOD 기능 확인]]
- [[이슈/260729-InfUpDown-CISEMRClient 기능 비교 분석\|InfUpDown vs CISEMRClient 기능 비교 분석]]
- [[김도연\|김도연]]
