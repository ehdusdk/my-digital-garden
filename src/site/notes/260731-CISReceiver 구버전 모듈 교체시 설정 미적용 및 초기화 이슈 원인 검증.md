---
{"dg-publish":true,"permalink":"/260731-cis-receiver/","dg-note-properties":{}}
---

# 260731 CISReceiver 구버전(의정부성모) 모듈 교체 시 설정 미적용 및 초기화 이슈 원인 검증

## 1. 개요 및 검증 배경

- **이슈 개요**: 의정부성모병원 등 구버전 배포 환경(`260720-CISReceiver2.0 Old 의정부성모버전`)의 설정 파일(`config/`, `data/`, `Receiver/*.xml` 등)을 그대로 유지한 채 `D:\Proj\CIS_1400\trunk\BIN\Win32\ReleaseUnicode` 최신 배포 폴더의 `exe` 및 `dll` 모듈을 교체 적용할 때, 기존 설정이 바로 적용되지 않거나 Receiver 설정 목록이 비어보이고 일부 리시버가 누락/재생성되는 현상 발생.
- **분석 대상 폴더/소스**:
  - 구버전 배포 원본: `D:\doc\이슈\260720-CISReceiver2.0 Old 의정부성모버전\CIS Receiver_old.zip`
  - 최신 소스 및 배포: `D:\Proj\CIS_1400\trunk\Source\CISReceiver`, `D:\Proj\CIS_LIB_2008\CISLib\trunk`
  - 최신 바이너리: `D:\Proj\CIS_1400\trunk\BIN\Win32\ReleaseUnicode`

---

## 2. 주요 현상 및 원인 분석 (Empirical Verification)

### 현상 1: 벤더 명칭이 `{str:21915}`로 깨져서 표시되는 현상
- **분석 결과**:
  - `CISLibRes.cpp` (Line 144) 소스코드 확인:
    ```cpp
    CString CISLibRes::GetString(UINT uStringID)
    {
        CString str;
        str.LoadString(s_Instance.m_hResource, uStringID);
        if(str.IsEmpty())
            str.Format(_T("{str:%d}"), uStringID); // <-- 리소스 로드 실패 시 예외 출력!
        return str;
    }
    ```
  - `{str:21915}` 구문은 `Res/` 하위 폴더의 리소스 DLL (`CISModalityResourceEng.dll`, `CISResourceEng.dll` 등)에서 해당 String Resource ID(`IDS_VENDOR_INFINITT_Healthcare` = 21915)를 찾지 못할 때 출력되는 기본 Fallback 포맷임.
  - 모듈 교체 시 `Res/` 하위 폴더의 리소스 DLL들을 최신 버전으로 함께 교체하지 않고 구버전 `Res/` 폴더를 그대로 사용하여 발생함.

---

### 현상 2: Philips TC-70 리시버 2개(`untitled`, `ArpiERIN`)가 목록에서 누락되는 현상
- **분석 결과 (XML `<Type id="...">` 불일치 및 C++ Switch-Case 거부)**:
  - `Receiver/*.xml` 설정 파일 4개 비교 분석:
    - 정상 로드된 2개 (`ArpiJPG2`, `ArpiJPG`): **`<Type id="8"/>`** (`cis_interface_type_Polling`)
    - 누락된 2개 (`untitled`, `ArpiERIN`): **`<Type id="128"/>`** (`cis_interface_type_PrintPort`)
  - `Philips_TRIM3.cpp` (`Philips_TRIM3::OnCISModality_CreateReceiver`) 소스코드 확인:
    ```cpp
    CISReceiver* Philips_TRIM3::OnCISModality_CreateReceiver(CIS_INTERFACE_TYPE RcvType)
    {
        CISFilePollingReceiver2* pReceiver = NULL;
        switch(RcvType)
        {
            case cis_interface_type_Polling: // <-- RcvType이 8 (Polling)일 때만 생성!
                pReceiver = reinterpret_cast<CISFilePollingReceiver2*>(...);
                break;

            default: // <-- 128 (PrintPort) 등 다른 값이 오면 NULL 반환!
                ASSERT(FALSE);	
                break;
        }
        return pReceiver; // NULL 리턴
    }
    ```
  - `CISReceiverU.exe` 시작 시 `LoadReceiverFromXML()` -> `AddReceiver()` 호출 중 `Philips_TRIM3` 모달리티가 `<Type id="128"/>` 수신을 거부하고 `NULL`을 반환하여 해당 2개 XML 파일 생성을 실패(스킵) 처리함.
  - **해결**: 해당 XML 파일 5번째 줄의 `<Type id="128"/>`을 **`<Type id="8"/>`**로 변경 시 4개 항목 모두 정상 표기됨.

---

