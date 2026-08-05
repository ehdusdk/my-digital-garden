---
{"dg-publish":true,"dg-permalink":"kumc_broker_duplex_analysis_content","permalink":"/kumc_broker_duplex_analysis_content/","dg-note-properties":{}}
---

# CISInBroker / CISOutBroker 이중화 분석 정리

작성일: 2026-08-03  
분석 범위:

- `D:\KUMC\ANAM\CIS_SI\고대병원\CISInBroker`
- `D:\KUMC\ANAM\CIS_SI\고대병원\CISOutBroker`
- `D:\CMC\서울성모\CIS_ETC\CISDualBroker`
- `D:\doc\CIS_1400\doc\Database\Patch`
- `D:\doc\CIS_1400\doc\Database\SetupScript`

## 1. 결론 요약

### 고대병원

현행 `CISInBroker`, `CISOutBroker` 소스에는 서울성모 `CISDualBroker`와 같은 Active/Standby 브로커 이중화 기능이 구현되어 있지 않다.

- `PKGBROKER` 호출, 브로커 등록, heartbeat, Active/Standby/Death 상태 관리, 장애 노드의 미완료 작업 재할당 코드가 없다.
- `CISOutBrokerHelper.cpp:537`의 `PKGBROKER.GetCommander`는 이중화 호출이 아니다. 실제로는 `PkgInterface.SetUpdOutboundFlag` 호출 실패 경로에서 출력하는 잘못된 오류 로그 문자열이다.
- 따라서 현재 고대병원 브로커는 일반 단일 Worker 구조이며, 폴더에 있는 `고대병원_브로커_이중화_적용_설계.md`와 `고대병원_브로커_이중화_파일별_변경지시서.md`는 현행 구현 설명이 아니라 서울성모 계열을 이식하기 위한 설계/변경안으로 판단된다.

### 서울성모

서울성모 `CISDualBroker`에는 DB를 coordination point로 사용하는 애플리케이션 레벨 이중화가 구현되어 있다. 핵심 DB 패키지는 `PKGBROKER`이다.

- 브로커 상태 테이블: `T_BROKERCOMMANDER`
- OutBroker 작업 큐: `T_BROKERWORKERJOB`
- InBroker 작업 큐: `T_INBROKERWORKERJOB`
- 시퀀스: `SQ_T_BROKERCOMMANDER`, `SQ_T_BROKERWORKERJOB`, `SQ_T_INBROKERWORKERJOB`
- 패키지: `PKGBROKER` specification/body

이 기능은 Oracle RAC/Data Guard 같은 DB 자체의 이중화가 아니라, 두 Broker 인스턴스가 동일한 CIS DB의 상태 및 작업 큐를 공유하는 방식이다.

## 2. 서울성모 DB 오브젝트와 패키지

원본 스크립트는 `D:\CMC\서울성모\CIS_ETC\CISDualBroker\doc\브로커 이중화 DB Script`에 있다.

### 테이블

| 오브젝트 | 역할 |
| --- | --- |
| `T_BROKERCOMMANDER` | Broker 인스턴스의 고유 ID, Broker 종류, 상태, heartbeat 시각, 종료 시각 관리 |
| `T_BROKERWORKERJOB` | OutBroker 작업, 담당 Broker의 `BC_KEY`, 처리 결과와 종료 시각 관리 |
| `T_INBROKERWORKERJOB` | InBroker 작업과 업무 파라미터, 담당 Broker, 처리 결과와 종료 시각 관리 |

`BC_STATE` 값은 소스에서 `Active`, `Standby`, `Death` 문자열로 변환된다.

### `PKGBROKER` 프로시저

