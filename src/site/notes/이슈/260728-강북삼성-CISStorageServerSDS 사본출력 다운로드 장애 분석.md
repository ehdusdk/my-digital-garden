---
{"dg-publish":true,"permalink":"//260728-cis-storage-server-sds/","tags":["이슈","강북삼성","CISStorageServerSDS","InfUpDown","사본출력","SMB","NAS","코드분석","트러블슈팅"],"dg-note-properties":{"tags":["이슈","강북삼성","CISStorageServerSDS","InfUpDown","사본출력","SMB","NAS","코드분석","트러블슈팅"],"defect":"156735","date":"2026-07-28"}}
---

# 260728-강북삼성-CISStorageServerSDS 사본출력 다운로드 장애 분석

> **Defect #156735** — 강북삼성본원 `InfUpDown.dll` 연계 `CISStorageServerSDS` 서비스 장애.
> EMR 사본출력 프로그램이 요청한 이미지를 다운로드하지 못하는 현상.
> 로그: `Sending "..." has been rejected / File does not exist` + `Error(64, 지정된 네트워크 이름을 더 이상 사용할 수 없습니다.)`

관련: [[HIE팀 이슈\|HIE팀 이슈]] · [[회의록/260727-강북삼성 중요이슈논의\|260727 강북삼성 중요이슈논의]]

---

## 1. 결론 (요약)

- **`File does not exist`는 실제 파일 부재가 아니라, SDS 서버 호스트 → NAS(`\\116.2.153.56\cis_nas`) 간 SMB 세션 단절로 인한 오탐(false negative)이다.**
- 근본 원인은 `CISGF::IsFile()`이 **"파일 진짜 없음"과 "경로 접근 불가(네트워크 오류)"를 구분하지 않고** 둘 다 `FALSE`로 처리하는 데 있다.
- 여기에 **`CISStorageServerSDS.exe`(v2.0.1.4) 서비스 자체 크래시**(`MSVCR90.dll` / `uiautomationcore.dll`)가 겹쳐 "서비스 장애"로 확대되었다.
- **`InfUpDown.dll`은 원인이 아니라 서버 결과를 EMR로 전달하는 "전달자"** 이다. DLL 코드 수정으로 해결되는 이슈가 아니다.

---

## 2. 전체 구조 (호출 흐름)

```
EMR 사본출력 프로그램
   └─ InfUpDown.dll  (클라이언트, 삼성서울병원 커스텀 모듈 — 강북삼성도 사용)
        └─ TCP 접속 → CISStorageServerSDS.exe (스토리지 서버, 장애 대상)
                          └─ 실제 파일 I/O → NAS  \\116.2.153.56\cis_nas\CIS_STORAGE\...
```

- 클라이언트: `InfUpDown.dll` → `DownloadMemory()` / `DownloadFile()`로 이미지 요청.
- 서버: `CISStorage2ServerClient::UploadFile()`에서 NAS 파일을 읽어 클라이언트로 전송("Sending").
- 서비스 실행 경로: `D:\InfUpDown_CIS\CISStorageServerSDS.exe` (서비스 `CISStorageServerSDS-CIS` / `-EMR` 2종 확인).
- 볼륨 설정: **Volume ID 1 = `\\116.2.153.56\cis_nas\CIS_STORAGE` (Nick `CIS_NAS`, Local 모드, Status Active), Port 4005, Max User 4096, Backup None.**

---

## 3. 로그 해독

```
Client has been connected [116.2.51.74(1), 1/4096(1)]      ← 클라이언트 접속 성공
Protocol has been verified                                  ← 핸드셰이크 정상
WARNG: Sending "$1$MIX\2023\1127\H0033\03029779\22690791\
       20231127171505_..._001.jpg" has been rejected
       <CM>File does not exist</CM>                         ← ★ 서버가 "파일 없음"으로 거부
Sending "1 items" has been completed [0.000 sec]            ← 작업 종료(결과=실패)
WARNG: [DEBUG] IO_ERROR_REPORT ... IOSize(0),
       Error(64, 지정된 네트워크 이름을 더 이상 사용할 수 없습니다.)
       <CM>116.2.51.74</CM>                                 ← 클라이언트 TCP 소켓 끊김(결과)
Client has been removed [116.2.51.74(0), 0/4096(0)]
```