### 현상 3: 신규 모달리티 드라이버 DLL 누락에 따른 전체 리시버 로드 스킵
- **분석 결과**:
  - `CISReceiverU.exe` 시작 시 `CISModalityCore::LoadModalityAll()`이 실행되며 신규 모달리티 DLL(`RcvAD001U.dll` ~ `RcvUX001U.dll`, `CISModalityCoreU.dll` 등)을 로드함.
  - 최신 EXE만 교체하고 신규 모달리티 DLL을 복사하지 않으면 `LoadModality()`가 실패하여 모달리티 등록이 거부되고, 결과적으로 기존 `Receiver/*.xml` 로드가 거부됨.

---

### 현상 4: 프로필 자동 동기화 (`ProfileRevision` 및 DB/Storage)에 따른 XML 자동 덮어쓰기
- **분석 결과**:
  - `ServerInfo.xml`에 DB/Storage 서버 접속 정보가 설정되어 있는 경우, 실행 시 `CReceiverProfile::CheckProfileRevision()`이 DB 서버 쿼리(`CRUZQuery_GetProfile`)를 수행함.
  - 서버의 Profile Revision이 높으면 최신 프로필을 다운로드하고, `LoadReceiver()`에서 `g_Manager.SaveReceiverToXML()`을 호출하여 로컬의 모든 `Receiver/*.xml` 파일을 서버 기준으로 자동 재저장/덮어쓰기함.

---

> [!IMPORTANT]
> ## 3.  향후 CIS Receiver 모듈 교체/배포 시 표준 체크리스트 (핵심 중요)
>
> 앞으로 CIS Receiver 모듈을 신규 배포하거나 구버전 사이트에 업데이트할 때, 설정 누락 및 동작 오류를 방지하기 위해 **반드시 아래 체크리스트 절차를 준수**해야 합니다.
>
> ###  모듈 일괄 교체 규칙 (부분 교체 절대 금지)
> 1. **`Res/` 하위 폴더 전체 교체**:
>    - 최신 배포 폴더(`ReleaseUnicode`) 내의 **`Res/` 폴더 전체(`CISModalityResource*.dll`, `CISResource*.dll` 포함)**를 대상 폴더에 통째로 덮어쓰기 합니다.
>    - *(목적: UI 문자열 갱신 및 `{str:XXXX}` 깨짐 현상 방지)*
> 2. **모든 DLL 및 EXE 일괄 교체**:
>    - `CISReceiverU.exe` 뿐만 아니라 **모든 `*.dll` 파일(신규 모달리티 드라이버 DLL `RcvAD001U.dll` ~ `RcvUX001U.dll` 및 Core DLL 포함)**을 일괄 덮어쓰기 합니다.
>    - *(목적: 모달리티 동적 로드 실패로 인한 리시버 XML 읽기 거부 방지)*
>
> ###  구버전 XML 설정 파일 검증 규칙
> 3. **`Receiver/*.xml` 내 `<Type id="...">` 태그 값 점검**:
>    - 구버전 2018년 이전 설정 파일 중 5번째 줄의 Type ID가 **`<Type id="128"/>`**로 되어 있는 리시버가 있다면 **`<Type id="8"/>`**로 수정합니다.
>    - *(목적: `Philips_TRIM3` 등 모달리티 클래스의 `OnCISModality_CreateReceiver` 8번(Polling) 처리 호환성 확보)*
> 4. **절대 경로(Hardcoded Paths) 점검**:
>    - `ReceiverSetting.xml` 및 `Receiver/*.xml` 내 `<Output>`, `<BackupDir>`, `<Root unc="...">` 등의 경로가 해당 서버의 실제 폴더 경로와 일치하는지 확인합니다.
>
> ###  보존해야 할 기존 파일
> 5. **고유 설정 파일 백업 및 유지**:
>    - `Config/` (환경설정)
>    - `Data/ServerInfo.xml` (DB/Storage 서버 IP/Port)
>    - `Receiver/*.xml` (장비별 세부 리시버 설정)
>    - `License/CISReceiver.lic` (사이트 라이선스 파일)

---

## 4. 결론

이번 이슈는 구버전 배포 환경에 일부 모듈만 복사하면서 **`Res/` 리소스 DLL 불일치(`{str:21915}`)**와 **XML `<Type id="128"/>`값의 모달리티 클래스 수신 거부(Philips 리시버 누락)**가 복합적으로 작용하여 발생하였습니다.

앞으로 모듈 업데이트 시 상기 **"표준 배포 체크리스트"**에 따라 **`Res/` 폴더를 포함한 전체 DLL/EXE 일괄 덮어쓰기** 및 **XML Type ID(`8`) 확인**을 진행하면 한 번에 안전하고 완벽하게 배포를 완료할 수 있습니다.
