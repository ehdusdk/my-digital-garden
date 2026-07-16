---
{"dg-publish":true,"permalink":"//iis-receiver-default-web-site-isapi/","tags":["이슈","IIS","ISAPI","500오류","트러블슈팅","ISAPI필터"],"dg-note-properties":{"tags":["이슈","IIS","ISAPI","500오류","트러블슈팅","ISAPI필터"]}}
---

> [[HIE팀 이슈\|← 이슈 목록으로]]

---

## 개요

| 항목 | 내용 |
|---|---|
| 서버 | 10.0.3.241 (WIN-0KG4CID0UV9), Windows Server 2019 / IIS 10.0 |
| 이슈 날짜 | 2026-07-15 |
| 관련 가상디렉토리 | `IISRECEIVER` (D:\CIS_ECG_ACCEPT), `CIS AM` (D:\INFINITT\CIS\IISReceiver_Automatch), `IISRECEIVER_OLD` (D:\IISReceiver_old, 테스트용 신규 등록) |
| 증상 | 노트북(원격, 동일 네트워크)에서 `IISRECEIVER/receiver.dll` 접근 시 HTTP 500 발생. 원인 추적 중 기존 정상 운영 중이던 `CIS AM`도 함께 500 발생하는 것을 확인 |

---

## 트러블슈팅 진행 과정

### 1단계 — web.config `preCondition` 값 오류 발견 및 수정

`IISRECEIVER`의 web.config에 등록된 핸들러 매핑에서 아래와 같이 `preCondition` 값이 잘못돼 있었음.

```xml
<add name="CIS_ECG_ACCEPT_ISAPI" path="RECEIVER.dll" verb="*" modules="IsapiModule"
     scriptProcessor="D:\CIS_ECG_ACCEPT\RECEIVER.dll" resourceType="Either"
     requireAccess="Execute"
     preCondition="bitness32,winx86_64,winx86_64,winx86_64,winx86_64,winx86_64,winx86_64,winx86_64,winx86_64,winx86_64,winx86_64" />
```

`winx86_64`는 IIS `preCondition`이 허용하는 표준 열거값이 아님(`bitness32`/`bitness64`, `integratedMode`/`classicMode` 등만 허용). `bitness32` 하나만 남기고 중복분 제거.

> 이 수정만으로는 문제가 해결되지 않음 → 다음 단계로 진행

### 2단계 — 서버 로컬 접속으로 상세 오류 확인 → 진짜 원인 발견

원격(노트북) 접속 시에는 IIS 기본 오류 모드(`DetailedLocalOnly`)로 인해 일반 500 페이지만 표시되어 원인 파악 불가. **서버 내부(RDP)에서 `localhost`로 접속**하여 상세 오류 확인:

```
ISAPI 필터 "D:\INFINITT\CIS\IISReceiver_Automatch\RECEIVER.dll"에 대한
GetProcAddress 호출이 실패했습니다.
오류 코드: 0x8007007f (지정된 프로시저를 찾을 수 없습니다)
```

`IISRECEIVER`의 web.config 문제가 아니라, **`Default Web Site`에 등록된 사이트 레벨 ISAPI 필터**(이름: `RECEIVER`, 실행 파일: `D:\INFINITT\CIS\IISReceiver_Automatch\RECEIVER.dll`)가 원인으로 확인됨.

### 3단계 — 필터 제거 → IISRECEIVER는 정상화, CIS AM은 여전히 500

`Default Web Site` → ISAPI 필터에서 `RECEIVER` 필터 제거 후:

- `IISRECEIVER/receiver.dll` → **정상 응답** (Philips 응답 XML, `errorcode 0 / Success` 확인)
- `CIS AM/receiver.dll` → **여전히 500**, 동일한 오류(`0x8007007f`, GetProcAddress 실패)

