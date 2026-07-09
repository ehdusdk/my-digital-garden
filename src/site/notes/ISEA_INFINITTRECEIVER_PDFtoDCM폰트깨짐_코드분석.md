---
{"dg-publish":true,"permalink":"/isea-infinittreceiver-pd-fto-dcm/","tags":["ISEA","INFINITTReceiver","CIS","PDF","DICOM","폰트","코드분석","트러블슈팅"],"dg-note-properties":{"tags":["ISEA","INFINITTReceiver","CIS","PDF","DICOM","폰트","코드분석","트러블슈팅"]}}
---

[[CIS 2.0/CIS 분석\|← CIS 분석 인덱스로]]

# ISEA INFINITTReceiver PDF→DCM 폰트 깨짐 코드분석

> 작성일: 2026-07-09
> 대상: `D:\Proj\CIS_BUNDLE\INFINITTReceiver` (INFINITT Receiver) + `D:\Proj\CIS_LIB_2008\CISLib` (CISModality / CISDicom / CISPDF)
> 이슈: PDF 파일을 INFINITT Receiver로 DCM 변환 시 **특정 폰트가 깨져서** 출력됨

---

## 0. 결론 요약

- **폰트 깨짐은 CISDicom(PDF→DCM 단계)에서 발생하는 것이 아니다.** DCM 생성 직전, PDF를 이미지로 래스터라이징하는 **`Tools\pdfdraw.exe`(구버전 MuPDF)** 단계에서 이미 글자가 깨진 상태로 그려진다.
- `CISDicom`은 이미 만들어진 JPEG을 DICOM Secondary Capture로 **포장만** 한다(글자 렌더링 없음).
- 따라서 **"OS에 폰트만 추가"로는 해결되지 않는다.** 현재 렌더러(구버전 MuPDF)는 Windows 설치 폰트를 읽지 않는다.
- 코드 변경 없이 가능한 우선 대안: **① PDF 소스에서 폰트 임베딩**, **② GhostScript 엔진으로 전환(+한글 폰트 설치)**, **③ DPI 상향(흐릿함/계단현상 한정)**.

---

## 1. PDF → DCM 변환 Workflow

오케스트레이션: [`CISPDFParser.cpp`] (`CIS_LIB_2008\CISLib\trunk\Source\CISModality\CISPDFParser.cpp`)
실제 렌더링: 외부 EXE `Tools\pdfdraw.exe`(MuPDF) 또는 `gswin64c.exe`(GhostScript)
DICOM 포장: [`CISDicom.cpp`] `SetJPG` → DCMTK `Image2Dcm`

```
[1] PDF 폴링 수신 (*.PDF)
      └ OnCISParser_PrepareParsing / PrepareOutput  (출력폴더/페이지 파일명 준비)
              ▼
[2] OnCISParser_Parsing()                         (CISPDFParser.cpp:145)
      └ 파일명 Name Rule 파싱 → ID / Name / StudyUID / 검사일시
      └ (옵션) 텍스트 파싱 → Pdf2Text_PdfDraw() / Pdf2Text_GhostScript()
              ▼
[3] OnCISParser_CreateOutput()                     (CISPDFParser.cpp:225)
    ├─(3-1) OnCISPDFParser_CreateImage()           (CISPDFParser.cpp:428)
    │        └ PdfToPng()                          (CISPDFParser.cpp:588)  ← 엔진 분기
    │             ├ 기본: PdfToPng_PdfDraw()   → Tools\pdfdraw.exe (MuPDF)   ★폰트 렌더링★
    │             └ 옵션: PdfToPng_GhostScript() → gswin64c.exe               ★폰트 렌더링★
    │        └ 페이지별 PNG → CISGDI_Util 로 JPG 변환/리사이즈 (JPG/Quality80/DPI설정)
    ├─(3-2) OnCISPDFParser_CreatePDF()  (옵션)      CISPDF::JpegsToPdf (libharu)
    └─(3-3) OnCISPDFParser_CreateDICOM()           (CISPDFParser.cpp:661)
             └ CISDicom Dcm(...)  → SOPClass=SecondaryCaptureImage
                  ├ Dcm.SetJPG(jpeg)               (CISDicom.cpp:368)
                  │     └ DCMTK Image2Dcm (I2DJpegSource → I2DOutputPlugSC)
                  │        = JPEG 픽셀을 그대로 SC 객체로 캡슐화 (렌더링 없음)
                  └ Dcm.SaveAs(".dcm") / Dcm.SendDicom(PACS)
```

