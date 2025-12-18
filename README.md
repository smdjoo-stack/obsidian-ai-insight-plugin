# Obsidian AI Insight Plugin

Obsidian 노트를 읽고 AI를 활용하여 인사이트를 생성하거나 오디오 리뷰를 만드는 플러그인입니다.

## 기능

### AI 인사이트 생성
- 현재 노트의 내용을 분석하여 새로운 인사이트 노트를 생성합니다.
- 지원 AI: OpenAI GPT, Anthropic Claude, Google Gemini
- 인사이트 유형: 요약, 주요 포인트, 관련 질문, 액션 아이템

### 오디오 리뷰 생성
- 노트 내용을 바탕으로 팟캐스트 스타일의 오디오 리뷰를 생성합니다.
- 워크플로우: Gemini → ElevenLabs → Google Drive
- 생성된 오디오를 노트에 직접 삽입합니다.

## 설치

1. Obsidian에서 설정 > 커뮤니티 플러그인으로 이동합니다.
2. "Browse"를 클릭하고 "AI Insight Generator"를 검색합니다.
3. 설치하고 활성화합니다.

또는 수동 설치:
1. 이 리포지토리를 다운로드합니다.
2. `main.js`, `manifest.json`을 Obsidian vault의 `.obsidian/plugins/ai-insight-generator/` 폴더에 복사합니다.
3. Obsidian에서 플러그인을 활성화합니다.

## 설정

설정 탭에서 다음을 구성하세요:
- **AI 서비스 선택**: 사용할 AI를 선택합니다.
- **API 키**: 각 서비스의 API 키를 입력합니다.
  - Gemini: Google AI Studio에서 발급
  - OpenAI: OpenAI 계정에서 발급
  - Anthropic: Anthropic 계정에서 발급
  - ElevenLabs: ElevenLabs 계정에서 발급
  - Google Drive: OAuth 액세스 토큰

## 사용법

### 인사이트 생성
1. 노트를 열고 명령 팔레트에서 "Generate Insight from Current Note"를 실행합니다.
2. 새로운 인사이트 노트가 생성됩니다.

### 오디오 리뷰 생성
1. 노트를 열고 명령 팔레트에서 "Generate Audio Review"를 실행합니다.
2. 진행 상황이 표시되며, 완료되면 오디오 플레이어가 노트에 삽입됩니다.

## 개발

### 빌드
```bash
npm install
npm run build
```

### 기여
이슈나 풀 리퀘스트를 환영합니다!

## 라이선스

MIT License

## 지원

문제가 있거나 제안이 있으시면 GitHub 이슈를 열어주세요.