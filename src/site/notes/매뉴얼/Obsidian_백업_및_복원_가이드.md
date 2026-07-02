---
{"dg-publish":true,"permalink":"//obsidian/","tags":["obsidian","백업","복원","가이드"],"dg-note-properties":{"tags":["obsidian","백업","복원","가이드"],"created":"2026-05-29"}}
---

# Obsidian 백업 및 복원 가이드

> [[매뉴얼/매뉴얼 인덱스\|← 매뉴얼 목록으로]]

---

## 1. 수동 백업 (가장 간단)

### 백업
Obsidian의 Vault 폴더 전체를 복사해서 안전한 위치에 붙여넣기.

```
예: D:\Obsidian-HIE\HIE-dykim (1)  →  외장드라이브 또는 다른 폴더에 복사
```

- `.obsidian/` 폴더 포함 복사 → 설정, 플러그인, 테마까지 백업됨
- 주기적으로 날짜 폴더명으로 관리 권장 (`HIE-dykim_2026-06-01` 등)

### 복원
백업한 폴더를 원하는 위치에 붙여넣고, Obsidian에서 **Open folder as vault** 로 열기.

---

## 2. Git 백업 (버전 관리)

### 초기 설정
```bash
cd "D:\Obsidian-HIE\HIE-dykim (1)"
git init
git remote add origin https://github.com/본인계정/vault이름.git
```

### Obsidian Git 플러그인 사용 (권장)
- Community Plugin에서 **Obsidian Git** 설치
- 설정에서 자동 커밋 주기 지정 (예: 10분마다)
- 변경 시 자동으로 `git commit` + `git push`

### 복원
```bash
git clone https://github.com/본인계정/vault이름.git
```
이후 Obsidian에서 해당 폴더를 vault로 열기.

> **주의:** API 키, 비밀번호 등 민감 정보는 `.gitignore`에 추가할 것

---

## 3. 클라우드 백업

### OneDrive / Google Drive / iCloud
Vault 폴더를 클라우드 동기화 폴더 안에 위치시키면 자동 백업.

```
예: C:\Users\사용자\OneDrive\Obsidian\HIE-dykim
```

- 실시간 동기화로 별도 조작 불필요
- 버전 히스토리는 클라우드 서비스 기능에 따라 다름 (OneDrive: 30일~)

### 복원
클라우드에서 폴더 다운로드 후 Obsidian에서 vault로 열기.

---

## 4. Obsidian Sync (공식 유료 서비스)

- 월 $8 (Sync 플랜)
- 버전 히스토리 1년 보관
- 멀티 디바이스 동기화 기본 지원
- 설정: **Settings → Sync** 에서 활성화

---

## 비교 요약

| 방법 | 비용 | 자동화 | 버전 관리 | 추천 상황 |
|------|------|--------|-----------|-----------|
| 수동 복사 | 무료 | ❌ | ❌ | 간단한 일회성 백업 |
| Git | 무료 | ✅ (플러그인) | ✅ | 개발자, 변경 이력 중요 시 |
| 클라우드 | 무료~유료 | ✅ | 제한적 | 멀티 디바이스 사용 시 |
| Obsidian Sync | 유료 | ✅ | ✅ (1년) | 간편함 + 공식 지원 원할 때 |

---

## 참고 링크
- [Obsidian Git 플러그인](https://github.com/denolehov/obsidian-git)
- [Obsidian 공식 Sync 안내](https://obsidian.md/sync)

---

## 관련 문서

- [[매뉴얼/Obsidian_Claude_MCP_설치_설정_가이드\|매뉴얼/Obsidian_Claude_MCP_설치_설정_가이드]]
