---
{"dg-publish":true,"permalink":"/iis/cis-receiver-dll-500-error-guide/","tags":["IIS","CIS","ISAPI","트러블슈팅"],"dg-note-properties":{"tags":["IIS","CIS","ISAPI","트러블슈팅"],"created":"2026-06-29","related":["CIS 분석"]}}
---

[[CIS 2.0/CIS 분석\|CIS 분석]]
# IIS ISAPI RECEIVER.dll HTTP 500 오류 분석 및 조치 가이드

> 작성일: 2026-06-29
> 환경: Windows Server 2019, IIS 10.0, 원격 데스크톱(172.17.33.55)
> 대상: CIS260629 가상디렉토리 ISAPI DLL 등록 후 발생한 500 오류

## 관련 노트
- [[CIS 2.0/CIS 분석\|CIS 분석]]

---

## 1. 오류 개요

### 증상
- 신규 가상디렉토리(`CIS260629`) 등록 후 해당 경로 접근 시 HTTP 500.0 오류 발생
- 기존 정상 동작하던 가상디렉토리(`CIS`, `CIS_TC35`, `CIS2`)도 동시에 500 오류 발생

### 오류 상세 정보

| 항목 | 내용 |
|------|------|
| 오류 코드 | HTTP 500.0 - Internal Server Error |
| 오류 번호 | `0x8007007f` |
| 모듈 | IsapiModule |
| 처리기 | ExecuteRequestHandler / ISAPI-dll |
| 요청 URL | `http://172.17.33.55:80/CIS260629/receiver.dll` |
| 실제 경로 | `C:\INFINITT\IISReceiver_260629\receiver.dll` |
| 로그온 방법 | 익명 |

### 오류 코드 의미
```
0x8007007f = "지정된 프로시저를 찾을 수 없습니다"
→ DLL 자체는 로드되었으나 내부 함수를 찾지 못하거나
  의존성 DLL이 누락된 경우
```

---

## 2. 이벤트 로그 분석

### 이벤트 뷰어 확인 내용

```
이벤트 ID : 10010 (경고)
원본      : RestartManager
사용자    : KNMEMAP2\idcadm
컴퓨터    : knmemap2
로그 날짜 : 2026-06-29 오후 4:19:53

메시지:
응용 프로그램 'C:\Windows\SysWOW64\inetsrv\w3wp.exe'(PID 7216)를
다시 시작할 수 없습니다.
응용 프로그램 SID가 지휘자 SID와 일치하지 않습니다.
```

### 오류 전파 구조

```
CIS260629 가상디렉토리 등록
        ↓
w3wp.exe (워커 프로세스) 크래시
        ↓
RestartManager가 재시작 시도
        ↓
"SID 불일치" → 재시작 실패
        ↓
IIS 워커 프로세스 중단 상태 유지
        ↓
기존 CIS, CIS_TC35, CIS2 등 모두 500 에러
```

### SysWOW64 경로의 의미
- `SysWOW64\inetsrv\w3wp.exe` = **32bit 워커 프로세스**
- App Pool 실행 계정(`idcadm`)과 프로세스 SID 불일치 발생
- 같은 App Pool을 공유하는 **모든 가상디렉토리**에 영향

---

## 3. 원인 분석

### 주요 원인 목록

| 순위 | 원인 | 설명 |
|------|------|------|
| ★ 1 | App Pool SID 불일치 | `idcadm` 계정 SID와 w3wp.exe 프로세스 SID 불일치 |
| ★ 2 | App Pool 공유 | 기존 가상디렉토리들과 동일 App Pool 사용 |
| 3 | 32bit/64bit 불일치 | RECEIVER.dll 비트와 App Pool 설정 불일치 |
| 4 | 의존성 DLL 누락 | receiver.dll이 참조하는 외부 DLL 없음 |
| 5 | web.config 상속 | 신규 web.config가 상위 설정에 영향 |

### ISAPI 및 CGI 제한 등록 현황

| 이름 | 상태 | 경로 |
|------|------|------|
| CIS IIS | 허용됨 | `C:\INFINITT\IISReceiver\RECEIVER.dll` |
| CIS RECEIVER UTF-8 | 허용됨 | `C:\INFINITT\IISReceiver_260629\RECEIVER.dll` |
| CIS TC35 | 허용됨 | `C:\INFINITT\IISReceiver_TC35\RECEIVER.dll` |
| CIS2 IIS | 허용됨 | `C:\INFINITT\IISReceiver2\RECEIVER.dll` |

