---
{"dg-publish":true,"permalink":"/260818-cis-receiver-vs-cis-receiver/","tags":["부천성모","CISReceiver","TC-70","FilePolling2","XML설정","버전호환"],"dg-note-properties":{"tags":["부천성모","CISReceiver","TC-70","FilePolling2","XML설정","버전호환"],"date":"2026-08-18"}}
---


# 260818-부천성모 CISReceiver VS 최신 CISReceiver 변경사항 내용 정리

> [!info] 상위 노트
> [[CIS 2.0/CIS 분석\|CIS 분석]]

## 문의 및 분석 범위

- 기존 CISReceiver 2.0의 TC-70 Receiver XML을 최신 CISReceiver에 적용할 때 Polling 경로가 사라지는 원인을 확인한다.
- 최신 TC-70 XML의 경로값 자체는 무시하고, 기존 운영 설정을 최신 XML 구조에 이관하는 방법을 정리한다.
- 기존 XML: `C:\INFINITT\CIS_Receiver\Receiver\20241205160107_03E885A8_7dnmpyt1_5f3fb533.xml`
- 최신 XML: `D:\Proj\CIS_1400\trunk\BIN\Win32\ReleaseUnicode\Receiver\20260818172202_05D6B110_en5qlew4_00000001.xml`

## 결론

> [!important] 핵심 변경점
> 최신 TC-70 Receiver는 기존 `<FilePolling>`이 아닌 `<FilePolling2>` 구조만 읽는다. 따라서 실행파일과 DLL만 최신으로 교체하고 예전 XML을 그대로 사용하면, `<FilePolling>` 안의 `<Root>`는 로드되지 않아 설정 화면에서 Polling 경로가 빈 값으로 보일 수 있다.

리소스/UI 변경이 화면 차이를 만들 수는 있지만, Polling 경로 소실의 직접 원인은 XML 스키마와 로더가 `FilePolling2` 방식으로 변경된 점이다.

## 1. Polling 구조의 핵심 변경

| 구분 | 기존 CISReceiver 2.0 | 최신 TC-70 CISReceiver | 이관 기준 |
|---|---|---|---|
| 상위 노드 | `<FilePolling>` | `<FilePolling2>` | 반드시 새 노드명 사용 |
| 경로 구조 | `<PollingItem><Item><Root>...</Root></Item></PollingItem>` | `<Root unc="..." .../>` | 기존 `Root` 텍스트를 `unc` 속성으로 이동 |
| 로컬/네트워크 | `<DriveMode>0</DriveMode>` | `folder="0"` | 기존 Local Drive는 `folder="0"` 적용 |
| 사용자 | `<UserName>` | `id=""` | 네트워크 계정 사용 시 값 이관 |
| 비밀번호 | `<Password>` | `pwd=""` | 네트워크 계정 사용 시 값 이관 |
| 파일 필터 | `<Item>` 내 `<Filter>*.xml</Filter>` | `<FilePolling2>` 내 `<Filter>*.XML</Filter>` | 기존 필터를 복사; Windows에서 대소문자 차이는 일반적으로 무관 |
| 폴링 모드 | `<Mode>1</Mode>` | 별도 노드 없음 | 최신 구조에서 개별 이관 불가 |
| 파일 완료 대기 | `<CompleteTime>3000</CompleteTime>` | 동일 필드 없음 | `FilePolling2` XML로는 동일 값 표현 불가 |
| 복수 경로 | `<Item>` 복수 등록 가능 | `<Root>` 1개 | 단일 경로 기준으로 재구성 |

## 2. 최신 XML에 추가된 항목