- `$1$MIX\...` = **Volume ID 1(`\\116.2.153.56\cis_nas\CIS_STORAGE`) + `MIX\2023\1127\...\파일.jpg`** → 탐색기에서 확인된 실제 경로와 정확히 일치. **즉 파일은 물리적으로 존재한다.**
- `Error(64)` = Windows **`ERROR_NETNAME_DELETED`**. `<CM>`이 클라이언트 IP이므로 이건 **클라이언트 TCP 소켓 단절**(거부 응답 후 사본출력 프로그램이 연결을 닫음)이며, 실패의 *결과*이지 원인이 아니다.

### 대상 PC

| 구분 | IP |
| --- | --- |
| 오류 없는 PC | 116.2.51.75, 116.2.234.133 |
| 오류 있는 PC | 116.2.51.74, 116.2.51.76, 116.2.234.138 |

파일 존재 확인은 **서버→NAS** 단계라 클라이언트별 설정과 무관하다. 특정 PC만 실패한 것은 고정 원인이 아니라 **SMB 세션이 끊겨 있던 시점에 요청이 몰린 타이밍성(간헐적) 현상**일 가능성이 높다(동일 NAS·동일 볼륨 공유).

---

## 4. 핵심 원인 — `IsFile()`의 오탐

`File does not exist` 거부는 서버의 아래 분기에서 발생한다.
`CISStorage2ServerClient::UploadFile()` → `if(!CISGF::IsFile(strFullPath))` → `ECIS_FILE_NOT_EXIST` 응답.

문제의 `IsFile` 구현:

```cpp
BOOL CISGF::IsFile(LPCTSTR lpFile) {
    if(!IsValidPathName(lpFile)) return FALSE;
    CFileStatus fs;
    if(!CFile::GetStatus(lpFile, fs))   // ← 네트워크 오류든 진짜 없든 전부 실패로 처리
        return FALSE;
    return !((fs.m_attribute & FILE_ATTRIBUTE_DIRECTORY) != 0);
}
```
`CISLib\trunk\Source\CISCommon\CISGF.cpp` (IsFile)

- `CFile::GetStatus`는 내부적으로 `FindFirstFile`/`GetFileAttributes` 호출. **"파일 없음"과 "공유 접근 불가(세션 끊김, 권한, 네트워크 이름 없어짐)"를 구분하지 않고 모두 `FALSE`.**
- 따라서 **SDS 호스트↔NAS SMB 세션이 끊긴 순간**, 파일이 존재해도 `IsFile()==FALSE` → 서버는 `File does not exist`로 다운로드 거부.

### 정황 근거

- 로그에 **볼륨 접속 실패(`volume not exist` / `ConnectVolume` 에러)는 없고** 곧바로 `File does not exist`가 찍힘.
- 볼륨은 시작 시 캐시된 `Active` 상태(`GetVolumeFullPath`의 `IsAvailable()`는 캐시 플래그만 확인)라 통과되지만, **실제 파일 stat 단계에서 SMB I/O가 실패**하는 전형적 패턴.
- 사용자 관찰("경로에 이미지가 있는데 없다고 나옴" + "지정된 네트워크 이름을 더 이상 사용할 수 없습니다")과 정확히 부합.

---

## 5. 병행 문제 — SDS 서비스 크래시

Windows 이벤트뷰어(Application Error, Event 1000):

| 항목 | 내용 |
| --- | --- |
| 실패 앱 | `CISStorageServerSDS.exe` v2.0.1.4 |
| 모듈 ① | `MSVCR90.dll` (9.0.30729.9247), 예외 `0x40000015` = `STATUS_FATAL_APP_EXIT` |
| 모듈 ② | `uiautomationcore.dll` |
| 시작 시각 | 12:02 부터 (36·37번 서비스 동일) |

- `MSVCR90 0x40000015` = VC9 런타임이 프로세스를 강제 종료(처리되지 않은 C++ 예외 / CRT invalid-parameter / abort 계열, 잘못된 버퍼·인덱스 등).
- `uiautomationcore.dll` 크래시는 서비스에 UI Automation 모듈이 얽혀 발생하는 2차 크래시로 추정.
- 즉 **거부 로그(기능 오류) + 서비스 크래시(안정성 오류)** 가 겹쳐 장애로 확대됨.

