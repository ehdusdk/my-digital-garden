---
{"dg-publish":true,"permalink":"//isea-infinitt-receiver-pd-fto-dcm/","tags":["이슈","ISEA","INFINITTReceiver","PDFtoDCM","폰트깨짐","DICOM","SecondaryCapture"],"dg-note-properties":{"tags":["이슈","ISEA","INFINITTReceiver","PDFtoDCM","폰트깨짐","DICOM","SecondaryCapture"],"date":"2026-07-09"}}
---

# ISEA-INFINITTReceiver_PDFtoDCM_폰트깨짐이슈확인

> [[HIE팀 이슈\|← 이슈 목록으로]]

---

## 개요

| 항목 | 내용 |
|---|---|
| 대상 | ISEA (인도네시아) |
| 관련 프로그램 | INFINITT CIS Receiver — PDF → DICOM(DCM) 변환 |
| 이슈 유형 | 변환된 DCM 내 텍스트(폰트) 깨짐 |
| 확인 도구 | MicroDicom DICOM Viewer 2026.2 |
| 담당 | 김도연 책임 |
| 관련 회의 | [[회의록/260708-김도연-HIE팀 이슈 내용 공유\|회의록/260708-김도연-HIE팀 이슈 내용 공유]] — 액션아이템 #4 |

---

## 이슈 내용

INFINITT CIS Receiver를 통해 PDF 문서를 DICOM으로 변환하는 과정에서, 변환된 DCM 파일을 뷰어로 열었을 때 **텍스트 영역의 폰트가 깨져서(mojibake) 표시**되는 현상 확인. 원본 PDF의 한글(또는 특정 문자셋) 텍스트가 이미지화되는 과정에서 글리프가 다른 문자로 치환되어 보이는 것으로 추정.

---

## 샘플 파일 DICOM Tag 분석

업로드된 샘플(환자명 GuilherminaCorreia, ECG 리포트)의 DICOM Tag를 확인한 결과는 다음과 같음.

| 태그 | 값 | 확인 내용 |
|---|---|---|
| (0002,0002) Media Storage SOP Class UID | `1.2.840.10008.5.1.4.1.1.7` | **Secondary Capture Image Storage** |
| (0008,0016) SOP Class UID | `1.2.840.10008.5.1.4.1.1.7` | 동일 — Secondary Capture Image IOD |
| (0008,0060) Modality | ECG | 원 검사 종류는 ECG |
| (0008,0064) Conversion Type | **WSD** (Workstation) | 원본 촬영 직접 생성물이 아닌, **워크스테이션 단에서 변환/캡처된 영상**임을 시사 |
| (0008,0070) Manufacturer | INFINITT | |
| (0008,1090) Manufacturer Model Name | CIS Receiver | INFINITT CIS Receiver가 변환 주체 |
| (0028,0002) Samples Per Pixel | 3 | 컬러 이미지 |
| (0028,0004) Photometric Interpretation | YBR_FULL_422 | 컬러 JPEG 계열 인코딩 |
| (0002,0010) Transfer Syntax UID | `1.2.840.10008.1.2.4.50` | JPEG Baseline (Process 1), 압축 이미지 |
| (0008,0005) Specific Character Set | ISO_IR 6 | **기본 ASCII 문자셋** — 다국어/한글 문자셋이 명시되지 않음 |

### 확인 포인트 — SOP Class(IOD) 판단

- 이 DCM은 **파형(waveform) 데이터가 아니라 이미지로 캡처된 결과물**. IOD 기준으로는 **Secondary Capture Image IOD**이며, 실제 ECG 신호 데이터를 저장하는 **Waveform IOD**(`1.2.840.10008.5.1.4.1.1.9.1.1` General ECG Waveform Storage 등) 계열이 아님.
- 즉 폰트 깨짐은 DICOM 데이터(파형/수치) 자체의 손상이 아니라, **PDF → 이미지 렌더링 단계에서 폰트/글리프 처리가 잘못된 것**으로 이미지 레벨의 문제일 가능성이 높음.

---

## 원인 추정 (초기 분석)