| 위치 | 추가 항목 | 최신 예시값 | 의미/적용 방향 |
|---|---|---:|---|
| `Parser` | `MismatchDir` | `...\CISModality\Mismatch` | 미매칭/오류 결과 분리 경로 |
| `Parser` | `CopyOutputXMLDir` | `...\CopyOutputXML` | 생성 XML 복사 경로 |
| `Operation` | `<CDW enable="0"/>` | `0` | CDW 연계 사용 여부 |
| `Operation` | `UseAcqTime` | `0` | Acquisition Time 사용 여부 |
| `Operation` | `CopyOutputXML` | `0` | Output XML 복사 여부 |
| `Operation` | `CopyOutputJPG` | `0` | Output JPG 복사 여부 |
| `Image` | `Resize` | `0` | 이미지 리사이즈 사용 여부 |
| `DICOM` | `NoCompression` | `0` | DICOM 무압축 처리 여부 |
| `Parser` | `<Reserved item1="" item2=""/>` | 빈 값 | 확장용 예약 속성 |
| `ECGParser` | `InterfaceAsImage` | `0` | Interface 처리 시 이미지 방식 사용 여부 |
| `ECGParser` | `DicomEcg` | `0` | DICOM ECG 생성/처리 여부 |
| `ECGParser` | `UseWaveformLast10Sec` | `0` | ECG 파형의 마지막 10초 사용 여부 |

추가 항목은 기존 운영 정책이 없다면 최신 XML의 기본값 `0` 또는 빈 값을 유지하는 것이 안전하다. 경로는 실제 배포 위치에 맞게 지정한다.

## 3. 구조가 변경된 기타 항목

| 항목 | 기존 | 최신 | 주의사항 |
|---|---|---|---|
| `ThirdParty/Interface` | `<Interface use="0" type="1"/>` | `<Interface use="0"/>` | 최신 예시에서 `type` 속성 제거 |
| `EquipCode_Rule` | `Type`, `Value`, `MainNode`, `Attribute`, `Question`, `Answer`, `Condition` | `<Search root=""/>`, `<Value origin="0" attr=""/>` | ECG 룰 구조가 축약형으로 변경 |
| `StudyUID_Rule` | 기존 세부 노드 구조 | `Search` + `Value` 속성 구조 | 룰 사용 시 새 UI에서 재설정 권장 |
| `Match` | 기존 XML에 존재 | 비교 대상 최신 XML에 없음 | 기능 제거로 단정하지 말고, 기존 매칭을 유지하려면 새 UI에서 재저장하거나 호환성 확인 후 이관 |

## 4. 구조 변경이 아닌 설정값 차이

아래는 버전 스키마 변경이 아니라 두 샘플에 저장된 값의 차이이다. 기존 운영 의도에 따라 결정해야 한다.

| 항목 | 기존 XML | 최신 XML | 이관 권장 |
|---|---:|---:|---|
| `Receiver/Name` | `TC50 Demo` | `TC-70` | 실제 Receiver 명칭으로 확정 |
| `Polling/Interval` | `3000` | `5000` | 기존 주기 유지 시 `3000` |
| `Operation/CreateJPEG` | `1` | `0` | 기존 JPEG 생성이 필요하면 `1` |
| `Image/Quality` | `70` | `80` | 기존 화질 유지 시 `70` |
| `ECGParser/UseSVG` | `1` | `0` | Philips SVG 변환이 필요하면 `1`과 실제 `SVGPath` 확인 |
| `ECGDisplay/Design id` | `0` | `3` | 실제 TC-70 출력 디자인을 확인하고 선택 |
| `ExamCode`, `EquipCode` | `FE6541` | 빈 값 | 기존 코드 유지 필요 시 복사 |

## 5. 기존 Polling 경로를 최신 XML로 이관하는 방법

### 기존 설정

```xml
<FilePolling>
    <CompleteTime>3000</CompleteTime>
    <PollingItem>
        <Item>
            <DriveMode>0</DriveMode>
            <Root>C:\INFINITT\IISReceiver\XMLFile</Root>
            <UserName/>
            <Password/>
            <Filter>*.xml</Filter>
            <Mode>1</Mode>
        </Item>
    </PollingItem>
</FilePolling>
```

### 최신 적용 형태

```xml
<FilePolling2>
    <Root unc="C:\INFINITT\IISReceiver\XMLFile" folder="0" id="" pwd=""/>
    <Filter>*.xml</Filter>
</FilePolling2>
```

