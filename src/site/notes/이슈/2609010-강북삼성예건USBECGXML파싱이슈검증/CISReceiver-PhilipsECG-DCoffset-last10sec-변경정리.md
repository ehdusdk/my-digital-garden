---
{"dg-publish":true,"permalink":"//2609010-usbecgxml/cis-receiver-philips-ecg-d-coffset-last10sec/","dg-note-properties":{}}
---

# [변경 정리] DC Offset 보정 & 마지막-10초 옵션 — Philips TC-35 파서
[[이슈/2609010-강북삼성예건USBECGXML파싱이슈검증/CISReceiver-PhilipsECG-마지막10초옵션-검증-20260910\|CISReceiver-PhilipsECG-마지막10초옵션-검증-20260910]]
[[이슈/2609010-강북삼성예건USBECGXML파싱이슈검증/CISReceiver-PhilipsECG-동일검사-1대1검증-02914820\|CISReceiver-PhilipsECG-동일검사-1대1검증-02914820]]

- 대상: `CIS_LIB_2008\CISModalityLib\trunk\Source\PhilipsModality\Philips_TRIM3_Parser.cpp`
        `CIS_LIB_2008\CISLib\trunk\Source\CISECG\CISREWaveInfo.cpp`
- 기준 코드: 2026-09-10 07:27 버전
- 검증 완료: 2026-09-10 17:45 회차
- 관련 문서: `claude/CISReceiver-PhilipsECG-마지막10초옵션-검증-20260910.md` (부록 A~G)

---

## 0. 두 건 요약

| | 문제 | 조치 | 상태 |
|---|---|---|---|
| **① 마지막-10초 오프셋** | 정수 초 나눗셈이라 비정수 길이 기록에서 잘림 위치가 어긋남 | 샘플 수 기반으로 변경 + 복사 루프 정합 | ✅ ON/OFF 양쪽 검증 완료 |
| **② DC Offset** | USB(0.02 Hz) 원본의 DC 성분이 그대로 남아 흉부유도가 화면에서 최대 **37.8 mm** 이탈 | `m_nBaselineOffset` 에 리드별 중앙값 기록 (원본 데이터 불변) | ✅ 검증 완료 |

**두 건 모두 Network(500 Hz) 출력에는 영향이 없습니다.**

---

# ① 마지막-10초 옵션 (`last10sec`)

## 1-1. 배경

Philips 기록은 11초인데 표시·출력 규격은 10초입니다. `bWaveFormLast10Sec` 옵션이 켜지면 **앞 1초를 버리고 뒤 10초**를 사용합니다.

기존 코드는 **정수 초**로 계산했습니다.

```cpp
nRealOffset = nRealSec > 10 ? (nRealSec - 10) * nSamplRate : 0;
//            ^^^^^^^^ nRealSec = nSampleCnt / nSamplRate (정수 나눗셈)
```

- 11초 기록에서는 맞지만, **10.5초 같은 비정수 길이에서 `nRealSec`가 10으로 절삭**되어 오프셋이 0이 됩니다
- 즉 "마지막 10초"가 아니라 "앞 10초"가 나옵니다

## 1-2. 변경 — 샘플 수 기반 (1480~1491행)

```cpp
bool bWaveFormLast10Sec = pECGSetting->GetWaveFormLast10Sec();
if(bWaveFormLast10Sec && nSampleCnt > nDstCnt)
{
    // [Fix] 정수 "초"가 아니라 "샘플 수"로 계산한다.
    //       11초/500Hz -> 500, 11초/1000Hz -> 1000 (기존과 동일)
    //       10.5초 같은 비정수 기록에서도 정확히 마지막 10초가 잡힌다.
    nRealOffset = nSampleCnt - nDstCnt;
}
else
{
    nRealOffset = 0;
}
```

`nDstCnt` 는 1379행에서 한 번 정의해 재사용합니다.

```cpp
int nDstCnt = nSamplRate * 10;                                  // 1379행
ECGOut.m_WaveInfo.AllocStandard12Lead(nDstCnt, nSamplRate, …);  // 1381행
```

