---
{"dg-publish":true,"permalink":"//obsidian-claude-mcp/","tags":["obsidian","claude","mcp","설정가이드"],"dg-note-properties":{"tags":["obsidian","claude","mcp","설정가이드"],"created":"2026-05-28"}}
---

# Obsidian + Claude Desktop + MCP 설치 및 설정 가이드 (Windows)

> [[매뉴얼/매뉴얼 인덱스\|← 매뉴얼 목록으로]]

> 이 가이드는 Obsidian 볼트를 Claude Desktop과 MCP(Model Context Protocol)로 연결하여  
> AI 기반 노트 검색 및 자동화 환경을 구축하는 방법을 단계별로 정리한 문서입니다.

---

## 전체 구성도

```text
Obsidian Vault (.md 파일)
        ↕
  MCP Server (obsidian-mcp)
        ↕
  Claude Desktop
```

---

## 1단계 — 사전 준비 소프트웨어 설치

### 1-1. Obsidian 설치

- 공식 다운로드: https://obsidian.md
- 설치 후 Vault 폴더 생성 (예: `D:\ObsidianVault`)
- 추천 폴더 구조:
  ```text
  Vault/
  ├── Daily/
  ├── Projects/
  ├── Dev/
  └── Meeting/
  ```

### 1-2. Node.js 설치

- 공식 다운로드: https://nodejs.org (LTS 버전 권장)
- 설치 확인:
  ```bash
  node -v
  npm -v
  ```

### 1-3. Claude Desktop 설치

- 공식 다운로드: https://claude.ai/download
- Anthropic 계정 로그인 필요
- Claude Pro 플랜 권장 (MCP 기능 사용 시)

---

## 2단계 — MCP 서버 설치

### 2-1. obsidian-mcp 설치 (npx 방식 — 설치 불필요)

> `npx`를 사용하면 별도 전역 설치 없이 실행 가능합니다.

```bash
npx obsidian-mcp
```

또는 전역 설치 방식:

```bash
npm install -g obsidian-mcp
```

### 2-2. 설치 확인

```bash
npx obsidian-mcp --version
```

---

## 3단계 — Claude Desktop MCP 설정

### 3-1. 설정 파일 위치 (Windows)

```text
C:\Users\<사용자명>\AppData\Roaming\Claude\claude_desktop_config.json
```

> `AppData` 폴더가 보이지 않으면 탐색기 → 보기 → 숨긴 항목 체크

### 3-2. 설정 파일 작성

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "npx",
      "args": [
        "-y",
        "obsidian-mcp",
        "D:\\ObsidianVault"
      ]
    }
  }
}
```

> `D:\\ObsidianVault` 부분을 실제 Vault 경로로 변경  
> Windows 경로는 백슬래시(`\`)를 두 번(`\\`) 써야 합니다.

### 3-3. 복수 Vault 연결 (선택)

```json
{
  "mcpServers": {
    "obsidian-work": {
      "command": "npx",
      "args": ["-y", "obsidian-mcp", "D:\\WorkVault"]
    },
    "obsidian-personal": {
      "command": "npx",
      "args": ["-y", "obsidian-mcp", "D:\\PersonalVault"]
    }
  }
}
```

---

## 4단계 — Claude Desktop 재시작 및 연결 확인

### 4-1. Claude Desktop 완전 종료 후 재실행

- 작업 표시줄 트레이 아이콘 우클릭 → 종료
- 다시 실행

### 4-2. MCP 연결 확인

Claude Desktop 대화창에서 아래와 같이 입력:

```text
내 Obsidian 노트 목록 보여줘
```

정상 연결 시 볼트 내 노트 목록이 출력됩니다.

### 4-3. 오류 발생 시 확인 항목

| 항목 | 확인 방법 |
|---|---|
| Node.js 설치 여부 | `node -v` 출력 확인 |
| Vault 경로 오류 | JSON 내 경로 `\\` 이중 슬래시 확인 |
| JSON 문법 오류 | https://jsonlint.com 에서 검증 |
| Claude 재시작 여부 | 완전 종료 후 재실행 확인 |

---

## 5단계 — 활용 예시 (Claude에게 말하기)

```text
"내 Python 관련 노트 요약해줘"
"이번 달 회의 노트 찾아줘"
"프로젝트 Alpha 관련 문서 정리해줘"
"중복된 내용이 있는 노트 찾아줘"
"새 노트 만들어줘 — 제목: Docker 설치 가이드"
```

---

## 6단계 — 추천 Obsidian 플러그인 (선택)

| 플러그인 | 역할 |
|---|---|
| Dataview | 메타데이터 기반 쿼리 검색 |
| Omnisearch | 고급 전문 검색 |
| Smart Connections | AI 유사도 기반 노트 추천 |
| Templater | 노트 템플릿 자동화 |
| Git | 볼트 버전관리 (GitHub 연동) |

---

## 주의사항 및 보안

Claude MCP는 Vault 내 **모든 파일을 읽을 수 있습니다**.  
아래 항목은 Vault 외부에서 별도 관리를 권장합니다.

- API Key / 인증 토큰
- 개인정보가 포함된 문서
- 회사 기밀 문서
- 패스워드 파일

---

## 전체 요약

| 단계 | 작업 내용 |
|---|---|
| 1단계 | Obsidian + Node.js + Claude Desktop 설치 |
| 2단계 | obsidian-mcp 설치 (`npx` 또는 `npm install -g`) |
| 3단계 | `claude_desktop_config.json` 작성 및 Vault 경로 설정 |
| 4단계 | Claude Desktop 재시작 후 연결 확인 |
| 5단계 | Claude에게 자연어로 노트 검색 및 작업 요청 |
| 6단계 | 필요 시 추가 플러그인 설치 |

---

## 관련 문서

- [[매뉴얼/Obsidian_Wiki_LLM_Claude_통합_가이드\|매뉴얼/Obsidian_Wiki_LLM_Claude_통합_가이드]]
- [[매뉴얼/Obsidian_백업_및_복원_가이드\|매뉴얼/Obsidian_백업_및_복원_가이드]]
