---
{"dg-publish":true,"permalink":"//260729-inf-up-down-cisemr-client/","tags":["이슈","코드분석","InfUpDown","CISEMRClient","삼성서울","강북삼성","고려대","KUMC","CISStorageServerSDS","ECG","비교분석"],"dg-note-properties":{"tags":["이슈","코드분석","InfUpDown","CISEMRClient","삼성서울","강북삼성","고려대","KUMC","CISStorageServerSDS","ECG","비교분석"],"date":"2026-07-29"}}
---

# 260729-InfUpDown vs CISEMRClient 기능 비교 분석

> **문의**: `CIS_CUSTOM\삼성서울병원\InfUpDown` 과 `CIS_1400\CISEMRClient` 의 기능이 유사한지 / 상위 버전 관계인지 코드 분석으로 확인.
> **엔지니어 전달 내용**: InfUpDown = 삼성서울 초기 버전(`CISStorageServerSDS` 연동 파일 업/다운로드), CISEMRClient = 고려대 때 적용된 InfUpDown 상위 버전. 실사용처는 InfUpDown → 강북삼성, CISEMRClient → 고려대.
> **결론**: 유사·상위버전 관계가 **아니다**. 같은 개발자(Jong-Pil Choi)가 만든 **서로 다른 계층(레이어)의 형제(sibling) 컴포넌트**이며, "파일 다운로드" 한 조각만 겹칠 뿐 목적·연동 대상·기능 범위가 다르다.

관련: [[CIS 2.0/CIS 분석\|CIS 분석]] · [[이슈/260728-강북삼성-CISStorageServerSDS 사본출력 다운로드 장애 분석\|260728-강북삼성-CISStorageServerSDS 사본출력 다운로드 장애 분석]] · [[김도연\|김도연]]

---

## 1. 결론 요약

| 구분 | **InfUpDown** (삼성서울 → 강북삼성) | **CISEMRClient** (고려대 / KUMC) |
| --- | --- | --- |
| 성격 | **범용 파일 업/다운로드 라이브러리** | **EMR 검사결과 조회 + ECG/이미지 변환 모듈** |
| 최초 작성일 | 2014-05-19 (Jong-Pil Choi) | **2013-08-26** (Jong-Pil Choi) |
| 연동 서버 | `CISStorageServerSDS` 1곳 | **DB서버(CRUZ) + Storage서버** 2곳 |
| 사용 클라이언트 | `CISStorage2Client` (스토리지 전용) | `CRUZClient`(DB) + `CISStorageClient`(스토리지) |
| 입력 키 | 파일 경로(Local/Remote Path), VolumeID | **오더키**(OrderDT/Seq/CD/PatID/SpcID) 또는 **AccNo** |
| 파일 변환 | **없음** (바이너리 그대로 전송) | **있음** (ECG/Image/Numeric → PNG/JPG 렌더링) |
| 업로드 | 지원 (UploadFile 계열 4종) | **없음** (다운로드 전용) |
| DLL 골격 | MFC DLL: App + `InfUpDownProc` + `extern "C"` export | MFC DLL: App + `CISEMRClientProc` + `extern "C"` export |

> 파일/폴더 구조는 쌍둥이처럼 닮았지만(App + Proc + export 3종 세트), **하는 일이 다른 계층**이다.

---

## 2. InfUpDown — 범용 파일 전송 SDK

전달받은 "`CISStorageServerSDS` 연동 파일 업/다운로드"가 정확히 이 모듈이다. DB를 모르고, 파일 내용을 해석하지 않으며, 전달받은 경로의 파일을 **그대로** 올리고 내린다.

**Export 함수 (스토리지 원시 조작만):**

- 연결: `Connect(ServerIP, Port)` / `Disconnect`
- 업로드: `UploadFile` / `UploadFile2` / `UploadFileEx` / `UploadFileEx2`
- 다운로드: `DownloadFile` / `DownloadFile2`
- 삭제: `DeleteRemoteFile` / `DeleteRemoteFile2`
- 멀티 다운로드: `ResetDownloadList` / `PushDownload` / `StartMultiDownload`
- 메모리 다운로드(콜백): `SetDownloadCallback` / `DownloadMemory` / `DownloadMemory2` / `PushDownloadMemory`
- 볼륨/로그: `SetVolumeInfo` / `SetLogDirectory`

**구현부 핵심** — `InfUpDownProc`는 `CISStorage2Client m_Client` 하나만 보유하고 `m_Client.PushUpload / PushDownload / StartUpload / StartDownload / DeleteFile / PushDownloadMemory` 를 그대로 위임한다. 볼륨 매핑은 `StorageVolumeInfo.xml`(`SetVolumeInfo`) 기반.

```cpp
// InfUpDownProc.h — 보유 멤버가 스토리지 클라이언트 하나뿐
CISStorage2Client   m_Client;   // 신형("2") 스토리지 클라이언트
CISLog              m_Log;
// DB 클라이언트 없음, 포맷 변환 없음
```

---

## 3. CISEMRClient — EMR 검사결과 조회 + ECG 변환 모듈

한 단계 위의 **업무 로직 모듈**. 오더키/AccNo만 받아서 DB를 뒤져 파일 목록을 얻고, 스토리지에서 내려받은 뒤, 타입별로 이미지를 렌더링해 저장한다.

**동작 흐름:**