### 동작 비교

| 기록 | 기존 식 | 새 식 | |
|---|---|---|---|
| 11초 / 500 Hz | (11−10)×500 = **500** | 5500−5000 = **500** | 동일 |
| 11초 / 1000 Hz | (11−10)×1000 = **1000** | 11000−10000 = **1000** | 동일 |
| 10.5초 / 500 Hz | 정수절삭 → **0** | 5250−5000 = **250** | 새 식이 정확 |
| 9초 / 1000 Hz | **0** | 조건 미충족 → **0** | 동일 |

**현행 11초 데이터에서는 값이 완전히 같아 회귀가 없습니다.**

## 1-3. 함께 정리한 복사 루프 (1516~1547행)

```cpp
int nLeadStart = nRealOffset;      // 리드 내부 시작 오프셋

for(i = 0; i < nLeadCnt; i++)
{
    Lead      = aLead[i];
    pREWave   = ECGOut.m_WaveInfo.GetWave(Lead);
    if(pREWave == NULL) continue;                       // [Add] 라벨 매핑 실패 방어
    pWaveData = pREWave->GetWaveBuffer();
    if(pWaveData == NULL) continue;                     // [Add]

    int nDstCount = pREWave->GetSampleCount();
    int nAvail    = nSampleCnt - nLeadStart;
    int nCopy     = (nAvail < nDstCount) ? nAvail : nDstCount;   // [Add] clamp

    if(nCopy > 0)
        memcpy(pWaveData, &pReal[(int)i * nSampleCnt + nLeadStart], sizeof(short) * nCopy);
    …
}
```

- **리드 인덱스(`i * nSampleCnt`)와 리드 내부 오프셋(`nLeadStart`)을 분리** — 기존 누적 방식(`nRealOffset += nSampleCnt`)과 결과는 같지만 의미가 명확해지고 clamp 계산이 가능해집니다
- **clamp 추가** — 10초 미만 기록에서 다음 리드 영역 침범/버퍼 밖 읽기 방지
- **NULL 가드 추가** — `GetWave()` 가 NULL 을 반환할 수 있음(`FindWave` 실패 시). 기존에는 `ASSERT` 뿐이라 Release 에서 크래시

## 1-4. 페이싱 마커 오프셋 보정 (1548~1563행) — 신규

`m_PacingPulse` 는 **파형 버퍼의 샘플 인덱스**로 저장되어 `CISREOBJ_EcgPage.cpp` 460/470행에서 그대로 X 좌표로 쓰입니다. 파형만 당기면 마커가 그만큼 밀립니다.

```cpp
if(nRealOffset > 0)
{
    CUIntArray& arPulse = ECGOut.m_WaveInfo.m_PacingPulse;
    for(int k = (int)arPulse.GetSize() - 1; k >= 0; k--)   // 역순: RemoveAt 시 인덱스 밀림 방지
    {
        int nPos = (int)arPulse[k] - nRealOffset;
        if(nPos < 0 || nPos >= nDstCnt)
            arPulse.RemoveAt(k);        // 잘려나간 구간의 마커는 버린다
        else
            arPulse[k] = (UINT)nPos;
    }
}
```

> ⏸ **이 블록만 아직 미검증입니다.** 테스트에 쓴 XML 이 전부 `pacepulse` 0개라 실행된 적이 없습니다.

## 1-5. 검증 결과

| 옵션 | 로그 | 시작 위치 (소스 대비) | 상관 | 표시 구간 |
|---|---|---|---|---|
| **ON** (17:20) | `nRealOffset[500]` / `[1000]`, `bWaveFormLast10Sec(TRUE)` | NET 500샘플 / USB 1000샘플 = **정확히 1초** | 1.000000 | 1~11초 |
| **OFF** (17:45) | `nRealOffset[0]`, `bWaveFormLast10Sec(FALSE)` | NET 0 / USB 0 = **0 ms** | 1.000000 | 0~10초 |