**핵심:** 폰트가 그려지는 유일한 지점은 `PdfToPng_PdfDraw`(CISPDFParser.cpp:595)가 호출하는 `pdfdraw.exe`. CISDicom에는 폰트 처리 로직 자체가 없다.

---

## 2. 폰트 깨짐 원인 분석

`Tools\pdfdraw.exe` 바이너리 분석 결과:
- **구버전 MuPDF** (문자열 `Copyright 1995-2010`, MuPDF 1.x 초기 세대. 개발사 Artifex)
- 내장 폰트: URW base-14(NimbusSans 등) + DroidSans / DroidSansMono / DroidSansFallback(CJK)
- Tools 폴더에 **별도 번들 폰트 파일(.ttf/.ttc)이 전혀 없음** → EXE 컴파일 내장 폰트만 사용
- **이 구버전 MuPDF는 Windows 시스템 폰트 디렉터리(C:\Windows\Fonts)를 조회하지 않는다.**

깨짐 메커니즘:

| 상황 | 결과 |
|---|---|
| PDF에 폰트가 **임베드**되어 있음 | 정상 렌더링 (OS 무관) |
| PDF가 폰트를 **이름으로만 참조**(비임베드) | MuPDF 내장 대체폰트로 치환 → 아래 증상 |
| → 한글/한자가 DroidSansFallback 서브셋에 없음 | □□□ / 빈칸 / 두부(tofu) |
| → 대체폰트 metric(자폭) 불일치 | 글자 겹침 / 잘림 / 위치 어긋남 |
| → 심볼·전용 폰트 참조 | 엉뚱한 기호 / 공백 |

### "OS에 폰트만 추가하면 되나?" → **아니요**
현재 pdfdraw 경로에서는 OS에 폰트를 설치해도 렌더러가 읽지 않아 효과 없음. OS 폰트 설치가 의미를 갖는 것은 **GhostScript 엔진으로 전환했을 때** 뿐(GS는 시스템 폰트 + cidfmap 참조).

---

## 3. 해결 방안 (우선순위)

1. **[근본] PDF 생성 측 폰트 임베딩** — 생성 장비/프로그램에서 "모든 폰트 포함(Embed all fonts)" 출력. 렌더러·OS 무관하게 항상 정상.
2. **[코드 변경 없음] GhostScript 엔진 전환** — 아래 4장 참조. (+비임베드 한글이면 OS 한글 폰트 설치 / GS `cidfmap` 매핑 병행)
3. **[정공법, 코드 변경 필요] pdfdraw.exe를 최신 MuPDF(`mutool draw`)로 교체** — 최신은 Windows 시스템 폰트 로딩 가능. 단 CLI 인자 체계가 달라 드롭인 교체 불가(5장).
4. **[별개 이슈] DPI 상향** — "깨짐"이 글리프 치환이 아니라 흐릿함/계단현상이면 DPI 96→200/300 으로 개선(6장).

---

## 4. GhostScript 전환 — 트리거 조건과 실행 방법

트리거는 [`IsGhostScript()`] (CISPDFParserSetting.cpp:34) 한 줄:

```cpp
BOOL CISPDFParserSetting::IsGhostScript() const
{
    return m_PDF.m_bGhostScript && CISGF::IsFile(m_PDF.m_strGhostScript);
}
```

**두 조건이 동시에 참**이어야 GS 경로 사용:
1. `m_bGhostScript == TRUE` (설정화면 **"Use GhostScript" 체크박스**)
2. `m_strGhostScript` 경로가 **실제 존재하는 파일**(`IsFile`)

분기 지점 `PdfToPng()`(CISPDFParser.cpp:588):
```cpp
if(pPDFSetting->IsGhostScript()) return PdfToPng_GhostScript(...);  // GS
return PdfToPng_PdfDraw(...);                                       // 기본 MuPDF
```

**gswin64c.exe가 Tools 폴더에 있어야 하나 → 아니요.**
`pdfdraw.exe`는 상대경로(`Tools\pdfdraw.exe`)로 호출되지만, GhostScript는 **설정에 저장된 절대경로를 그대로 실행**한다(PdfToPng_GhostScript, CISPDFParser.cpp:623):
```cpp
CString strEXEPath = pPDFSetting->m_PDF.m_strGhostScript;   // 절대경로 그대로
// gswin64c.exe -dSAFER -dBATCH -dNOPAUSE -sDEVICE=png16m -r{DPI} -sOutputFile="..." "input.pdf"
```