| 구분 | 프로시저 | 역할 |
| --- | --- | --- |
| 노드 | `SetCommander` | 새 Broker를 Standby 상태로 등록 |
| 노드 | `RmvCommander` | Broker 논리 종료 처리 |
| 노드 | `UpdCommander` | Active/Standby/Death 상태와 heartbeat 갱신 |
| 노드 | `UpdCommanderAlive` | 자기 노드 heartbeat(`BC_ALIVEDT`) 갱신 |
| 노드 | `GetCommander` | Broker 종류/고유 ID 조건으로 노드 목록 또는 자기 노드 조회 |
| Out | `Outbroker_AddJob` | OutBroker 작업 생성 및 담당 `BC_KEY` 배정 |
| Out | `Outbroker_GetJob` | 자기 `BC_KEY`에 배정된 미완료 작업 조회 |
| Out | `Outbroker_GetJobCount` | 장애 노드의 미완료 작업 수 확인 |
| Out | `Outbroker_ChangeJobWorker` | 장애 노드 작업의 담당 `BC_KEY`를 생존 노드로 변경 |
| Out | `Outbroker_UpdJobResult` | 처리 결과/종료 시각 기록 |
| In | `Inbroker_AddJob` | InBroker 작업 생성 및 담당 `BC_KEY` 배정 |
| In | `Inbroker_GetJob` | 자기 `BC_KEY`에 배정된 미완료 작업 조회 |
| In | `Inbroker_GetJobCount` | 장애 노드의 미완료 작업 수 확인 |
| In | `Inbroker_ChangeJobWorker` | 장애 노드 작업을 생존 노드로 재할당 |
| In | `Inbroker_UpdJobResult` | 처리 결과/종료 시각 기록 |

## 3. 공통 이중화 workflow

1. 프로그램 시작 시 `CISBrokerFactory::RegisterBroker()`가 `ModuleConfig.ini`의 고유 `Name`(GUID), 실행 경로, IP를 확인한다.
2. 신규 인스턴스이면 `PKGBROKER.SetCommander`로 `Standby` 등록하고, 기존 인스턴스이면 `PKGBROKER.GetCommander`로 기존 `BC_KEY`와 상태를 복원한다.
3. Factory가 `AliveChecker`, `JobCommander`, `JobWorker` 세 스레드를 생성한다.
4. `AliveChecker`는 Release 기준 2초마다 `UpdCommanderAlive`로 자기 heartbeat를 갱신하고, 20초마다 같은 종류의 전체 Broker 상태를 확인한다(Debug는 확인 주기 10초).
5. 상대 노드의 마지막 heartbeat가 임계값을 초과하면 `UpdCommander`로 `Death` 처리한다.
6. 죽은 노드가 Active였으면 Standby 중 하나를 Active로 올린다.
7. 새 Active의 `JobCommander`가 `GetJobCount`로 죽은 노드의 미완료 작업을 확인하고 `ChangeJobWorker`로 담당 `BC_KEY`를 새 노드에 넘긴다.
8. `JobWorker`는 Active/Standby 여부와 무관하게 자기 `BC_KEY`로 배정된 작업을 처리한다. 단, 신규 작업을 수집·분배하는 Commander 동작은 Active만 수행한다.
9. 장애 노드가 재시작되면 기존 GUID로 자신의 `Death` 상태를 읽고 Standby로 복귀하며, 현재 Active를 자동으로 빼앗지 않는다.

## 4. InBroker workflow

1. Active `CISInBrokerJobCommander`가 EMR/RADYN 데이터의 신규 마스터·환자·사용자·처방을 조회한다.
2. 마스터성 데이터는 CIS DB에 직접 반영하고, 처방성 작업은 `PKGBROKER.Inbroker_AddJob`으로 `T_INBROKERWORKERJOB`에 등록한다.
3. 배정 대상은 정상 상태의 Active 또는 Standby Worker이다.
4. 각 노드의 `CISInBrokerJobWorker`가 `Inbroker_GetJob`으로 자기 `BC_KEY` 작업을 가져온다.
5. `PkgOrder.SetOrder` 등 기존 CIS 업무 패키지를 호출하여 업무 데이터를 반영한다.
6. `Inbroker_UpdJobResult`로 성공/실패와 종료 시각을 기록하고 EMR 측 결과 상태도 갱신한다.
7. 담당 노드 장애 시 새 Active가 `Inbroker_ChangeJobWorker`로 미완료 작업을 인수한다.

## 5. OutBroker workflow

1. Active `CISOutBrokerJobCommander`만 `PkgInterface.GetOutboundList`로 미처리 Outbound를 조회한다.
2. 상세 데이터에서 OrderKey와 ActionType을 해석한다.
3. `PKGBROKER.Outbroker_AddJob`으로 `T_BROKERWORKERJOB`에 작업을 만들고 정상 Worker에 배정한다.
4. 각 노드의 `CISOutBrokerJobWorker`가 `Outbroker_GetJob`으로 자기 작업을 가져온다.
5. CIS의 Order/Exam/Instance 정보를 조회하고 서울성모 전용 Patcher가 EMR/CMC DB 반영을 수행한다.
6. `Outbroker_UpdJobResult`로 처리 결과를 기록한다.
7. 담당 노드 장애 시 새 Active가 `Outbroker_ChangeJobWorker`로 미완료 작업을 인수한다.

