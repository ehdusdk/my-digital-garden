---
{"dg-publish":true,"dg-permalink":"kumc-cis-ha-support-scope-broker-active-standby","permalink":"/kumc-cis-ha-support-scope-broker-active-standby/","title":"고대병원 CIS 이중화 지원 범위와 CISIn-OutBroker Active-Standby 적용 제안","tags":["고대이중화","CISInBroker","CISOutBroker","ActiveStandby","DBLease","CISReceiver","지원범위"],"dg-note-properties":{"title":"고대병원 CIS 이중화 지원 범위와 CISIn-OutBroker Active-Standby 적용 제안","date":"2026-08-20","tags":["고대이중화","CISInBroker","CISOutBroker","ActiveStandby","DBLease","CISReceiver","지원범위"],"aliases":["고대 CIS Application 이중화 지원 범위","고대 Broker 이중화 범위 제안"]}}
---


> [[CIS 2.0/CIS 분석\|← 상위 노트: CIS 분석]]

# 고대병원 CIS 이중화 지원 범위와 CISIn-OutBroker Active/Standby 적용 제안

> [!summary] 최종 입장
> - 애플리케이션 수준 이중화 지원 대상은 **`CISInBroker`와 `CISOutBroker`로 한정**한다.
> - 서울성모 CMC Broker 이중화 구조를 참고하여 **DB Heartbeat/Lease 기반 Active/Standby**로 적용한다.
> - `CISReceiver`, `InterfaceBroker`, `CISDBServer`, `StorageServer` 및 기타 CIS 서버 Application은 이번 이중화 지원 범위에서 제외한다.
> - 제외 대상은 기술적으로 절대 불가능하다는 의미가 아니라, 현재 구조에서 안전한 이중화를 보장하려면 애플리케이션별 재설계와 통합 장애 시험이 필요한 **별도 개발 과제**라는 의미다.

## 1. 검토 배경

고대병원 CIS 서버 이중화의 목적은 서버 두 대에서 동일한 프로그램을 실행하는 데 있지 않다. 한쪽 서버 또는 프로세스에 장애가 발생해도 중복 처리와 데이터 유실 없이 업무를 계속 제공하는 것이 목적이다.

기존 검토에서는 VIP/L4, Windows Failover Cluster, DB Lease, `DBMS_LOCK`, SMB Exclusive Lock 등 여러 방식의 적용 가능성을 살펴보았다. 검토 결과, VIP/L4는 접속 대상을 분산하거나 전환할 수 있지만 어떤 애플리케이션이 Polling 업무를 소유할지는 결정하지 못한다. 따라서 서버 이중화와 애플리케이션의 업무 소유권 이중화는 별개의 문제다.

`CISReceiver`의 Polling Single Leader나 DB Lease 적용도 가능한 설계 방향 중 하나이지만, 현재 제품에 이미 준비된 설정 옵션은 아니다. Lease 상실 시 Polling 중단, 파일 선점, 중복 방지, 처리 중 장애 복구, DB·Storage 연결 동시 전환까지 함께 구현해야 하므로 간단한 기능 추가로 보기 어렵다.

이러한 조건을 고려하면 기존 적용 사례를 재사용할 수 있는 `CISInBroker`와 `CISOutBroker`만 우선 이중화하고, 나머지 CIS 서버 Application은 별도 과제로 분리하는 것이 구현 범위와 운영 위험을 가장 현실적으로 줄이는 방안이다.

---

## 2. 서술식 설명 문안

### 고대 CIS Application 이중화 지원 범위 제안

고대병원 CIS 서버 이중화는 단순히 서버 두 대에서 동일 프로그램을 실행하는 구성이 아니라, 한쪽 서버에 장애가 발생하더라도 중복 처리나 데이터 유실 없이 업무를 지속하기 위한 구성이어야 합니다.