---

## 4. 단계별 조치 방법

### Step 1. 격리 테스트 (즉시 실행)

```
IIS 관리자 → Default Web Site → CIS260629
→ 우클릭 → 제거
→ iisreset
→ 기존 CIS receiver.dll 접속 테스트
```

> 기존이 정상 복구되면 → CIS260629 등록 방식 문제 확정

---

### Step 2. App Pool 계정을 ApplicationPoolIdentity로 변경 (핵심)

```
IIS 관리자 → 응용 프로그램 풀
→ 해당 Pool 선택 → 고급 설정
→ 프로세스 모델 → ID
→ ApplicationPoolIdentity 로 변경
→ 확인
```

```cmd
iisreset /stop
iisreset /start
```

---

### Step 3. CIS260629 전용 App Pool 생성 및 분리

```
IIS 관리자 → 응용 프로그램 풀 → 추가
  이름              : Pool_CIS260629
  .NET CLR 버전     : 관리 코드 없음
  관리되는 파이프라인: 클래식
```

**고급 설정:**
```
32비트 응용 프로그램 사용 : True
ID                       : ApplicationPoolIdentity
```

---

### Step 4. idcadm 계정 SID 확인

```cmd
wmic useraccount where name='idcadm' get sid
whoami /user
```

---

### Step 5. DLL 의존성 확인

```cmd
dumpbin /exports C:\INFINITT\IISReceiver_260629\RECEIVER.dll
dumpbin /dependents C:\INFINITT\IISReceiver_260629\RECEIVER.dll
```

---

### Step 6. 폴더 권한 확인 및 부여

```cmd
icacls "C:\INFINITT\IISReceiver_260629"
icacls "C:\INFINITT\IISReceiver_260629" /grant "IIS_IUSRS:(RX)"
```

---

### Step 7. web.config 상속 차단

```xml
<configuration>
  <location path="." inheritInChildApplications="false">
    <system.webServer>
      <handlers>
        <add name="ISAPI-dll"
             path="*.dll"
             verb="*"
             modules="IsapiModule"
             scriptProcessor="C:\INFINITT\IISReceiver_260629\RECEIVER.dll"
             resourceType="File"
             requireAccess="Execute"
             allowPathInfo="true" />
      </handlers>
    </system.webServer>
  </location>
</configuration>
```

---

### Step 8. 이벤트 로그 PowerShell 추출

```powershell
Get-EventLog -LogName Application -Newest 50 |
Where-Object { $_.EntryType -eq "Error" -or $_.EntryType -eq "Warning" } |
Format-List TimeGenerated, Source, EventID, Message
```

---

## 5. 빠른 조치 순서 요약

```
① App Pool ID → ApplicationPoolIdentity 변경
        ↓
② iisreset
        ↓
③ 기존 CIS receiver.dll 정상 확인
        ↓
④ CIS260629 전용 Pool(Pool_CIS260629) 생성
   - 파이프라인: 클래식
   - 32bit: True
   - ID: ApplicationPoolIdentity
        ↓
⑤ CIS260629 가상디렉토리 재등록
        ↓
⑥ 전체 테스트
```

---

## 6. 체크포인트 요약

| 확인 항목 | 정상 상태 | 문제 상태 |
|-----------|-----------|-----------|
| App Pool 분리 | 각 가상디렉토리 전용 Pool | 동일 Pool 공유 |
| App Pool ID | ApplicationPoolIdentity | idcadm (SID 불일치) |
| 파이프라인 모드 | 클래식 (ISAPI용) | 통합 모드 |
| 32bit 설정 | DLL 비트와 일치 | 불일치 |
| ISAPI 제한 | 허용됨 | 거부됨 |
| DLL 권한 | IIS_IUSRS 읽기+실행 | 권한 없음 |
| w3wp.exe SID | Pool ID와 일치 | 불일치 (이벤트 10010) |

---

## 7. 참고 사항

- **이벤트 ID 10010**: RestartManager가 w3wp.exe 재시작 실패 → SID 불일치
- **SysWOW64\inetsrv\w3wp.exe**: 32bit 워커 프로세스 → App Pool 32bit 설정 필요
- **0x8007007f**: DLL 로드 성공 but 내부 프로시저 미발견 → 의존 DLL 누락 가능성
- ISAPI DLL은 **클래식 파이프라인 모드**에서 안정적으로 동작
