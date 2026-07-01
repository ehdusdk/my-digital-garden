---
{"dg-publish":true,"permalink":"//cis-receiver-eclipse/","tags":["이슈","CIS분석","CISReceiver","VarianEclipse","CSV파싱"],"dg-note-properties":{"tags":["이슈","CIS분석","CISReceiver","VarianEclipse","CSV파싱"]}}
---

> [[HIE팀 이슈\|← 이슈 목록으로]]
[[HIE팀 이슈\|HIE팀 이슈]]
---
##요약
## ㅁ요약  
1. 원인:  PlanSetupID 값  끝에 "1" 들어가면  skip 하게되면서 값이 아에 없는 상태이때 ID 값도 누락되게 됨   
2. 결론: ID 값을 누락되지 않도록 코드 처리 및 방어코드 추가 : 배포 예정   
3. 정상 CSV, 비정상 CSV 차이  
![697](https://src.infinitt.com/ckeditor/upload?file_name=260701140837_image.png)
![](https://src.infinitt.com/ckeditor/upload?file_name=260701140932_image.png)
## 개요

| 항목 | 내용 |
|---|---|
| 대상 병원 | 일반병원 |
| 이슈 날짜 | 2026-07-01 |
| 대상 모듈 | CIS_1400 \ CISReceiver (Varian Eclipse 인터페이스) |
| 증상 | Eclipse CSV → XML 변환 시 특정 파일에서 `<ID/>`(PatientId)가 누락됨 |
| 실제 파서 소스 위치 | `D:\Proj\CIS_LIB_2008\CISModalityLib\trunk\Source\RcvUX001\Varian_Eclipse_ver13.cpp` (CIS_1400 trunk가 아니라 별도 솔루션인 CIS_LIB_2008에 존재) |

## 증상 재현 자료

- 정상 파일: `11861398 - 정상 원본.csv` — 데이터 행 6개, PlanSetupId = `Rt.Lung`
- 문제 파일: `12013149 - id누락 원본.csv` — 데이터 행 2개, PlanSetupId = `C/D-1`
- Receiver 설정: `FD6B7828-BB9E-4DE7-B4F2-28061873677F.xml` (Vendor id=37, Modality=Varian Eclipse, `*.CSV` 폴링)
- 실제 누락 결과 확인: `Data\Interface2\20260701123402_0405AC38_8bz9simm_00000001_0001.xml` → `<ID/>` 빈 값으로 생성됨

## 원인 분석

`Varian_Eclipse_ver13_Parser::OnCISParser_Parsing()` (`Varian_Eclipse_ver13.cpp:94-228`)의 파싱 흐름:

1. **141~145줄** — CSV 전체 라인을 그대로 읽어 `m_astrings`에 저장 (헤더 검출 없음).
2. **152~172줄** — 첫 글자가 `'M'`이 아닌 줄(헤더, 빈 줄, 푸터 `,PatientId,equals,<value>` 등)을 전부 제거. 남은 `"Machine : ..."` 데이터 행에 대해서도 아래 조건에 해당하면 추가로 제거:
   ```cpp
   if (aTemp[3] == _T("QA") || aTemp[4].GetAt(aTemp[4].GetLength() - 1) == _T('1') || aTemp[19] == _T("Setup Field"))
   {
       m_astrings.RemoveAt(i);
   }
   ```
   - `aTemp[3]` = CourseId, `aTemp[4]` = **PlanSetupId**, `aTemp[19]` = PlannedMu
3. **176~181줄** — 필터링 후 남은 행이 0개(`m_nLine == 0`)이면 `PatInfo.m_ID`를 전혀 대입하지 않고 그대로 `return TRUE`.
4. **216줄** — 남은 행이 있을 때만 `m_NDFile.m_PatInfo.m_ID = Resultarray[0][1];` (고정 인덱스 1 = PatientId 컬럼)로 ID를 채움.

### 버그 지점

`aTemp[4]`(PlanSetupId)의 마지막 글자가 `'1'`인지를 검사하는 조건은, 정상 파일에서 보이는 `RadiationId`(인덱스 8)의 `LPO-1`, `RAO-1`, `RPO-1` 같은 "반복/서브 필드" 접미사를 걸러내려는 의도로 추정되나, 실제로는 **엉뚱한 컬럼(PlanSetupId, 인덱스 4)** 을 검사하고 있음.

- 문제 파일의 PlanSetupId 값은 `"C/D-1"` → 두 데이터 행 모두 `'1'`로 끝나 위 조건에 걸려 **둘 다 제거**됨 → `m_nLine == 0` → 176번 줄 조기 반환 경로를 타면서 216번 줄(ID 대입)에 도달하지 못함 → `PatInfo.m_ID`가 기본값(빈 문자열)로 남아 최종 XML의 `<ID/>`가 비게 됨.
- 정상 파일의 PlanSetupId 값은 `"Rt.Lung"` → `'1'`로 끝나지 않아 6개 행 모두 살아남고, `Resultarray[0][1]`에서 PatientId(`11861398`)가 정상 추출됨.

### 부가 확인 사항

- 모든 샘플 CSV에는 데이터 행 수와 무관하게 푸터에 `,PatientId,equals,<value>` 줄이 항상 존재함 (Eclipse가 명시적으로 내보내는 PatientId 값). 하지만 152번 줄의 `'M'` 필터에 의해 이 줄은 무조건 버려지고 있어, 현재 로직은 이 값을 전혀 활용하지 않음.
- 154번 줄 `m_astrings[i].GetAt(0)`은 빈 줄에 대한 `IsEmpty()` 가드가 없어, 빈 줄이 존재하는 경우 `CString::GetAt(0)` 범위 초과(디버그 ASSERT / 릴리즈 미정의 동작) 잠재 위험이 있음. 이번 이슈의 직접 원인은 아니나 동일 루프 내 잠재적 크래시 요인.

## 해결 방안

### 방안 A (권장) — 푸터 `,PatientId,equals,<value>` 를 PatientId의 주 소스로 사용

행 수/필터링 결과와 무관하게 항상 존재하는 푸터 값을 우선 사용하도록 하고, 빈 줄 접근도 함께 보호.

**① 145줄 뒤 — 필터링 전에 푸터 라인에서 PatientId 확보**
```cpp
CString strFooterPatientId = _T("");
for (int i = 0; i < m_astrings.GetCount(); i++)
{
    if (m_astrings[i].IsEmpty())
        continue;

    CStringArray aFooter;
    CISGF::DecodeCSV(m_astrings[i], aFooter);

    if (aFooter.GetCount() >= 4
        && aFooter[1] == _T("PatientId")
        && aFooter[2] == _T("equals"))
    {
        strFooterPatientId = aFooter[3];
        break;
    }
}
```

**② 154줄 — 빈 줄 보호**
```cpp
// 기존
if (m_astrings[i].GetAt(0) != 'M')
// 변경
if (m_astrings[i].IsEmpty() || m_astrings[i].GetAt(0) != 'M')
```

**③ 176~181줄 — 조기 반환 경로에서도 PatientId 채우기**
```cpp
if(m_nLine == 0)
{
    m_NDFile.m_PatInfo.m_ID = strFooterPatientId;   // 추가
    m_NDFile.m_Measurement.AddNumeric(NULL, _T("Result_1"), DATA_TYPE_TEXT, _T(""), _T("mmHg"), _T(""));
    tf.Close();
    return TRUE;
}
```

**④ 216줄 — 정상 경로에서 푸터 값 우선 사용**
```cpp
// 기존
m_NDFile.m_PatInfo.m_ID =  Resultarray[0][1];
// 변경
m_NDFile.m_PatInfo.m_ID = !strFooterPatientId.IsEmpty() ? strFooterPatientId : Resultarray[0][1];
```

### 방안 B (최소 수정) — `aTemp[4]/aTemp[8]` 열 인덱스 오류만 수정

행 필터 조건이 검사해야 할 컬럼을 PlanSetupId(4)에서 RadiationId(8)로 교정.

**167줄**
```cpp
// 기존
if (aTemp[3] == _T("QA") || aTemp[4].GetAt(aTemp[4].GetLength() - 1) == _T('1') || aTemp[19] == _T("Setup Field"))
// 변경
if (aTemp[3] == _T("QA") || aTemp[8].GetAt(aTemp[8].GetLength() - 1) == _T('1') || aTemp[19] == _T("Setup Field"))
```

**163~165줄 (디버그용 대입, 참조 컬럼 일관성 유지)**
```cpp
// 기존
tsd = aTemp[4].GetAt(aTemp[4].GetLength() - 1);
// 변경
tsd = aTemp[8].GetAt(aTemp[8].GetLength() - 1);
```

> ⚠️ 주의: 이 방식은 `aTemp[8]`(RadiationId)이 빈 문자열인 행이 있으면 `GetAt(-1)` 호출로 범위를 벗어나 크래시/ASSERT가 발생할 수 있음. 인덱스만 교정할 경우 이 가능성을 함께 검토 필요. 또한 이 방안은 "필터링으로 모든 행이 제거되는 경우"(`m_nLine == 0`) 자체를 막지는 못하므로, 근본적으로는 방안 A가 더 견고함.

## 참고 파일

- 파서 소스: `D:\Proj\CIS_LIB_2008\CISModalityLib\trunk\Source\RcvUX001\Varian_Eclipse_ver13.cpp`
- Receiver 설정: `D:\doc\이슈\260701-일산변원CSV파싱이슈\CISReceiver_eclipse - 복사본\CISReceiver_eclipse - 복사본\Receiver\FD6B7828-BB9E-4DE7-B4F2-28061873677F.xml`
- 정상/문제 CSV 샘플: `D:\doc\이슈\260701-일산변원CSV파싱이슈\`
- 문제 결과 XML: `D:\Proj\CIS_1400\trunk\BIN\Win32\ReleaseUnicode\Data\Interface2\20260701123402_0405AC38_8bz9simm_00000001_0001.xml`