그러나 현재 제공 중인 CIS 서버 Application은 대부분 단일 서버 운영을 전제로 설계되어 있습니다. 서버를 두 대 구성하고 VIP 또는 L4를 적용하는 것만으로는 애플리케이션 내부의 Polling, 작업 소유권, 처리 중 데이터, 파일 이동, 외부 시스템 전송 상태까지 이중화되지 않습니다.

특히 `CISReceiver`는 두 서버에 동일한 Polling 경로를 설정할 경우 양쪽 서버가 같은 파일을 동시에 조회할 수 있습니다. 이 경우 중복 처리, 파일 이동 경쟁, 처리 순서 변경 및 장애 시 재처리 문제가 발생할 수 있습니다. 또한 DB 연결과 Storage 연결이 각각 독립된 통신 세션으로 관리되기 때문에 VIP를 사용하더라도 DB와 Storage가 서로 다른 백엔드 서버에 연결되거나, 한쪽 연결의 재접속 과정에서 서버 조합이 달라질 가능성이 있습니다.

따라서 `CISReceiver`를 포함한 기존 CIS Application 전체에 이중화를 적용하려면 Active 소유권 획득과 상실, 파일 및 DB 작업의 원자적 선점, 중복 방지, 처리 중 장애 복구, DB·Storage 동시 전환, 설정·로그·작업 경로 동기화, 내부 Worker 상태 감시 및 Split-brain 차단 기능을 애플리케이션별로 설계해야 합니다. 이는 단순 설정 변경이 아니라 각 Application의 업무 처리 구조를 수정하고 검증하는 별도의 개발 과제에 해당합니다.

반면 `CISInBroker`와 `CISOutBroker`는 서울성모 CMC에서 사용한 Broker 이중화 구조를 참조할 수 있습니다. 기존 구조에는 Broker 상태와 Heartbeat를 관리하는 `T_BROKERCOMMANDER`, 작업을 DB에 보관하는 Worker Job 테이블, Active/Standby 전환과 장애 노드의 미완료 작업 재할당을 처리하는 `PKGBROKER`가 존재합니다.

고대병원에는 이 구조를 기반으로 두 서버의 Broker 프로세스를 실행하되, DB 소유권을 획득한 Broker만 신규 업무를 수집하는 Active/Standby 방식을 적용하는 것이 현실적입니다. Active의 Heartbeat가 만료되면 Standby가 소유권을 인수하고, DB에 남아 있는 미완료 작업을 이어서 처리하도록 구성합니다.

다만 서울성모 코드를 그대로 복사하는 방식은 적절하지 않습니다. 고대병원 InBroker와 OutBroker는 REST API 호출 구조와 업무 완료 시점이 다르므로, EMR 원본 키의 DB 보관, 실제 CIS 반영 후 결과 통보, REST API 성공 후 완료 상태 갱신, 장애 인수 시 중복 전송 방지 및 Active 승격의 원자성 등을 고대병원 환경에 맞게 보완해야 합니다.

따라서 이번 이중화 지원 범위는 **`CISInBroker`와 `CISOutBroker`의 애플리케이션 수준 Active/Standby 구성으로 한정**하는 것이 적절합니다. `CISReceiver`, `InterfaceBroker` 및 기타 CIS 서버 Application은 현재 구조상 단순 이식이나 설정 변경으로 안전성을 보장할 수 없으므로 이번 범위에서는 제외하고, 필요 시 별도의 요구사항·일정·시험 기준을 갖춘 과제로 검토하는 것을 제안합니다.

---

## 3. 항목 리스트식 설명 문안

### 3.1 최종 지원 범위

- 지원 대상
  - `CISInBroker`
  - `CISOutBroker`
- 적용 방식
  - Active/Standby
  - DB Heartbeat/Lease 기반 소유권 관리
  - 서울성모 CMC Broker 이중화 구조 참조
  - Active 장애 시 Standby 승격
  - 미완료 DB 작업 재할당 및 후속 처리