**실행 절차 (코드 변경 없음, 리시버별 설정):**
1. PC에 GhostScript 64bit 설치 (Artifex 공식: https://www.ghostscript.com/releases/gsdnld.html )
2. 대상 리시버(PDFMAC2000) → PDF Parser Setting → **"Use GhostScript" 체크**
3. `GhostScript :` 입력란 우측 `...`(OnBnClickedBtnDir4, Dlg:166)로 `gswin64c.exe` 선택
4. OK → XML `<GhostScript use="TRUE" path="..."/>` 저장 (SaveSettingToXML:129)
5. 이후 변환부터 GS 경로로 렌더링

> 주의: GS 전환해도 **비임베드 한글**이면 GS가 대체할 폰트 필요. GS는 Windows 시스템 폰트 + `Resource\Init\cidfmap`(CID 폰트 매핑) 참조 → 이 경우 "GS 전환 + OS 한글 폰트 설치/cidfmap 매핑" 병행해야 효과.

---

## 5. pdfdraw.exe(MuPDF) 입수처

- `pdfdraw`는 MuPDF(Artifex)의 래스터라이저 CLI. 변천: `pdfdraw` → `mudraw` → 현재 **`mutool.exe draw`** 서브커맨드로 통합.
- 공식 다운로드: https://mupdf.com/releases  / 소스: https://github.com/Artifex/mupdf
- **단순 교체 불가:** 현재 코드는 구형 인자 사용
  - PdfToPng_PdfDraw(CISPDFParser.cpp:608): `-b 8 -r {DPI} -o "...\%04d.png" "input.pdf"`
  - Pdf2Text_PdfDraw(CISPDFParser.cpp:1136): `"pdfdraw.exe" -t "input.pdf" > out.txt`
  - 최신 `mutool draw`는 인자 체계가 달라(예: `mutool draw -r 300 -o out.png input.pdf`) 그대로 덮으면 미동작 → `PdfToPng_PdfDraw`/`Pdf2Text_PdfDraw` 인자 문자열 수정(코드 변경) 필요.

---

## 6. DPI 변경 위치

- PDF Parser Setting 다이얼로그의 **`DPI` 콤보박스** (화면 `PDF Convert` 섹션, 현재 96)
- 선택지 코드 고정: **72 / 96 / 200 / 300** (Dlg:63~66)
- 저장 필드 `m_PDF.m_nImageDPI` (기본 96, SetDefault:43) → XML `<PDFParser><DPI>`
- 두 엔진 모두의 해상도 인자 `-r {DPI}`에 사용(pdfdraw:608 / GS:634)
- 권장: 96 → 200/300. 단 DPI는 저해상도 흐릿함/계단현상만 개선, **글리프 치환 깨짐(□·두부)은 해결 못함.**

---

## 7. 권장 진단 순서

문제 PDF 1건으로:
1. Acrobat → 문서 속성 → 글꼴 탭에서 문제 폰트 `(포함됨)`/`(포함 안 됨)` 확인 → 임베드 판정
2. 명령창 렌더 비교
   - `pdfdraw.exe -r 200 -o out_%04d.png 문제파일.pdf` (현 엔진)
   - `gswin64c.exe -dSAFER -dBATCH -dNOPAUSE -sDEVICE=png16m -r200 -sOutputFile=gs_%03d.png 문제파일.pdf` (GS)
   - 두 PNG의 폰트 상태 비교 → "엔진 교체로 해결되는지" 즉시 판별
3. 즉시 조치 순서: **① DPI 300 재변환** → 여전히 □/깨짐이면 **② Use GhostScript + gswin64c.exe 지정(+한글 폰트 설치)**

---

## 관련 코드 위치

- `CIS_LIB_2008\CISLib\trunk\Source\CISModality\CISPDFParser.cpp` — 변환 오케스트레이션 / 엔진 분기
- `CIS_LIB_2008\CISLib\trunk\Source\CISModality\CISPDFParserSetting.cpp` — IsGhostScript / 기본값 / XML I·O
- `CIS_LIB_2008\CISLib\trunk\Source\CISModality\CISPDFParserSettingDlg.cpp` — DPI/GhostScript UI 매핑
- `CIS_LIB_2008\CISLib\trunk\Source\CISDicom\CISDicom.cpp` (SetJPG:368) — JPEG→DICOM SC 포장(DCMTK Image2Dcm)
- `Tools\pdfdraw.exe` — 실제 PDF 래스터라이저(구 MuPDF)

---

[[CIS 2.0/CIS 분석\|← CIS 분석 인덱스로]]
