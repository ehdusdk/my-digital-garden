---
{"dg-publish":true,"permalink":"//dicom-sop-iod/","tags":["용어정리","DICOM","SOP","IOD","의료IT","표준"],"dg-note-properties":{"tags":["용어정리","DICOM","SOP","IOD","의료IT","표준"],"created":"2026-07-08"}}
---


# DICOM - SOP, IOD 정리

> [[용어정리/용어정리 인덱스\|← 용어정리 목록으로]]

---

## 개요

**DICOM**(Digital Imaging and Communications in Medicine)에서 영상 및 관련 데이터를 표현하고 통신하기 위한 핵심 개념이 **IOD**와 **SOP**이다. 계층 구조로 이해하면 다음과 같다.

```
IOD (데이터 구조 정의)
  └─ Module들로 구성
        └─ Attribute(속성)들로 구성

SOP Class = IOD + Service (통신 시 협상 단위, UID로 식별)
  └─ SOP Instance = 실제 데이터 1건 (개별 UID 보유)
```

---

## IOD (Information Object Definition)

**"어떤 데이터로 구성되는가"**를 정의하는 추상적인 데이터 모델.

- 실제 객체(CT 영상, MR 영상, 구조화 리포트 등)가 어떤 속성(Attribute)들을 가져야 하는지 정의
- 예: CT Image IOD, MR Image IOD, RT Structure Set IOD 등
- 두 가지 종류
  - **Normalized IOD**: 하나의 실세계 개체(entity)만 표현 (예: Modality Performed Procedure Step IOD)
  - **Composite IOD**: 여러 실세계 개체를 하나로 묶어서 표현 (예: CT Image IOD는 Patient, Study, Series, Image 정보를 모두 포함) — 실무에서는 대부분 Composite IOD 사용

IOD는 **IE(Information Entity)**들의 집합으로 구성됨 (Patient IE, Study IE, Series IE, Equipment IE, Image IE 등).

---

## Module

IOD를 구성하는 **속성들의 논리적 묶음**.

- 예: "Patient Module"에는 Patient Name, Patient ID, Patient Birth Date 등이 포함
- "General Study Module", "General Series Module", "Image Pixel Module" 등
- 여러 IOD에서 재사용됨 (Patient Module은 거의 모든 IOD에 공통으로 포함)

---

## SOP Class (Service-Object Pair Class)

**IOD + 그 IOD에 적용 가능한 서비스(Service)**를 묶은 개념.

- "데이터 구조(IOD)" + "그 데이터로 무엇을 할 수 있는지(DIMSE Service)"의 조합
- 예: **CT Image Storage SOP Class** = CT Image IOD + Storage Service
- 각 SOP Class는 고유한 **UID**로 식별 (예: CT Image Storage = `1.2.840.10008.5.1.4.1.1.2`)
- PACS나 장비가 통신 시작 시 "나는 이 SOP Class를 지원한다"고 협상(Association Negotiation)하는 단위

관련 서비스 종류
- **Storage** (영상 저장)
- **Query/Retrieve** (조회/검색: C-FIND, C-MOVE, C-GET)
- **Print**, **Worklist** 등

---

## SOP Instance

SOP Class의 **실제 데이터 인스턴스**.

- 실제로 촬영된 영상 하나하나가 SOP Instance
- 각 SOP Instance는 고유한 **SOP Instance UID**를 가짐 (DICOM 파일마다 유일)
- 예: 환자 A의 CT 영상 300장 → CT Image Storage SOP Class에 속하는 300개의 SOP Instance

---

## 실무 예시로 이해하기

| 개념 | 예시 |
|---|---|
| IOD | CT Image IOD |
| Module | General Patient, General Study, CT Image Module 등 |
| SOP Class | CT Image Storage (`1.2.840.10008.5.1.4.1.1.2`) |
| SOP Instance | 실제 파일 하나 (`SOPInstanceUID: 1.2.3.4.5...`) |

---

## 추가로 알아두면 좋은 용어

- **DIMSE (DICOM Message Service Element)**: C-STORE, C-FIND, C-MOVE, C-GET, C-ECHO 같은 실제 통신 명령
- **Application Entity (AE)**: 네트워크 상의 DICOM 통신 주체 (PACS, 모달리티 등), AE Title로 식별
- **Association**: 두 AE 간 통신 세션. 시작 시 어떤 SOP Class를 지원하는지 Presentation Context로 협상
- **Transfer Syntax**: 데이터를 어떤 인코딩(바이트 순서, 압축 방식 등)으로 주고받을지 정의 (예: Explicit VR Little Endian, JPEG 2000)

---

## 관련 용어

- [[용어정리/FHIR\|용어정리/FHIR]]
- [[용어정리/EHR (Electronic Health Records)\|용어정리/EHR (Electronic Health Records)]]