기존 `<FilePolling>` 블록을 남겨 두고 `<FilePolling2>`를 추가하는 방식보다, 백업 후 새 구조로 교체하여 한 가지 스키마만 유지하는 것을 권장한다.

## 6. 적용 절차

1. 기존 Receiver XML과 전체 CISReceiver 폴더를 백업한다.
2. 최신 CISReceiver UI에서 TC-70 Receiver를 하나 새로 생성하여 현재 버전의 XML 기본 구조를 만든다.
3. 새 XML의 `<FilePolling2>`에 기존 Polling 경로와 필터를 이관한다.
4. `OutputDir`, `Parser/OutputDir`, `BackupDir`, `MismatchDir`, `CopyOutputXMLDir`, `DCM_BackupDir`를 실제 운영 경로로 수정한다.
5. `ExamCode`, `EquipCode`, JPEG/SVG/DICOM 생성 여부, ECG Design과 매칭 설정을 기존 운영 기준에 맞게 적용한다.
6. XML 직접 편집 후에는 Receiver 설정 화면을 열어 경로가 표시되는지 확인하고 `OK`로 재저장한다.
7. Receiver를 재시작하고 TC-70 XML 입력, Output/Backup 생성, 원본 삭제, 매칭 결과를 순서대로 검증한다.

## 7. 검증 체크리스트

- [ ] Receiver 설정 화면의 Root Directory에 `C:\INFINITT\IISReceiver\XMLFile`이 표시된다.
- [ ] `*.xml` 필터가 표시되고 해당 파일이 정상 감지된다.
- [ ] 파일 완성 전 조기 처리가 발생하지 않는다. `CompleteTime` 제거 영향은 큰 파일/저속 복사로 별도 확인한다.
- [ ] Receiving/Output/Backup/Mismatch 경로가 운영 폴더를 가리킨다.
- [ ] JPEG, SVG, DICOM, 원본 백업/삭제 정책이 기존과 일치한다.
- [ ] 기존 `Match` 조건과 `FE6541` 코드 적용 여부를 확인한다.
- [ ] 최신 EXE·DLL·리소스를 동일 빌드 세트로 배포한다.

## 8. 코드 근거

- `D:\Proj\CIS_LIB_2008\CISModalityLib\trunk\Source\PhilipsModality\PhilipsModality.cpp` — TC-70을 `Philips_TRIM3`에 등록.
- `D:\Proj\CIS_LIB_2008\CISModalityLib\trunk\Source\PhilipsModality\Philips_TRIM3.cpp` — `CISFilePollingReceiver2`/`CISFilePollingReceiverSetting2` 사용.
- `D:\Proj\CIS_LIB_2008\CISLib\trunk\Source\CISModality\CISFilePollingReceiverSetting2.cpp` — `<FilePolling2>`만 저장·로드하며 해당 노드가 없으면 Root를 빈 값으로 유지.
- `D:\Proj\CIS_LIB_2008\CISLib\trunk\Source\CISModality\CISFilePollingReceiverSetting.cpp` — 기존 `<FilePolling>`/`PollingItem` 구조 저장·로드.

## 최종 정리

1. Polling 경로 소실의 가장 큰 변경점은 `FilePolling`이 `FilePolling2`로 바뀐 것이다.
2. 기존 경로는 `Root` 텍스트에서 최신 `Root` 노드의 `unc` 속성으로 이관해야 한다.
3. `CompleteTime`, 복수 `Item`, 개별 `Mode`는 최신 `FilePolling2` XML에 동일한 표현이 없으므로 실기기 검증이 필요하다.
4. 최신에 추가된 기능은 운영 요구가 없으면 비활성 기본값을 유지하고, 경로와 기존 생성 정책만 명시적으로 이관한다.

## 관련 노트

- [[CIS 2.0/CIS 분석\|CIS 분석]]
- [[CISReceiver_AutoMatching_PatientName_Analysis\|CISReceiver 자동 매칭 환자명 출처 분석]]
- [[이슈/삼성서울 마지막 10초 WaveFrom 사용 옵션 Receiver\|삼성서울 CISReceiver 마지막 10초 WaveForm 옵션화 기능 추가]]