```
DownloadFile(OrderDT, OrderSeq, OrderCD, PatID, SpcID)  또는  DownloadFile2(AccNo)
   1) CRUZClient(m_DBClient) 로 DB 조회
        GetOrderKey → GetOrderInfo → 오더 → 검사(Exam) → Instance 파일 목록
   2) CISStorageClient(m_STClient) 로 스토리지에서 파일 다운로드   ← InfUpDown과 겹치는 유일한 조각
        m_STClient.Push_DownloadFile → StartJob
   3) 파일 타입(m_FileType)별 변환
        ECG      → ConvertECG() 로 파형 렌더링
        Image    → 이미지 포맷 변환(PNG/JPG)
        Numeric  → 원본 유지(이미지 변환 미지원)
```

**Export 함수 — ECG 렌더링 옵션이 인터페이스의 절반 이상 (예상대로 ECG 치중):**

- 서버/출력 설정: `SetDatabaseServerInfo` / `SetStorageServerInfo` / `SetOutputDirectory` / `UseRename`
- 포맷: `SetImageFormat` / `SetNumericFormat`
- **ECG 전용**: `SetECGFormat` / `SetECGDesign` / `SetECGDesignCustom` / `SetECGWaveDisp` / `SetECGRhythmCh` / `SetECGDateTimeFormat` / `SetECGAccessory`
- 다운로드: `DownloadFile(오더 5키)` / `DownloadFile2(AccNo)`

**구현부 핵심** — `CISEMRClientProc`는 DB·스토리지 두 클라이언트를 모두 보유하고, ECG/Image/Numeric 옵션 구조체와 `ConvertECG()`, `CRUZ_Term_ExamfileType` 기반 분기를 가진다.

```cpp
// CISEMRClientProc.h — DB + Storage 두 클라이언트 보유
CRUZClient          m_DBClient;   // 오더/검사/Instance DB 조회
CISStorageClient    m_STClient;   // 구형 스토리지 클라이언트("2" 없음)
struct { ... CIS_ECG_STOCK_DESIGN_ID m_eECGDesign; ... } m_ECGOpt;  // ECG 렌더링 옵션
```

---

## 4. 전달받은 내용과 어긋나는 점 (확인 필요)

"CISEMRClient가 InfUpDown의 상위 버전"이라는 전달 내용은 **코드 근거상 두 가지가 반대로** 나타난다.

1. **작성일 역전** — 헤더 주석 기준 CISEMRClient(**2013-08-26**)가 InfUpDown(**2014-05-19**)보다 **먼저** 만들어졌다. 상위/후속 버전이라면 시점이 반대여야 한다.
2. **스토리지 클라이언트 세대 역전** — InfUpDown은 `CISStorage2Client`(신형, 접미어 "2"), CISEMRClient는 `CISStorageClient`(구형)를 사용한다. 오히려 InfUpDown 쪽 스토리지 SDK가 더 최신이다.

→ 즉 **버전 관계가 아니라, 같은 CIS 스토리지 인프라를 공유하는 별개 목적의 형제 컴포넌트**로 보는 것이 코드와 부합한다.

---

## 5. 공통점 / 차이 정리

**공통점**
- 같은 저자(Jong-Pil Choi), 동일한 MFC DLL 골격(App + `~Proc` + `extern "C" PASCAL EXPORT`).
- 최종적으로 **CIS 스토리지 서버에서 파일을 내려받는다**는 한 조각.

**결정적 차이**
- InfUpDown = **파일 경로 in → 파일 out** (저수준 전송, 업로드 포함, 변환 없음, DB 없음).
- CISEMRClient = **오더키 in → 렌더링된 검사결과 이미지 out** (고수준 업무, 다운로드 전용, DB 조회 + ECG/이미지 변환 포함).
- 겹치는 부분은 CISEMRClient 내부 **2단계(스토리지 다운로드)** 뿐이며, 그마저 구형 클라이언트를 쓴다.

---

## 6. 참고 — 코드 / 문서 위치

| 항목 | 위치 |
| --- | --- |
| InfUpDown export 정의 | `CIS_CUSTOM\삼성서울병원\InfUpDown\Source\InfUpDown\InfUpDown.cpp` |
| InfUpDown 인터페이스 헤더 | `...\InfUpDown\Source\InfUpDown\InfUpDownProc.h` |
| InfUpDown 구현 | `...\InfUpDown\Source\InfUpDown\InfUpDownProc.cpp` |
| InfUpDown 문서 | `...\InfUpDown\Doc\InfUpDown_v1~v6.pptx`, `InfUpDown_ErrorCode.pptx` |
| CISEMRClient export 정의 | `CIS_1400\trunk\Source\CISEMRClient\CISEMRClient.cpp` |
| CISEMRClient 인터페이스 헤더 | `...\CISEMRClient\CISEMRClientProc.h`, `CISEMRClientLib.h` |
| CISEMRClient 구현 | `...\CISEMRClient\CISEMRClientProc.cpp` |
| CISEMRClient 문서 | `CIS_1400\doc\CISEMRClient_API\` (CISEMRClient / Sample) |

> 문의 원문의 "CISEMRClient는 ECG에 치중된 것으로 예상"은 코드상 **정확히 맞다**(ECG 렌더링 옵션 함수가 export의 절반 이상).

---

> [[김도연\|김도연]]