1. **PDF 렌더링 시 폰트 임베딩/매핑 문제**: PDF 내 텍스트를 이미지로 래스터라이즈하는 과정에서 폰트가 시스템에 없거나 폰트 치환이 발생하면 글리프가 깨져 보일 수 있음.
2. **문자 인코딩/코드 페이지(NLS) 불일치**: CIS Receiver가 실행되는 서버의 OS 로케일과 PDF 생성 측 로케일이 다를 경우 발생 가능. (Specific Character Set이 `ISO_IR 6`(ASCII)로만 표기된 점은 이미지 캡처이므로 직접적 원인은 아니나, 변환 파이프라인 전반의 로케일 설정 점검 필요)
3. **CIS Receiver 변환 모듈(zip 파일) 내 리소스 확인 필요**: 회의록 기준 "CIS Receiver zip 파일 확인 진행 중" — 변환에 사용되는 폰트 리소스/설정 파일 포함 여부 점검 예정.

---

## 다음 단계 (진행 예정)

- [x] CIS Receiver 배포 zip 내 폰트/리소스 구성 확인(불필요)
- [x] 이슈 재현 (동일 PDF 샘플로 변환 재시도)
- [x] 재현 시 변환 서버 로케일/폰트 설치 상태 점검(불필요)
- [x] 원인 확정 후 해결 방안 도출

---
## 확인 내용
1. 이슈상에 Receiver 압축 파일 확인
	1. INFINITT Receiver 임을 확인
		1.[{CIS SVN ROOT}\CIS_BUNDLE\INFINITTReceiver](http://code.infinitt.com:8080/svn/cis/CIS_BUNDLE/INFINITTReceiver/trunk)
2. UI 화면 아래와 같음 ( 캡처화면에서 GE MAC2000 PDF 파일을 DCM 변환하는 Add Receiver 설정임)
	2. ![Pasted image 20260709101715.png](/img/user/%EC%9D%B4%EC%8A%88/Pasted%20image%2020260709101715.png)
	
3. 재현 테스트 
	1. Polling 폴더에 같이 보내준 PDF 파일 놓고 DCM 파일 확인 함 (폰트 깨짐 확인함)
		1. ![Pasted image 20260709101816.png](/img/user/%EC%9D%B4%EC%8A%88/Pasted%20image%2020260709101816.png)![Pasted image 20260709101908.png](/img/user/%EC%9D%B4%EC%8A%88/Pasted%20image%2020260709101908.png)
	2. Claude Bundle\INFINITTReceiver 코드 + CISLib\CISDICOM 관련 문의 
		1. 실제 PDF를 DCM 변환시 PDF를 변환시도하는 CISPDFParser에 이미지로 변환하는 부분이 중요 포인트임을 확인
		2. Tool\pdfdraw.exe 이용하여 변환을 시도 하고 이때 pdfdraw.exe 내장된 폰트로만 사용함을 확인
		3. 다른 기능으로 GhostScript 이용한 PDF 이미지 추출방식도 지원하여 그 옵션으로 진행 
			1. GhostScript 홈페이지에서 최신 버전 설치 파일 진행 
			2. INFINITTReceiver 설정에서 아래와 같이 설정 하여 변환 시도시 정상 폰트 확인
				1. DCM 파일 폰트 확인은 MicroDicom Viewer로 확인 Secondary Capture Image IOD 임을 확인 
					1. (0002,0002)	Media Storage SOP Class UID	1.2.840.10008.5.1.4.1.1.7
				2. ![Pasted image 20260709102831.png](/img/user/%EC%9D%B4%EC%8A%88/Pasted%20image%2020260709102831.png)
		4. ![Pasted image 20260709103112.png](/img/user/%EC%9D%B4%EC%8A%88/Pasted%20image%2020260709103112.png)
	3. 
4. 결론
	1. DCM 변환시 Receiver에서는 Secondary Captured Image IOD 형식으로 변환한다.
	2. ISEA 변환 폰트 깨짐 이슈는 GhostScript 설정으로 처리 가능함 확인 
	3. 이슈 담당자에게 내용 전달 필요 
		
		
---

> [[HIE팀 이슈\|HIE팀 이슈]]