- 이번 범위에서 제외
  - `CISReceiver`
  - `InterfaceBroker`
  - `CISDBServer`
  - `StorageServer`
  - 그 밖의 CIS 서버 Application
  - DB·Storage·L4 자체의 인프라 이중화 구축

### 3.2 CISInBroker/CISOutBroker만 지원하는 이유

- 서울성모 CMC에 기존 Broker 이중화 구현 사례가 있다.
- Broker 상태와 Heartbeat 관리 구조를 참조할 수 있다.
- 신규 작업과 미완료 작업을 DB Queue에 영속화할 수 있다.
- 장애 Broker의 작업을 생존 노드로 재할당하는 구조가 있다.
- 신규 공통 HA 프레임워크를 처음부터 만드는 것보다 변경 범위가 명확하다.
- 장애 시험 범위를 InBroker와 OutBroker 업무로 제한할 수 있다.
- 전체 CIS Application을 동시에 변경하는 것보다 회귀 위험과 운영 영향을 줄일 수 있다.

### 3.3 Broker Active/Standby Workflow

1. 1호기와 2호기의 Broker가 DB에 자신을 등록한다.
2. `CISInBroker`와 `CISOutBroker` 각각 하나의 Active만 소유권을 획득한다.
3. Active만 신규 업무를 조회하고 작업을 생성한다.
4. Standby는 신규 업무를 수집하지 않고 자신의 Heartbeat와 Active 상태를 확인한다.
5. Active는 일정 주기로 Heartbeat를 갱신한다.
6. Active 장애 또는 Lease 만료 시 Standby가 DB에서 소유권을 인수한다.
7. 장애 노드의 미완료 작업을 새 Active 또는 생존 Worker에 재할당한다.
8. 복구된 기존 Active는 Standby로 복귀한다.
9. DB 트랜잭션과 조건부 갱신으로 동일 Broker 종류의 이중 Active를 차단한다.
10. Lease를 상실한 노드는 신규 업무 처리를 즉시 중단한다.

### 3.4 CISInBroker 적용 항목

- 사용자 및 처방 REST 조회는 Active에서만 수행한다.
- 조회 결과와 EMR 원본 키를 DB 작업 Queue에 저장한다.
- CIS DB 반영은 할당된 Worker가 수행한다.
- 작업 Queue 등록만으로 EMR에 최종 성공을 통보하지 않는다.
- CIS DB 실제 반영 성공 후 EMR에 처리 결과를 통보한다.
- CIS 반영 성공과 EMR 결과 통보 성공을 별도 상태로 관리한다.
- 권장 상태 예시
  - `QUEUED`
  - `CIS_PROCESSING`
  - `CIS_SUCCESS`
  - `EMR_NOTIFY_SUCCESS`
  - `EMR_NOTIFY_FAILED`
  - `FINAL_FAILED`

### 3.5 CISOutBroker 적용 항목

- Outbound 대상 조회는 Active에서만 수행한다.
- 조회 대상을 DB 작업 Queue에 등록한다.
- 실제 REST API 전송 성공 후 원본 Outbound 상태를 갱신한다.
- REST 성공 후 DB 상태 갱신 전 장애가 발생한 경우를 별도 상태로 관리한다.
- 장애 인수 시 무조건 재전송하지 않고 기존 처리 여부를 확인한다.
- EMR 거래번호 또는 업무 Key를 중복 방지 기준으로 사용한다.
- EMR API가 동일 요청을 안전하게 재처리할 수 있는지 확인한다.

### 3.6 CISReceiver 지원이 어려운 이유

