# 네이버 광고 계정 연결과 운영자 검토

회원 연결 화면은 `/store/ads/connect/`, 운영자 검토 화면은 `/store/ads/review/`입니다. 실제 GitHub Pages 배포에서는 앞에 `/Kitsnode`가 붙습니다. 화면은 Supabase Edge Function `kitsnode-ad-api`에 연결하고, 기존 Vercel 키워드 API는 별도로 유지합니다.

회원이 광고 계정 번호를 제출하면 서버는 Supabase Auth 세션과 회원 동의를 확인하고 승인 대기 상태로 저장합니다. 운영자는 해당 광고주와 회원의 관계를 별도의 절차로 확인한 후 내부 확인 건 번호와 확인 방법을 기록합니다. 이는 운영자의 수동 확인 기록이며 자동 신원 인증이 아닙니다. 서버가 네이버 조회 권한을 별도로 확인해야 연결을 승인합니다. 확인 기록을 철회하면 연결도 해제됩니다. 기록은 30일 동안 승인에 사용할 수 있으며, 만료 자체가 기존 연결을 자동 해제하거나 기록을 삭제하지는 않습니다.

Edge Function의 `KITS_AD_OPERATOR_IDS`는 인증된 회원 ID를 검사하는 서버 전용 허용 목록입니다. 광고주 관계 증거와 개인정보의 확인·보존·삭제는 운영 절차에 따라야 하며 원본 문서와 개인정보를 내부 건 번호에 입력하지 않습니다. `NAVER_SEARCHAD_API_KEY`, `NAVER_SEARCHAD_SECRET_KEY` 및 Supabase 서비스 역할 키는 브라우저에 노출하지 않습니다.

자동 입찰은 중단 상태입니다. 이 함수에는 입찰 변경 API와 스케줄러가 없습니다. DB의 원자적 변경 확인값도 기본 false이며 해당 기능을 활성화하지 않습니다. 운영자 검토 목록은 최근 100건으로 제한됩니다.

## 검증

배포 전 실제 `kits` Supabase Auth 임시 회원과 네이버 읽기 API를 연결한 별도 테스트 테이블에서 브라우저 신청·승인·철회를 확인했습니다. 시험 확인 기록은 합성 데이터로 실제 광고주 관계 증명이 아닙니다. 테스트 인원과 기록 및 임시 함수는 삭제됐고 테스트 스키마는 남아 있습니다.

로컬에서는 `npm test`, `npm run typecheck`, `npm run build`, `node --test keyword-api/src/*.test.mjs`, `bash tests/sql/run-kitsnode-ads.sh`로 확인할 수 있습니다.
