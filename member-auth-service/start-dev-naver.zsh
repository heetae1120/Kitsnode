#!/bin/zsh
# Interactive local test only. Credentials are read from the terminal, never
# passed as command arguments or written to files.
set -eu
cd -- "${0:A:h}"
if [[ ! -t 0 ]]; then
  print -u2 -- '터미널에서 직접 실행해 주세요.'
  exit 1
fi
if [[ ! -d node_modules/better-auth ]]; then
  print -u2 -- '인증 서버 의존성이 없습니다. 이 폴더에서 npm ci를 먼저 실행해 주세요.'
  exit 1
fi
if lsof -nP -iTCP:4313 -sTCP:LISTEN >/dev/null 2>&1; then
  print -u2 -- '4313 포트를 다른 서버가 사용 중입니다. 기존 서버를 종료한 후 다시 실행해 주세요.'
  exit 1
fi
print -n -- '네이버 로그인 Client ID: '
IFS= read -r NAVER_CLIENT_ID
print -n -- '네이버 로그인 Client Secret (입력 내용이 보이지 않습니다): '
IFS= read -rs NAVER_CLIENT_SECRET
print
if [[ -z "$NAVER_CLIENT_ID" || -z "$NAVER_CLIENT_SECRET" ]]; then
  print -u2 -- 'Client ID와 Client Secret을 모두 입력해 주세요.'
  exit 1
fi
export NAVER_CLIENT_ID NAVER_CLIENT_SECRET
trap 'unset NAVER_CLIENT_ID NAVER_CLIENT_SECRET' EXIT
MEMBER_AUTH_DEV_NAVER=1 node dev-naver-server.mjs
