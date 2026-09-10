---
{"dg-publish":true,"dg-permalink":"kumc-cis-ha-active-active-scope","permalink":"/kumc-cis-ha-active-active-scope/","title":"고대병원 CIS 이중화 Active/Active 적용 범위 (팀리뷰 반영)","tags":["고대이중화","ActiveActive","CISInBroker","CISOutBroker","CISReceiver","CISMuseTransfer","InterfaceBroker","VitalSite","VIP","L4","지원범위"],"dg-note-properties":{"aliases":["고대 CIS Active-Active 적용 범위","고대 이중화 팀리뷰 반영본"],"date":"2026-08-24","tags":["고대이중화","ActiveActive","CISInBroker","CISOutBroker","CISReceiver","CISMuseTransfer","InterfaceBroker","VitalSite","VIP","L4","지원범위"],"title":"고대병원 CIS 이중화 Active/Active 적용 범위 (팀리뷰 반영)"}}
---

> [[CIS 2.0/CIS 분석\|← 상위 노트: CIS 분석]] · [[CIS 2.0/고대병원 CIS 이중화 지원 범위와 CISIn-OutBroker Active-Standby 적용 제안\|이전 제안 (Active/Standby 기준)]]

# 고대병원 CIS 이중화 Active/Active 적용 범위 (팀리뷰 반영)

> [!summary] 최종 입장
> - CIS 이중화는 **CISInBroker · CISOutBroker에 Active/Active로 적용**한다.
> - `CISReceiver` · `CISMuseTransfer` · `InterfaceBroker` · `VitalSite`는 **장비 연동 Application**으로 업무를 노드별로 나눌 기준이 없어 Active/Active가 성립하지 않는다. **2차 과제로도 제시하지 않는다.**
> - `CISDBServer` · `CISStorageServer`는 VIP가 DB·Storage를 한 조로 전환하지 않으므로 **서버 환경 설계 영역**으로 분리한다.