원인 확인 결과, `CIS AM` 자체의 핸들러 매핑(scriptProcessor)이 **필터와 무관하게 처음부터** 문제의 `D:\INFINITT\CIS\IISReceiver_Automatch\receiver.dll`을 직접 가리키고 있었음. 즉 필터 문제와 `CIS AM` 핸들러 문제가 같은 파일(Automatch 폴더 DLL)을 매개로 우연히 겹쳐 있었던 것.

### 4단계 — 신규(격리) 가상디렉토리로 DLL 자체 문제 확정

IIS 설정 문제인지 DLL 파일 자체 문제인지 구분하기 위해, 예전 버전 receiver.dll(`D:\IISReceiver_old`)로 **완전히 새로운 가상디렉토리 `IISRECEIVER_OLD`를 등록**하여 테스트. web.config는 로컬 오버라이드 없이 상위 상속 설정 그대로 사용.

→ 동일한 오류(`0x8007007f`, GetProcAddress 실패) 재현.

**결론: 가상디렉토리 설정, 핸들러 매핑, 자격 증명, App Pool 등 IIS 구성 문제가 아니라, 문제의 receiver.dll 파일 자체가 ISAPI 필수 진입점 함수(`GetExtensionVersion`, `HttpExtensionProc`, `TerminateExtension`)를 정상적으로 export하지 못하고 있는 것으로 확정.**

Dependency Walker(Dependencies x64)로 Import 확인 결과 필요한 종속 DLL(MFC42.DLL, MSVCRT.dll, kernel32.dll, user32.dll, CISCommon.dll)은 모두 정상 로드됨 — 문제는 Import가 아니라 **Export** 쪽. Export 함수 목록 비교 검증은 후속 진행 필요(§ 후속 조치 참고).

---

## 핵심 원리 — ISAPI 필터 vs ISAPI 핸들러 적용 범위 차이

이번 이슈에서 "필터에 DLL 하나만 등록했는데 왜 여러 가상디렉토리가 같이 죽는가"에 대한 핵심 원리.

| 구분 | 적용 범위 | 실행 시점 | 실패 시 영향 범위 |
|---|---|---|---|
| **핸들러 매핑** (`<handlers>`, 각 가상디렉토리 web.config) | 그 확장자 요청이 **해당 가상디렉토리로 들어올 때만** | 요청이 특정 URL/파일에 매칭될 때 | 해당 가상디렉토리(및 하위 상속 경로)에 한정 |
| **ISAPI 필터** (`Default Web Site` → ISAPI 필터) | **그 사이트로 들어오는 모든 요청** (확장자·경로 무관) | 요청이 파이프라인에 진입하는 가장 앞단, 핸들러보다 먼저 | **사이트 전체** — 필터 초기화(`GetFilterVersion`) 실패 시 사이트의 모든 가상디렉토리가 영향받음 |

필터는 워커프로세스가 요청을 처리하기 시작할 때 가장 먼저 로드·초기화되며, 이 초기화가 실패하면 IIS는 해당 사이트의 요청 처리 파이프라인 자체가 정상 구성되지 않았다고 판단하여, 이후 들어오는 요청은 **어떤 핸들러로 가려던 것이든 상관없이** 파이프라인 초기 단계에서 막혀 500이 됨.

```
[정상 시]
요청 → (사이트 진입) ISAPI 필터 초기화 → 핸들러 매핑 → 개별 DLL 실행 → 응답

[필터 DLL이 깨졌을 때]
요청 → (사이트 진입) ISAPI 필터 초기화 실패(GetProcAddress 실패) → 이후 모든 요청 500
       ※ 요청이 어느 가상디렉토리로 가려던 것인지는 무관 (필터가 더 앞단이므로)
```

---

## 주의사항 (재발 방지)