## 6. 표준 CIS 1400 DB 스크립트와의 관계

`D:\doc\CIS_1400\doc\Database\SetupScript`와 `Patch` 전체에서 다음 이름을 검색했으나 발견되지 않았다.

- `PKGBROKER`
- `T_BROKERCOMMANDER`
- `T_BROKERWORKERJOB`
- `T_INBROKERWORKERJOB`

즉, Broker 이중화 DB 오브젝트는 CIS 1400 표준 Setup/Patch에 포함된 공통 기능이 아니라 서울성모 `CISDualBroker`에 동봉된 사이트별 확장 스크립트이다. 신규 사이트에 적용하려면 표준 DB 설치 후 별도로 테이블 → 시퀀스/인덱스 → package spec → package body 순으로 배포해야 한다.

반면 Broker가 실제 업무 데이터를 읽고 쓰는 `PkgInterface`, `PkgOrder`, `PkgExam`, `PkgInstance`, `PkgPatient`, `PkgMaster`, `PkgUser` 등은 CIS 표준 패키지이다. 따라서 `PKGBROKER`만 복사해서는 충분하지 않고, 대상 병원의 표준 패키지 signature가 서울성모 코드의 호출 인자와 호환되는지도 확인해야 한다.

## 7. 운영·설계상 주의점

- `ModuleConfig.ini`의 `Name`은 노드마다 반드시 달라야 한다. 설치 폴더를 통째로 복제해 GUID까지 같아지면 두 프로세스가 같은 Broker로 인식될 수 있다.
- DB가 coordination point이므로 CIS DB 장애 시 두 Broker 모두 상태 판정과 작업 처리에 영향을 받는다. Broker 이중화가 DB 장애까지 해결하지는 않는다.
- 상태 승격 로직은 애플리케이션의 주기적 조회/UPDATE 방식이다. 패키지에서 명시적 행 잠금이나 단일 원자적 leader-election을 수행하는 구조가 보이지 않아, DB 지연·네트워크 분할 상황의 동시 Active 가능성은 운영 시험이 필요하다.
- 작업 테이블은 완료 후 삭제가 아니라 결과/종료 시각을 남기는 구조이므로 보관 기간과 정리 배치가 필요하다.
- OutBroker 원본 Outbound flag를 작업 등록 시점에 완료로 바꾸는 구현은 실제 외부 반영 성공과 시점이 다를 수 있다. 재처리 정책은 `BWJ_RESULT` 기준인지 원본 HandleFlag 기준인지 명확히 해야 한다.
- `PKGBROKER.GetCommander`는 동적 SQL 문자열 결합을 사용하므로 입력값이 내부 GUID/고정 Broker type으로 제한되는지 유지해야 한다.

## 8. 고대병원 적용 판단

고대병원에 이중화를 적용하려면 단순 설정 변경이 아니라 다음 항목이 필요하다.

1. 서울성모의 `CISDualBrokerLib` 계열 공통 제어부 이식 또는 동등 기능 신규 구현
2. 고대병원 REST API 기반 In/Out 처리부를 `CISBrokerJobPatcher` 확장점으로 연결
3. `PKGBROKER` 및 3개 작업/상태 테이블 별도 배포
4. 고대병원 운영 DB의 표준 CIS package signature 검증
5. 노드별 GUID, 실행 경로, IP 설정 분리
6. 정상/장애/재기동/DB 지연/중복 Active/미완료 작업 인수 테스트

따라서 현 상태를 "이중화 기능 존재"로 분류하면 안 되며, "서울성모 소스를 참고한 이중화 적용 설계가 존재하지만 고대병원 현행 Broker에는 미구현"으로 정리하는 것이 정확하다.

## 9. ERD PDF 확인 상태

이번 로컬 작업공간과 지정 경로에서는 사용자가 언급한 CIS 2.0 ERD PDF를 식별하지 못했다. 따라서 위 결론은 소스와 SQL 스크립트를 기준으로 확정했으며, ERD PDF와의 엔터티/컬럼 교차검증은 파일이 다시 제공되면 추가할 수 있다.
