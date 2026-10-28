# KITS 로컬 개발

1. Node.js 24 LTS를 설치합니다.
2. GitHub 저장소를 내려받고 해당 폴더를 VS Code로 엽니다.
3. 터미널에서 다음 명령을 실행합니다.

```sh
npm ci
npm run dev
```

브라우저 주소창에 `http://localhost:3000`을 입력합니다. 브라우저는 자동으로 열리지 않습니다. 서버를 실행한 PC에서 접속해야 하며, 터미널의 `Ready` 표시를 확인하세요. 종료는 `Ctrl+C`입니다.

다른 포트는 `npm run dev -- --port 3001`을 사용합니다. Windows PowerShell의 실행 정책으로 npm.ps1 오류가 나면 `npm.cmd ci`, `npm.cmd run dev`를 사용하세요.

화면은 `src/app/page.tsx`, 디자인은 `src/app/globals.css`, 브랜드 콘텐츠와 제안서 로직은 `src/lib/brand.ts`에서 수정합니다. 저장하면 개발 화면에 반영됩니다.

검증은 `npm test`, `npm run build`, `npm run typecheck` 순서로 실행합니다. 변경을 `main`에 push하면 설정된 GitHub Pages 워크플로가 사이트를 새로 게시합니다. 프로젝트의 전체 구조와 배포 방식은 `README.md`를 확인하세요.
