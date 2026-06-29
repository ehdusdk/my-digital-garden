---
{"dg-publish":true,"permalink":"/hie-dykim/iis-app-pool/","tags":["IIS","CIS","AppPool","ISAPI","트러블슈팅","장애격리"],"dg-note-properties":{"created":"2026-06-29","tags":["IIS","CIS","AppPool","ISAPI","트러블슈팅","장애격리"]}}
---

[[CIS 2.0/CIS 분석\|← CIS 분석 인덱스로]]

# IIS App Pool 분리 필요성 및 Internal 500 에러 연관 분석

> 작성일: 2026-06-29
> 환경: Windows Server 2019, IIS 10.0 (172.17.33.55)
> 관련 노트: [[IIS/CIS_RECEIVER_DLL_500_Error_Guide\|IIS RECEIVER.dll 500 오류 가이드]]

---

## 1. 핵심 결론

> **App Pool 분리는 이번 500 에러의 근본 해결책이자 재발 방지책이다.**

App Pool을 분리하는 이유는 단순 설정 관례가 아니라,  
**ISAPI DLL 장애가 전체 서비스로 전파되는 것을 차단**하기 위한 필수 구조적 조치이다.

---

## 2. App Pool 공유 시 장애 전파 구조

```
[DefaultAppPool 또는 CIS RECEIVER Pool 공유]
        ↓
┌─────────────────────────────────┐
│  CIS        ─┐                  │
│  CIS_TC35   ─┤→ 같은 w3wp.exe  │
│  CIS2       ─┤   (워커프로세스) │
│  CIS260629  ─┘                  │
└─────────────────────────────────┘
        ↓
CIS260629의 RECEIVER.dll 오류 발생
        ↓
w3wp.exe 프로세스 전체 크래시
        ↓
같은 Pool의 CIS, CIS_TC35, CIS2
모두 500 에러 발생  ← 이번 상황
```

---

## 3. App Pool 분리 후 장애 격리 구조

```
[Pool_CIS]        [Pool_CIS_TC35]    [Pool_CIS260629]
     ↓                   ↓                  ↓
  w3wp.exe           w3wp.exe           w3wp.exe
  (프로세스A)        (프로세스B)        (프로세스C)
     ↓                   ↓                  ↓
  CIS 정상            TC35 정상        260629 오류
                                            ↓
                                    프로세스C만 크래시
                                    A, B는 영향 없음
```

> 한 DLL이 죽어도 다른 서비스는 독립 프로세스로 정상 유지

---

## 4. 이번 이슈와의 직접 연관성

| 구분 | 내용 |
|------|------|
| 근본 원인 | CIS260629 RECEIVER.dll → w3wp.exe 크래시 |
| 전파 원인 | **App Pool 공유** → 전체 가상디렉토리 영향 |
| 이벤트 10010 | SID 불일치로 w3wp.exe **재시작도 실패** |
| 결과 | 모든 CIS 계열 500 에러 동시 발생 |

### 이벤트 로그 핵심 메시지
```
이벤트 ID : 10010 (경고) / 원본: RestartManager
메시지:
응용 프로그램 'C:\Windows\SysWOW64\inetsrv\w3wp.exe'(PID 7216)를
다시 시작할 수 없습니다.
응용 프로그램 SID가 지휘자 SID와 일치하지 않습니다.
```

---

## 5. 애플리케이션 변환과 App Pool의 관계

### 현재 IISRECEIVER 설정 (고급 설정 확인)

| 항목 | 값 |
|------|-----|
| 가상 경로 | `/IISRECEIVER` |
| 미리 로드 활성화됨 | False |
| 실제 경로 | `D:\Test\CIS_ECG_ACCEPT` |
| 애플리케이션 풀 | CIS RECEIVER |
| 프로토콜 | http |

### 가상디렉토리 vs 애플리케이션 차이

| 구분 | 가상디렉토리 | 애플리케이션 |
|------|-------------|-------------|
| App Pool 지정 | 불가 (상위 상속) | **가능 (전용 Pool 지정)** |
| 프로세스 격리 | 상위와 동일 | 독립 프로세스 가능 |
| 장애 격리 | ❌ 불가 | ✅ 가능 |
| 설정 독립성 | 제한적 | 독립적 |

> 애플리케이션으로 변환하는 **가장 큰 이유**가 바로 전용 App Pool 지정을 통한 **장애 격리**

---

## 6. 가상디렉토리 ↔ 애플리케이션 전환 방법

### 애플리케이션 → 가상디렉토리로 되돌리기
```
IIS 관리자 → Default Web Site → IISRECEIVER
→ 우클릭 → "애플리케이션 제거"
   (실제 파일 D:\Test\CIS_ECG_ACCEPT 는 삭제되지 않음)
→ 다시 우클릭 → "가상 디렉터리로 변환"
```

### App Pool만 변경 (애플리케이션 상태 유지)
```
IIS 관리자 → IISRECEIVER
→ 우클릭 → 기본 설정
→ 응용 프로그램 풀 → "선택" 버튼
→ 원하는 Pool 선택 → 확인
```

---

## 7. 권장 App Pool 설정값 (ISAPI DLL 기준)

```
이름              : Pool_CIS260629  (가상디렉토리별 전용)
.NET CLR 버전     : 관리 코드 없음
관리되는 파이프라인: 클래식          ← ISAPI DLL은 클래식 필수
32비트 사용       : True            ← DLL이 32bit인 경우
ID               : ApplicationPoolIdentity  ← SID 불일치 방지
```

---

## 8. 전체 조치 순서 요약

```
① 각 가상디렉토리를 애플리케이션으로 변환
        ↓
② 전용 App Pool 생성 (파이프라인: 클래식, 32bit: True)
        ↓
③ App Pool ID → ApplicationPoolIdentity 변경
        ↓
④ 각 애플리케이션에 전용 Pool 지정
        ↓
⑤ iisreset 후 전체 테스트
        ↓
⑥ 이벤트 뷰어에서 이벤트 10010 재발 여부 확인
```

---

## 9. 핵심 원칙

> **ISAPI DLL처럼 C/C++ 네이티브 코드는 프로세스 전체를 죽일 수 있기 때문에  
> 반드시 전용 App Pool 분리 운영이 원칙이다.**

| 확인 항목 | 정상 상태 | 문제 상태 |
|-----------|-----------|-----------|
| App Pool 분리 | 각 가상디렉토리 전용 Pool | 동일 Pool 공유 |
| App Pool ID | ApplicationPoolIdentity | idcadm (SID 불일치) |
| 파이프라인 모드 | 클래식 (ISAPI용) | 통합 모드 |
| 32bit 설정 | DLL 비트와 일치 | 불일치 |
| w3wp.exe SID | Pool ID와 일치 | 불일치 (이벤트 10010) |