---

## 6. InfUpDown 코드 관점 (원인 아님)

`InfUpDown.dll`은 서버 결과를 그대로 EMR로 변환·전달할 뿐이다.

```cpp
// InfUpDownProc::ParseRemoteError
case ECIS_FILE_NOT_EXIST:      // -210
    return INFERR_REMOTE_NOT_EXIST;   // → EMR엔 "원격 파일 없음"으로 전달
```
`CIS_CUSTOM\삼성서울병원\InfUpDown\Source\InfUpDown\InfUpDownProc.cpp`

- 요청 경로가 이미 `$1$MIX`(볼륨1)로 정상 해석 → `StorageVolumeInfo.xml` 매핑(`SetVolumeInfo`) 정상. (매핑 오류면 `volume not exist`가 떴을 것.)
- **따라서 DLL 수정 대상이 아니다. 원인은 서버/인프라 측.**

---

## 7. 권장 조치

### 인프라 (1순위)
- [ ] SDS 서버 호스트 ↔ NAS `\\116.2.153.56` 간 **SMB 세션 안정성** 점검: 네트워크 순단, NAS 재부팅/세션 타임아웃, SMB 세션 수 한계, SMB 서명/방언(SMBv1↔v2) 협상, 서비스 계정의 공유 접근 권한·세션 유지.
- [ ] Windows 시스템 로그에서 동시간대 `SMB`/`LanmanWorkstation`/`MRxSmb` 경고 대조.

### 서비스 (2순위)
- [ ] `CISStorageServerSDS.exe` v2.0.1.4 크래시 덤프(WER `.dmp`) 확보 후 `MSVCR90`/`uiautomationcore` 스택 확인.
- [ ] 재발 방지용 서비스 자동 재시작(복구 옵션) 임시 설정.

### 코드 개선 (근본)
- [ ] 서버의 파일 거부 로직이 **"네트워크 접근 실패"와 "실제 파일 없음"을 구분**하도록 개선. `IsFile()==FALSE`를 무조건 `ECIS_FILE_NOT_EXIST`로 처리하지 말고, `GetLastError()`가 `ERROR_NETNAME_DELETED`/`ERROR_BAD_NETPATH` 등이면 **볼륨을 Unavailable로 내리고 재연결 후 재시도** 또는 별도 에러코드 응답.

---

## 8. 추가 확인 필요

- [ ] SDS **서버 호스트에서 직접** `\\116.2.153.56\cis_nas\CIS_STORAGE\MIX\2023\1127\H0033\...\..._001.jpg` 접근이 항상 되는지(간헐 실패 재현 여부).
- [ ] 실패 IP들이 특정 시간대에만 몰렸는지 vs. 특정 검사(스터디)에서만 발생하는지.
- [ ] 크래시 시점(12:02)과 거부 로그(09:57 / 11:45 / 13:43)의 선후 관계 — 크래시가 먼저인지, 거부 누적 후 크래시인지.

---

## 9. 참고 — 코드 위치

| 항목 | 파일 |
| --- | --- |
| `File does not exist` 거부 분기 | `CISLib\trunk\Source\CISStorage\CISStorage2ServerClient.cpp` (`UploadFile`) |
| `IsFile` 오탐 원인 | `CISLib\trunk\Source\CISCommon\CISGF.cpp` (`IsFile`) |
| 접속 거부(연결 단계) | `CISLib\trunk\Source\CISIOCP2\CISIOCP3_Server.cpp` (`AcceptCondition`) |
| 서버 엔진 | `CISLib\trunk\Source\CISStorage\CISStorage2Server.cpp` (`CISStorage2Server` : `CISIOCP3_Server`) |
| 서비스 진입 | `CIS_1400\trunk\Source\CISStorageServerSDS\CISStorageServerSDS.cpp` |
| 클라이언트(전달자) | `CIS_CUSTOM\삼성서울병원\InfUpDown\Source\InfUpDown\InfUpDownProc.cpp` |

---

> [[김도연\|김도연]]
