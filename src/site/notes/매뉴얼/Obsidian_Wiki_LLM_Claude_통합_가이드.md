---
{"dg-publish":true,"permalink":"//obsidian-wiki-llm-claude/","tags":["obsidian","claude","llm","wiki","가이드"],"dg-note-properties":{"tags":["obsidian","claude","llm","wiki","가이드"],"created":"2026-05-28"}}
---

# Obsidian + Wiki + LLM + Claude 통합 검색 및 문서화 가이드

> [[매뉴얼/매뉴얼 인덱스\|← 매뉴얼 목록으로]]

---

## 개요

이 문서는 아래 두 가지 주제를 중심으로 정리한 가이드입니다.

1. Obsidian Markdown 파일을 Wiki 시스템으로 업로드/배포하는 방법
2. Obsidian + Claude + LLM 기반 통합 검색 시스템 구축 방법

---

# 1. Obsidian Markdown 파일을 Wiki에 업로드하는 방법

## 핵심 개념

Obsidian은 기본적으로 다음 파일들을 관리합니다.

- Markdown(.md)
- 이미지(.png, .jpg)
- 첨부파일(pdf 등)
- wikilink (`[[문서]]`)

즉:

```text
Obsidian Vault → 다른 Wiki 시스템으로 변환/배포
```

의 문제로 볼 수 있습니다.

---

## 가장 추천하는 구성

```text
Obsidian + Git + GitHub + MkDocs + GitHub Actions
```

특징:
- Markdown 기반
- 이미지 자동 포함
- Git 기반 버전관리
- 자동 배포 가능
- 검색 기능 제공
- 무료 운영 가능

---

## MkDocs 설치 및 설정

```bash
pip install mkdocs-material
pip install mkdocs-obsidian-links
```

`mkdocs.yml` 예시:

```yaml
site_name: My Wiki

theme:
  name: material

plugins:
  - search
  - ezlinks
```

---

## GitHub Actions 자동 배포

```yaml
name: deploy

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pip install mkdocs-material
      - run: mkdocs gh-deploy --force
```

---

## 용도별 추천 조합

| 목적 | 추천 |
|---|---|
| 개인 위키 | Obsidian + MkDocs |
| 개발 문서 | Obsidian + MkDocs Material |
| 팀 위키 | Confluence |
| 공개 기술 블로그 | Obsidian + GitHub Pages |
| 연구 노트 | Obsidian + Quartz |

---

## 주의할 점

다음 Obsidian 기능은 일반 Wiki에서 깨질 수 있습니다.

- `[[wikilink]]`
- `![[image]]`
- canvas / dataview / callout / embedded note

---

# 2. Obsidian + Claude + LLM 통합 검색 시스템

## 핵심 구성 요소

| 구성 | 역할 |
|---|---|
| Obsidian | 노트 저장소 |
| Claude Desktop | AI 인터페이스 |
| MCP | Claude와 Obsidian 연결 |
| Git/GitHub | 버전관리 |
| Vector Search | 의미 기반 검색 |

---

## 입문용 추천 구성

```text
Obsidian + Claude Desktop + Obsidian MCP Server
```

---

## 고급 방식 — Vector DB + RAG

```text
Obsidian → Embedding → Vector DB → LLM Search
```

| 툴 | 역할 |
|---|---|
| ChromaDB | 벡터 DB |
| Qdrant | 벡터 검색 |
| Ollama | 로컬 LLM |
| LangChain | RAG 구성 |
| LlamaIndex | 문서 검색 |

---

## 추천 플러그인

| 플러그인 | 역할 |
|---|---|
| Dataview | 메타데이터 검색 |
| Omnisearch | 고급 검색 |
| Smart Connections | AI 유사도 검색 |
| Copilot | ChatGPT/Claude 연결 |
| Web Clipper | 웹 저장 |

---

## 추천 로드맵

| 단계 | 추천 |
|---|---|
| 입문 | Obsidian + Claude Desktop |
| 초급 | MCP 연결 |
| 중급 | Claude Code |
| 고급 | Vector DB |
| 전문가 | Multi-Agent + RAG |

---

## 최종 추천 구성

```text
Obsidian + GitHub + MkDocs + Claude Desktop + MCP
```

---

## 관련 문서

- [[매뉴얼/Obsidian_Claude_MCP_설치_설정_가이드\|매뉴얼/Obsidian_Claude_MCP_설치_설정_가이드]]
- [[매뉴얼/Obsidian_백업_및_복원_가이드\|매뉴얼/Obsidian_백업_및_복원_가이드]]