두 회차의 `<Data>` 가 서로 다르고, 각각 원본과 **상관계수 1.0000** 으로 완전 일치합니다.

---

# ② DC Offset 보정

## 2-1. 배경 — 왜 필요했나

USB export 는 장비 내부 아카이브 원본이라 **hipass 0.02 Hz** 광대역입니다.

| | hipass | 시정수 τ = 1/(2πf) | 10초 기록에서 DC 제거 |
|---|---|---|---|
| Network | 0.05 Hz | 약 3.2초 | 상당히 제거됨 |
| **USB** | **0.02 Hz** | **약 8초** | **거의 안 빠짐** |

파서는 원본을 충실히 전달하므로(검증 결과 corr 1.0000) **DC 가 화면까지 그대로 옵니다.**

12리드 레이아웃은 각 리드를 자기 2.5초 구간만 그리는데, 그 구간의 기저선이 이만큼 벗어났습니다.

| 리드 | NET | **USB** |
|---|---|---|
| V1 | −0.2 mm | **−20.0 mm** |
| V2 | +3.2 mm | **+30.2 mm** |
| V4 | −0.8 mm | **−17.1 mm** |
| V5 | +1.6 mm | **−10.9 mm** |
| V6 | +0.8 mm | **−37.8 mm** |

(10 mm/mV 기준. 한 행 높이를 훌쩍 넘어 옆 행 침범)

## 2-2. 왜 `m_nBaselineOffset` 인가

`CISREOBJ_EcgPage.cpp` 의 9개 렌더 경로가 전부 동일한 공식을 씁니다.

```cpp
rBaseline = (REAL)pREWave->m_nBaselineOffset;
…
pPTs[nPTPos].Y = rStartY + ((rBaseline - (REAL)pWaveData[nWaveIdx]) * rRatioY);
//                           ^^^^^^^^^   ^^^^^^^^^^^^^^^^^^^^^^^^
//                           원시 short 샘플과 직접 뺄셈 → 단위가 같다(LSB)
```

**샘플 데이터를 하나도 건드리지 않고 표시 위치만 이동**시킬 수 있습니다.

> ⚠️ 단위 주의: 헤더 주석은 `Unit="uV"` 라고 되어 있지만 **실제 코드는 LSB** 입니다.
> USB 는 1.0 µV/LSB 라 값이 같지만 **Network 는 5.0 µV/LSB 라 5배 차이**가 납니다.

### 부작용 전수 점검 결과

| 소비처 | 영향 |
|---|---|
| JPG 리포트 렌더링 (`CISREOBJ_EcgPage.cpp` 9곳) | ✅ 의도한 중앙 정렬 |
| 출력 XML `<BaselineOffset>` (`CISREWave.cpp` 158 기록 / 110 복원) | ✅ 라운드트립 정상 |
| **DICOM 내보내기** (`CISDicom.cpp` 858행) | ✅ `DCM_ChannelBaseline` 에 **`"0"` 하드코딩** → 영향 없음 |
| DICOM 읽기 (`CISDicom.cpp` 1109행) | ✅ 반대 방향이라 무관 |
| 뷰어 파형 오브젝트 (`CISREOBJ_Wave.cpp` 435~468) | ⚠️ `m_bInvertWave=TRUE` 에서만 부호 반대 (기존 라이브러리 비대칭, 기본 경로는 정상) |

## 2-3. 변경 — 헬퍼 추가 (1219~1241행)

```cpp
// 26/09/10 by dykim [Add] 표시용 기저선 계산 헬퍼
static int CompareShort(const void* a, const void* b)
{
    short x = *(const short*)a;
    short y = *(const short*)b;
    return (x < y) ? -1 : ((x > y) ? 1 : 0);
}

// 리드 1개의 중앙값(LSB)을 구한다.
// 평균이 아니라 중앙값을 쓰는 이유: QRS 같은 큰 편위에 덜 끌린다.
static int GetWaveMedian(const short* p, int n)
{
    if(p == NULL || n <= 0) return 0;

    CArray<short, short> ar;
    ar.SetSize(n);
    for(int k = 0; k < n; k++)
        ar[k] = p[k];

    qsort(ar.GetData(), n, sizeof(short), CompareShort);
    return (int)ar[n / 2];
}
```