1. **특정 가상디렉토리 전용 DLL은 절대 사이트 레벨 ISAPI 필터로 등록하지 말 것.** 특정 vdir에서만 쓰려는 receiver.dll이라면 반드시 해당 vdir의 핸들러 매핑(`<handlers>`)으로 등록. 필터로 등록하면 그 DLL 하나의 결함이 사이트 전체 장애로 번짐.
2. **`preCondition` 값은 IIS 표준 열거값만 사용.** `bitness32`/`bitness64`, `integratedMode`/`classicMode`, `runtimeVersionv2.0`/`runtimeVersionv4.0` 등 이외의 임의 문자열(`winx86_64` 등)을 넣으면 500.19 Config Error 유발 가능.
3. **`GetProcAddress 호출이 실패했습니다` (오류 코드 `0x8007007f`)는 IIS 설정 문제가 아니라 DLL 파일 자체의 export 문제.** DLL 로드(LoadLibrary)는 성공했지만 ISAPI 필수 진입점 함수를 찾지 못한 것 — config를 아무리 고쳐도 해결되지 않으며, DLL 파일(빌드 결과물) 쪽을 확인해야 함.
4. **500 오류 진단은 반드시 서버 로컬(RDP 내부 `localhost`)에서 재현할 것.** 원격 클라이언트 접속 시에는 `DetailedLocalOnly` 기본 설정으로 인해 상세 오류(모듈/처리기/실제 경로/오류 코드)가 감춰지고 일반 500 페이지만 노출됨.
5. **원인이 "설정"인지 "DLL 파일 자체"인지 애매할 때는, 로컬 오버라이드 없는 신규 가상디렉토리를 깨끗하게 만들어 같은 DLL로 격리 테스트**하면 빠르게 구분 가능 (이번 `IISRECEIVER_OLD` 테스트가 그 사례).
6. **같은 폴더에 물린 여러 가상디렉토리(버전이 다른 receiver.dll)는 그 자체로는 문제가 아님.** 병원별로 CIS Receiver 버전이 다른 것은 정상적인 운영 구조. 다만 서로 다른 버전을 **같은 App Pool에서 공유**하면 한쪽 크래시가 다른 쪽까지 전파될 수 있으므로 App Pool 분리(애플리케이션 전환) 권장.

---

## 후속 조치 (미해결)

- [x] Dependencies(또는 DLL Export Viewer)로 `D:\INFINITT\CIS\IISReceiver_Automatch\RECEIVER.dll`, `D:\IISReceiver_old\RECEIVER.dll`의 **Export 함수 목록** 확인 → 정상 동작 중인 `D:\CIS_ECG_ACCEPT\RECEIVER.dll`과 비교하여 `GetExtensionVersion`/`HttpExtensionProc`/`TerminateExtension` 존재 여부 및 이름 데코레이션(`_함수명@숫자` 형태 여부) 확인
- [x] Automatch/OLD 버전 DLL이 과거 다른 서버(Windows Server 2008/2012, IIS 6/7 등)에서 정상 동작한 이력이 있는지 확인 → 파일 손상 문제인지, 구버전 빌드와 최신 IIS 간 호환성 문제인지 구분
- [x] `CIS AM` 실사용 여부 확인 (실사용 중이면 정상 버전 DLL로 교체, 레거시면 vdir 비활성화/삭제)
- [x] `IISRECEIVER` 애플리케이션 ↔ 가상디렉토리 전환 상태 정리 (전용 App Pool 분리 여부 최종 확정)

---

## 참고 — 가상디렉토리 ↔ 애플리케이션 복구 방법 (appcmd)

```cmd
%windir%\system32\inetsrv\appcmd delete app "Default Web Site/대상경로"
%windir%\system32\inetsrv\appcmd add vdir /app.name:"Default Web Site/" /path:"/대상경로" /physicalPath:"실제물리경로"
```

GUI: 대상 항목 우클릭 → "애플리케이션 제거" → 같은 항목 우클릭 → "가상 디렉터리로 변환" (실제 파일은 영향받지 않음, 단 전용 App Pool은 자동 삭제되지 않으므로 필요 시 별도 정리)

---

> [[HIE팀 이슈\|← 이슈 목록으로]]