관련 산출물 — `고대의료원_CIS_이중화_ActiveActive_적용범위_제안.pptx` (24장) / `고대 CIS 이중화 Active-Active 적용 범위 검토 근거.md` / `고대_CIS_이중화_컨텍스트_핸드오프.json`
저장 위치 — `D:\Proj\고대_CIS_이중화_지원_범위_제안\`

---

## 1. 팀 리뷰 반영 사항 (1차본 대비)

| # | 지적 | 반영 |
| --- | --- | --- |
| 1 | 병원 전달 시 **Active/Active**로 작성 | 전체 용어 통일. "양 노드가 모두 처리 + DB가 작업을 행 단위로 배정" 구조로 서술 |
| 2 | In/OutBroker만 가능한 **이유** 명시 | "Active/Active 성립 3조건"을 판정 기준으로 세움 |
| 3 | Receiver·MuseTransfer·InterfaceBroker는 **장비 연동 App이라 불가**를 명제로 | 공통 명제 1장 + App별 다이어그램 전개 |
| 4 | 2차 진행 삭제, **불가 논리로 전환** | "2차 과제" 슬라이드·문단 전면 삭제 |
| 5 | In/OutBroker **다이어그램** | 슬라이드 7·8 (동작 구조), 9 (중복 차단 원리) |
| 6 | 그 외 App **불가 다이어그램** | 슬라이드 14·15·16·17·18·19 |
| 7 | VitalSite **Server/Client 모드** 첨언 | 슬라이드 16 |
| 8 | 파일 기반 App은 VIP/L4로 불가 + 원자적 처리·중복 이슈 | 슬라이드 15·17·18·21 |
| 9 | 결론은 **In/OutBroker만 적용** | 슬라이드 2(결론 선행) · 23(결론) |

---

## 2. Active/Active의 기술적 실체

**대외(병원) 표현** — 두 서버가 모두 가동되어 동시에 업무를 처리하는 구성. 같은 건을 두 번 처리하지 않도록 CIS DB가 작업을 노드별로 나눠 배정하고, 한 노드 장애 시 남은 노드가 미완료 작업을 이어받는다.

**내부 정의**

| 계층 | 동작 | Active 수 |
| --- | --- | --- |
| 업무 처리(Worker) | 배정된 작업 실행 | **전 노드 = Active/Active** |
| 작업 수집·분배(Commander) | 신규 업무 수집 후 노드별 배정 | 노드 1개 (역할 단일) |
| 상태 감시(AliveChecker) | Heartbeat·사망 판정·승계 | 전 노드 |

소유권 단위는 참조 구조의 `T_BROKERWORKERJOB.BWJ_COMMANDERKEY` **행 단위**.

> [!caution] 대외 설명 시
> "대기 / Standby"라는 단어를 쓰지 않는다. 처리 계층이 Active/Active임을 먼저 말하고, 수집 역할 단일화는 "중복을 막기 위한 배정 절차"로 설명한다. 질문이 나오면 사실대로 설명한다.

### 2.1 Active/Active 성립 3조건 (판정 기준)

1. 업무의 원천이 **공용 DB**에 있을 것
2. 작업마다 **담당 노드를 지정**할 수 있을 것
3. **처리 상태가 DB에 남을** 것

> [!note] 공통 명제
> 적용 대상이 아닌 App은 모두 **장비 연동 Application**이다. 업무의 원천이 공용 DB의 목록이 아니라 **장비가 만든 파일**과 **장비가 맺는 연결**에 있으므로 나눌 기준이 없다.

---

## 3. 추가 검토 항목 코드 검증 결과

### 3.1 [검증됨] CISReceiver는 CIS 서버 Application을 경유한다

`CISReceiver\CISMatchingThread.h:43-59` — `SprintClient m_DB` / `CISStorageClient m_ST`, 별도 `CIS_SERVERINFO`·Gripper·재접속 카운터. Oracle 직접 접속도 UNC 직접 쓰기도 아니며 CISLib IOCP2 프로토콜로 각 서버 App에 접속한다.
포트: License 4001 / DBServer 4002 / StorageServer 4003 / Sprint 4007 / StorageServerSDS 5001.

### 3.2 [검증됨] VIP를 써도 DB·Storage가 그룹으로 전환되지 않는다

- `CISMatchingThread.cpp:403-404`, `:411-412` — `GetServerByName`을 DB/Storage **각각 독립 호출**
- `:419-426`, `:439-444`, `:453-457` — 단일 대상 1회 접속·재접속, 백오프·대체 서버 없음
- `:489-503` — `CheckServerStatus()`는 둘 다 필요, 한쪽만 죽어도 로컬 모드
- **CISNEIS**: `NEISDBHelper.cpp:3060/3082`, `NEISSTHelper.cpp:1194/1214` — DB와 Storage가 **각자 1차→DR 전환을 독립 수행**. 두 판단을 묶는 코드 없음
- `ServerGroup` / `Affinity` / `PairServer` / `SiteID` 개념 전무 (grep 무결과)

⇒ **DB=1호기 / Storage=2호기 조합이 실제로 발생 가능**하며, 재접속 시점에 따라 조합이 시간이 지나며 어긋날 수 있다.

### 3.3 [보강] 조합이 어긋나면 무엇이 깨지는가

- 볼륨 테이블이 **OP/DR 두 벌 경로**를 갖고 `m_bDRVolume`로 선택 (`CISStorageInfoFile_CRUZ.h:26-41`, `:468-490`) → **같은 VolumeID가 노드별로 다른 물리 경로로 해석**
- Active 볼륨은 `ActiveCheckThread.cpp:58-79` — **1시간 주기** 갱신 → 노드 간 최대 1시간 시차
- 볼륨 사용량이 DB가 아니라 **볼륨 루트 INI 파일**에 락 없이 기록 (`CISStorageInfoFile_CRUZ.cpp:538-563`)

### 3.4 [검증됨] VitalSite는 채널별 Server/Client 모드 혼재

`Acquisition.cpp:155` `Listen()` / `:683` `Connect()`, 모드 분기 `:593-595`, `:625`, `:710`, `:732`. 설정 키 `[NETWORK] MODE / IP / PORT`.

- **Server 모드 채널** — 한 노드만 Listen 가능 → 장비 측 IP 변경 또는 VIP 필요, 채널 수만큼 장비 벤더 조율
- **Client 모드 채널** — CIS가 **나가는 방향**이라 인바운드 VIP 적용 대상 자체가 아님
- 니혼코덴 NBP 중복 억제 맵이 프로세스 로컬 `CMap` (`RegisterDlg.cpp:774-806`) → 동일 측정값 EMR 2회 등록 가능

### 3.5 [검증됨] CISMuseTransfer — 네트워크 공유 폴더 감시 + Receiver 연동

`WorkerThread.cpp:27-44` 폴링(회당 10건, 기본 1초), `:97` `MoveFile`, `:109-119` 로컬 `ErrorBackup\`, `:168`/`:188` `ConnectNetDrive`(UNC 지원).
**처리 완료 표시 = MoveFile 성공 그 자체.** 목적지 ↔ CISReceiver 폴링 경로 연결은 설정 의존(코드상 직접 근거 없음).

### 3.6 [검증됨] InterfaceBroker — 파일 폴링 + DB 폴링 혼재

`IFManager.cpp:58-88` — `CreatePollingClass`가 `Polling_DB`(CIFPollingDB) / `Polling_HL7`(CIFPollingFile) / `Polling_CISInterface`(CIFPollingFile) 3분기.
`:243-263`, `:380-381` — XML `<Polling Type="n">` 별 인스턴스를 `m_POLLINGs`에 누적 → **검사 종류별로 서로 다른 방식이 한 프로세스에서 동시 구동**.

- 파일 폴링: `IFPollingFile.cpp:44-51` `GetDirFiles` + 하위폴더 재귀, `:63` `CFile::modeWrite` 배타 열기가 유일한 검사, `:70-75` `MoveFile` → **EXE 상대 로컬 `Receiving\`**
- DB 폴링: `IFPollingDB.cpp:48/77` 회당 10건, `FOR UPDATE` 없음·선점 UPDATE 없음, `:202-237` 중복 제거는 **프로세스 힙 직전 1회분만** 비교

⇒ DB 방식만 고쳐도 파일 방식은 그대로 남는다. **두 종류의 선점 구조를 한 프로세스에서 동시에** 성립시켜야 해 난이도 최상.

---

## 4. App별 판정 요약

| Application | 업무의 원천 | 조건1 | 조건2 | 조건3 | 판정 |
| --- | --- | --- | --- | --- | --- |
| `CISInBroker` | EMR REST → CIS DB 작업 테이블 | ○(구현 후) | ○ | ○ | **적용** |
| `CISOutBroker` | CIS DB 작업 테이블 | ○ | ○(선점 추가) | ○ | **적용** |
| `CISReceiver` | 장비 파일 · 수신 포트 | ✕ | ✕ | ✕ | 불가 |
| `CISMuseTransfer` | 네트워크 공유 폴더 XML | ✕ | ✕ | ✕ | 불가 |
| `InterfaceBroker` | CIS DB + 장비 파일 폴더(혼재) | △ | ✕ | △ | 불가 |
| `VitalSite` | 환자 모니터 연결(Server/Client 혼재) | ✕ | ✕ | ✕ | 불가 |
| `CISDBServer`·`CISStorageServer` | 클라이언트 접속 | — | — | — | 인프라 영역 |

### 4.1 무리한 적용 시 발생하는 것

| 증상 | 발생 경로 |
| --- | --- |
| 동일 검사 2건 등록 · 스토리지 중복 파일 | CISReceiver 파일 선점 부재 |
| 결과 중복 전송 | InterfaceBroker DB 선점 부재, CISOutBroker 조회-전송-마킹 창 |
| 정상 파일의 오류 격리 | CISMuseTransfer 이동 경쟁 후 실패 판정 |
| 동일 측정값 2회 등록 | VitalSite 중복 억제 맵이 프로세스 로컬 |
| 상태 이상 (정상 건이 실패로 기록) | 두 노드의 상태 갱신 상호 덮어쓰기, `TRYCOUNT` 조기 소진 |
| 영상 조회 누락 | 노드별 볼륨 경로 해석 불일치 |
| 장애 추적 곤란 | 처리·오류 이력이 노드별 로컬 폴더로 분산 |

---

## 5. 선결 조건 · 검증

- [ ] CIS DB: Broker 상태·작업 테이블 및 패키지 반영 (병원 DBA)
- [ ] 1호기에 CISInBroker·CISOutBroker 설치, `Config.xml` 동기화 (SearchDay / Hospital / APIKey)
- [ ] 양 호기 NTP 동기화, 만료 판정 기준을 **DB 시간**으로 통일
- [ ] EMR: 동일 요청 재수신 처리 기준 또는 처리결과 조회 수단 확인
- [ ] EMR API Gateway 허용 IP에 1호기 추가
- [ ] 노드별 Broker GUID 분리 / 전환 판정 기준 시간 합의
- [ ] 완료 작업 보관·정리 정책, `sqllog` INSERT 제거 여부
- [ ] 기존 단일 운영 구성으로의 롤백 절차

**장애 시험 12종** — 프로세스 강제 종료 · 서버 전원 차단 · DB 연결 단절 · 네트워크 분할 · EMR 전송 직후 종료 · 양 호기 동시 재기동 · 복구 후 재합류 · 미완료 작업 인계 · 중복 처리 여부 · 이중 배정 여부 · 전환 지연 측정 · 롤백
**합격 기준** — 이중 배정 0 / 중복 반영 0 / 작업 유실 0

### 5.1 참조 구조에서 보완할 항목

1. 만료 판정을 클라이언트 시각이 아닌 **DB 시간** 기준으로 통일
2. Fencing 부재 — Worker 루프 진입 시 자기 소유권 재확인 추가
3. `Death` → `Standby` 자동 복귀 없음
4. 정상 종료 시 `RmvCommander` 미호출
5. 전환 지연 상수 재산정 (원본 120s/600s → 최선 10분·최악 20분)
6. `GetCommander` 호출마다 `insert into sqllog` (1초 주기 시 노드당 일 17만 건)
7. RetryManager 메모리 `CList` → DB 테이블화 (고대 InBroker는 미빌드 상태)
8. SP 시그니처 불일치 — 고대 `GetOutboundList` 4파라미터 vs 참조 3파라미터

---

## 6. 고객 협의용 문구

> 이번 CIS 이중화는 두 서버를 모두 가동해 동시에 업무를 처리하는 **Active/Active** 구성으로, **CISInBroker와 CISOutBroker**에 적용합니다. 두 App은 처리할 업무와 처리 상태가 모두 CIS DB에 기록되므로, DB가 작업을 노드별로 나눠 배정해 같은 건이 두 번 처리되지 않도록 보장할 수 있습니다.
>
> 반면 `CISReceiver`, `CISMuseTransfer`, `InterfaceBroker`, `VitalSite`는 검사 장비·환자 모니터와 연동되는 Application으로, 업무의 원천이 공용 DB가 아니라 장비가 만든 파일과 장비가 맺는 연결에 있습니다. 나눌 기준이 없어 두 서버를 함께 가동하면 같은 대상을 각자 처리하게 되며, 이는 VIP나 L4로 해결되는 문제가 아닙니다. 형식만 이중화를 적용할 경우 장애가 없는 평상시에 동일 검사 중복 등록, 결과 중복 전송, 정상 건의 실패 기록 같은 데이터 문제가 발생합니다.
>
> `CISDBServer`와 `CISStorageServer`는 CIS Application이 DB 서버와 Storage 서버에 각각 별도의 연결을 맺고 각 연결이 독립적으로 대상을 선택하기 때문에, VIP를 적용하더라도 두 연결이 한 조로 함께 전환되지 않습니다. 이 부분은 공유 스토리지 구성과 접속 전환 기준을 포함한 서버 환경 설계 영역으로 별도 협의를 제안드립니다.

---

## 7. 미확인 항목

1. Oracle 패키지 본문 (`PkgOrder`, `PkgInterface`, `PkgExtraDataInterface`, `PKGVOLUME`, `PkgLicense`) — 내부 락·유니크 제약 유무가 위험도 판정을 바꿀 수 있음
2. 고대 운영 설정 실물 — `ServerConfig.xml`(`m_bDRVolume`, Redirection), `ReceiverSetting.xml`, `Receiver\*.xml`, VitalSite `conf\Set\*.ini`(채널별 MODE/PORT), InterfaceBroker 인터페이스별 `<Polling Type>`
3. 실제 스토리지 볼륨이 로컬 디스크인지 공유 스토리지인지
4. `CISGF::GetHostIP()`의 다중 NIC/VIP 환경 반환값
5. EMR API Gateway의 Source IP 허용 정책
6. 참조 사이트 운영 중 이중 Active 발생 이력

## 8. 관련 노트

- [[고대 CIS 이중화 적용 범위 검토 근거\|1차 검토 근거 (Active/Standby 기준)]]
- [[CIS 2.0/고대병원 CISIn-OutBroker 이중화 적용 변경 가이드\|CISInBroker·CISOutBroker 이중화 적용 변경 가이드]]
- [[고대병원_브로커_이중화_적용_설계\|고대병원 Broker 이중화 적용 설계]]
- [[고대병원_브로커_이중화_파일별_변경지시서\|Broker 이중화 파일별 변경 지시서]]
- [[260803 고대 서버 이중화 관련 테이블 검색\|260803 고대 서버 이중화 관련 테이블 검색]]