- 두 서버가 동일 Polling 경로를 동시에 조회할 수 있다.
- 동일 파일의 중복 처리와 파일 이동 경쟁이 발생할 수 있다.
- 처리 중 장애 시 파일과 DB의 완료 상태가 달라질 수 있다.
- DB와 Storage가 서로 다른 TCP 세션으로 연결된다.
- DB와 Storage가 서로 다른 백엔드 노드에 연결될 수 있다.
- 한쪽 연결만 장애가 발생하면 해당 연결만 독립적으로 재접속한다.
- 파일·DB·Storage 작업을 하나의 트랜잭션으로 묶을 수 없다.
- 현재 코드에 서버 간 공유 작업 소유권과 Fencing 기능이 없다.
- DB Lease를 추가하더라도 파일 선점·중복 차단·복구 기능을 별도로 개발해야 한다.

### 3.7 InterfaceBroker 및 기타 CIS Application 지원이 어려운 이유

- 서버 간 작업 선점 기능이 없다.
- 두 서버가 동일한 미처리 DB 데이터를 조회할 수 있다.
- 로컬 메모리 기반 중복 제거는 서버 간 중복을 막지 못한다.
- EMR API 성공과 CIS DB 상태 갱신을 하나의 트랜잭션으로 묶을 수 없다.
- 외부 API 성공 직후 장애가 나면 Standby가 동일 작업을 재호출할 수 있다.
- Application별 시작·중지·복구 방식이 서로 다르다.
- 프로세스 존재 여부만으로 내부 Worker의 정상 상태를 판단할 수 없다.
- 안전한 지원을 위해 Application별 재설계와 장애 시험이 필요하다.

### 3.8 VIP/L4만으로 해결되지 않는 이유

- VIP/L4는 네트워크 접속 대상을 선택하는 기능이다.
- Polling Application은 외부 요청을 기다리지 않고 DB나 폴더를 스스로 조회한다.
- L4는 어느 Application이 Polling 업무를 소유할지 결정하지 못한다.
- 기존 TCP 세션의 유지와 애플리케이션의 업무 소유권은 서로 다른 문제다.
- VIP가 있어도 두 Application이 동일 작업을 동시에 수행할 수 있다.
- 따라서 애플리케이션 내부 또는 공통 DB에 단일 Active 소유권 관리가 필요하다.

### 3.9 Broker 이중화 선결 조건

- 고대 운영 DB의 관련 Package Spec/Body를 확보한다.
- 서울성모 `PKGBROKER`와 고대 DB 환경의 호환성을 확인한다.
- Broker 종류별 Active 단일성을 DB에서 보장한다.
- Heartbeat와 만료 판단에는 DB 서버 시간을 사용한다.
- Lease 상실 시 신규 업무를 즉시 중단한다.
- 고대 REST API의 호출 시점과 완료 기준을 확정한다.
- EMR API의 멱등성 또는 결과 조회 지원 여부를 확인한다.
- 노드별 Broker GUID와 설정을 분리한다.
- 완료 작업 보관 기간과 정리 정책을 마련한다.

### 3.10 필수 장애 시험

- Active 프로세스 강제 종료
- Active 서버 종료
- Active의 DB 연결 단절
- 서버 간 네트워크 분할
- REST API 성공 직후 프로세스 종료
- 두 서버 동시 재기동
- 기존 Active 복구 후 Standby 복귀
- 장애 노드 미완료 작업 재할당
- 동일 업무 중복 호출 여부
- 동일 Broker 종류의 이중 Active 발생 여부
- 기존 단일 Broker 구성으로 롤백

---

## 4. 지원 범위 매트릭스

| 구분 | 이번 제안 | 판단 근거 |
| --- | --- | --- |
| `CISInBroker` | 지원 | 서울성모 DB coordination/작업 Queue 구조를 고대 REST Workflow에 맞게 이식 가능 |
| `CISOutBroker` | 지원 | 기존 Broker 이중화 구조와 작업 재할당 방식을 참조 가능 |
| `CISReceiver` | 제외·별도 과제 | 동일 경로 Polling, 파일 선점, DB·Storage 연결 조합, 처리 중 복구 문제 |
| `InterfaceBroker` | 제외·별도 과제 | DB 작업 선점 부재와 EMR API/DB 결과 갱신 사이의 중복 위험 |
| `CISDBServer`·`StorageServer` | 제외·인프라 별도 협의 | 제품 Application 이중화와 DB·Storage 인프라 HA는 별도 영역 |
| VIP/L4 | 병원 인프라 범위 | 접속 경로 전환은 가능하지만 Polling 및 업무 소유권은 제어하지 못함 |