`CompareShort` 가 `GetWaveMedian` 보다 **앞에** 있어야 합니다. 비용은 12리드 × 10,000샘플 qsort ≈ 수 ms.

## 2-4. 변경 — 복사 루프 안에서 기록 (1538~1543행)

```cpp
// 렌더러 Y = (m_nBaselineOffset - sample) * ratio 로 쓰므로
// 중앙값(LSB)을 넣으면 원본 훼손 없이 중앙 정렬된다.
// 임계값(1 mV) 미만은 건드리지 않아 network 출력은 종전과 완전히 동일하게 유지됨.
if(nCopy > 0 && dRefAmplitude > 0.0)
{
    int nMedian    = GetWaveMedian(pWaveData, nCopy);   // LSB
    int nThreshold = (int)(1000.0 / dRefAmplitude);     // 1 mV → LSB
    pREWave->m_nBaselineOffset = (abs(nMedian) > nThreshold) ? nMedian : 0;
}
```

복사 직후의 `pWaveData` 가 최종 데이터이므로 **기존 루프 안에서 그대로** 계산합니다(별도 순회 불필요).

### 임계값 1 mV 의 근거 (실측, 전체 10초 버퍼 중앙값)

| 리드 | NET LSB | 임계 200 | USB LSB | 임계 1000 |
|---|---|---|---|---|
| I~aVF, V3 | −22 ~ 138 | 미달 | −120 ~ 132 | 미달 |
| **V1** | −22 | 미달 | **−2,080** | **적용** |
| **V2** | 138 (690 µV) | 미달 | **3,069** | **적용** |
| **V4** | −43 | 미달 | **−1,761** | **적용** |
| **V5** | 5 | 미달 | **−1,435** | **적용** |
| **V6** | −116 (−580 µV) | 미달 | **−4,253** | **적용** |

- **Network 최대 690 µV** → 전 리드 미달 → 오프셋 0 → **출력 완전 무변화**
- **USB 보정 대상 최소 1,435 µV** → 문제 리드 5개만 정확히 걸림

임계값은 690 ~ 1,435 µV 사이면 성립하며, **1 mV = 화면 10 mm** 라 기준으로 삼기 좋습니다.

## 2-5. 부수 수정 — Lead III `FillZero()` 누락 (`CISREWaveInfo.cpp` 520~524행)

`AllocStandard12Lead()` 에서 **Lead III 만** `FillZero()` 호출이 빠져 있었습니다. `AllocWaveEx` 의 `bFillZero` 기본값이 FALSE 이고 `AllocBinary` 는 `new BYTE[]` 만 하므로 **초기화되지 않은 힙 값**이 남습니다.

```cpp
pREWave = new CISREWave();
pREWave->AllocWaveEx(cis_ecg_lead_III, dwSampleCount, nSamplingRate, dAmplitude, dExtraAmplitude);
// 26/09/09 by dykim LEAD III 에 FileZero() method call added. 기존에 빠져 있었음
pREWave->FillZero();        // [Add]
m_WAVEs.Add(pREWave);
```

clamp 가 실제로 발동하는 경우(10초 미만 기록)나 `continue` 로 건너뛴 리드에서 쓰레기 값이 파형으로 나가는 것을 막습니다.

## 2-6. 검증 결과

`<BaselineOffset>` 이 데이터 구간에 맞춰 재계산됩니다.

| 리드 | USB OFF (0~10s) | USB ON (1~11s) | NET (양쪽) |
|---|---|---|---|
| V1 | −2,185 | −2,080 | **0** |
| V2 | 3,021 | 3,069 | **0** |
| V4 | −1,790 | −1,761 | **0** |
| V5 | −1,544 | −1,435 | **0** |
| V6 | −4,345 | −4,253 | **0** |
| 그 외 7개 | 0 | 0 | **0** |

- 구간이 바뀌니 중앙값도 따라 변함 → 로직이 데이터에 맞춰 동작 ✅
- **Network 는 옵션과 무관하게 전 리드 `0`** → 회귀 없음 ✅
- `<Data>` 샘플 값은 보정 전후 **완전히 동일** → 원본 훼손 없음 ✅

## 2-7. 이 방식의 한계

`m_nBaselineOffset` 은 리드당 **상수 하나**이므로 **DC 오프셋만** 잡습니다. 10초 동안 서서히 흔들리는 baseline wander 는 남습니다.

- 이번 02914820 케이스는 DC 가 지배적이라 이것으로 충분합니다
- 흔들림까지 펴려면 고역통과 필터가 필요하고, 그건 **샘플 값을 바꾸는 영역**(DB/CDW 로 나가는 값까지 변경)이라 별도 판단이 필요합니다

---

# ③ 전체 변경 파일·위치 일람

## `Philips_TRIM3_Parser.cpp`

| 행 | 구분 | 내용 |
|---|---|---|
| 1219~1241 | **신규** | `CompareShort()` / `GetWaveMedian()` 헬퍼 |
| 1379 | 정리 | `int nDstCnt = nSamplRate * 10;` 을 위로 올려 재사용 |
| 1480~1491 | **수정** | 마지막-10초 오프셋을 샘플 수 기반으로 |
| 1493~1504 | **수정** | 진단 로그에 `durationMs` / `nDstCnt` / `nRealOffset` / `compress` / `expandedBytes` 추가 |
| 1516~1532 | **수정** | 복사 루프 — 리드 인덱스와 내부 오프셋 분리, clamp, NULL 가드 |
| 1538~1543 | **신규** | `m_nBaselineOffset` 기록 (중앙값 + 1 mV 임계) |
| 1548~1563 | **신규** | 페이싱 마커 오프셋 보정 ⏸ 미검증 |

## `CISREWaveInfo.cpp`

| 행 | 구분 | 내용 |
|---|---|---|
| 522~523 | **수정** | Lead III `FillZero()` 추가 (기존 누락) |

---

# ④ 회귀 영향 정리

| 항목 | Network (500 Hz / 5 µV) | USB (1000 Hz / 1 µV) |
|---|---|---|
| 마지막-10초 오프셋 식 변경 | **없음** (11초 기록에서 500 → 500 동일) | 정상 산출 |
| 복사 루프 정리 | 없음 (결과 동일) | 없음 |
| clamp / NULL 가드 | 없음 (미발동) | 없음 |
| **`m_nBaselineOffset` 기록** | **없음** (전 리드 `0`, 임계 미달) | 흉부유도 5개만 보정 |
| Lead III `FillZero()` | 없음 (정상 케이스는 전체 덮어씀) | 없음 |
| 진단 로그 포맷 | ⚠️ 로그를 기계 파싱하는 모듈이 있으면 확인 필요 | 동일 |

---

# ⑤ 남은 항목

| # | 항목 | 비고 |
|---|---|---|
| 1 | **페이싱 마커 보정 검증** | 테스트 XML 에 `pacepulse` 0개라 미실행. 아래 삽입 후 **옵션 ON** 으로 확인 |
| 2 | 10초 미만 기록에서 clamp 동작 | `durationperchannel` 축소 XML 로 확인 |
| 3 | V1.03 / V1.04.02 회귀 | 샘플 파일 확보 시 |
| 4 | baseline wander(저주파 흔들림) 처리 여부 | 필요성 판단 후 별도 과제 |

```xml
<!-- 페이싱 마커 검증용 삽입 (internalmeasurements/crossleadmeasurements/pacepulses) -->
<pacepulses>
  <pacepulse starttime="3000"/>   <!-- 1000Hz 기준 샘플 2000 으로 이동해야 함 -->
  <pacepulse starttime="500"/>    <!-- 잘려나간 구간 → 제거되어야 함 -->
</pacepulses>
```

산출물 XML 의 `<PacingPulse>` 값으로 확인합니다.