---

## 5. 고객·내부 협의용 최종 문구

> 이번 이중화는 CIS 서버의 모든 Application을 두 서버에서 동시에 실행하는 구성이 아닙니다. 기존 서울성모 적용 사례를 활용할 수 있는 `CISInBroker`와 `CISOutBroker`에 한하여 DB 기반 Active/Standby 기능을 적용하는 범위입니다.
>
> `CISReceiver`와 기타 CIS Application은 단일 서버 운영을 전제로 한 로컬 상태, 파일 처리, DB·Storage 연결 및 외부 시스템 연계 구조를 가지고 있어 설정 변경만으로 안전한 이중화를 보장할 수 없습니다.
>
> 전체 Application 이중화를 지원하려면 Application별 작업 선점, 중복 방지, 장애 복구, 데이터 정합성 및 인프라 연계에 대한 별도 개발과 통합 장애 시험이 필요합니다. 따라서 이번 프로젝트 범위에는 포함하지 않고 별도 과제로 분리하는 것이 타당합니다.

### 한 문단 요약

고대병원 CIS 이중화는 서울성모 CMC 적용 사례를 기반으로 `CISInBroker`와 `CISOutBroker`만 DB Heartbeat/Lease 방식의 Active/Standby로 구성한다. `CISReceiver` 및 기타 CIS 서버 Application은 VIP나 단순 프로세스 이중 실행만으로 업무 단일성과 데이터 정합성을 보장할 수 없으며, Application별 구조 변경과 장애 복구 설계가 필요하므로 이번 범위에서 제외하고 별도 개발 과제로 분리한다.

---

## 6. 관련 노트

- [[CIS 2.0/고대병원 CISIn-OutBroker 이중화 적용 변경 가이드\|고대병원 CISInBroker·CISOutBroker 이중화 적용 변경 가이드]]
- [[CIS_Broker_이중화_분석_정리\|CISInBroker / CISOutBroker 이중화 분석 정리]]
- [[고대병원_브로커_이중화_적용_설계\|고대병원 CISInBroker / CISOutBroker 이중화 적용 설계]]
- [[고대병원_브로커_이중화_파일별_변경지시서\|고대병원 Broker 이중화 파일별 변경 지시서]]
- [[회의록/260805-김도연-Smart Endo, 고대이중화, 건국대 스토리지 교체, CISIn_Outbroker 이중화 이슈회의\|2026-08-05 고대 이중화 이슈 회의]]
- [[회의록/260810-HIE팀회의\|2026-08-10 HIE팀 회의]]

## 7. 코드 검토 근거

- `D:\Proj\CIS_1400\trunk\Source\CISReceiver\CISMatchingThread.cpp`
  - DB와 Storage 연결 및 재연결이 독립적으로 처리되는 경로
- `D:\Proj\CIS_ETC\InterfaceBroker\Source\CustomInterface\IFPollingDB.cpp`
  - InterfaceBroker의 DB Polling과 프로세스 로컬 중복 제거 경로
- `D:\Proj\CIS_ETC\CIS_OUT_Broker\branch\CIS2000_OutBroker_CMC_이중화\trunk\Source\CISBrokerModule\CISBrokerAliveChecker.cpp`
  - Broker 상태·Heartbeat·Active/Standby 전환 로직
- `D:\Proj\CIS_ETC\CIS_OUT_Broker\branch\CIS2000_OutBroker_CMC_이중화\doc\브로커 이중화 DB Script\packagebody.pkgbroker.sql`
  - `PKGBROKER` 상태 관리 및 작업 재할당 프로시저
