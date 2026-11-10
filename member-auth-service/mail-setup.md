# 인증 메일 준비 (로컬 구현)

SENS MAIL v2 발송 어댑터가 준비되어 있으나 실제 계정·메일 전송·운영 연결은 검증하지 않았다. 운영 인증 서버는 아직 기동 차단 상태다. 자격 증명과 실제 수신자를 소스·문서·로그·테스트에 넣지 않는다.

## 서버 계약

`mail.mjs`의 `createSensMailSender`는 `serviceId`, `accessKey`, `secretKey`, 인증된 발신자 `from`, HTTPS 인증 서버 origin `authBaseURL`, 허용된 프론트 HTTPS origin의 배열 `redirectOrigins`을 받는다. 반환된 비동기 함수는 `{to, kind, url}`을 받으며 `kind`는 `verification` 또는 `reset`이다. 반환값 `{accepted:true, requestId}`는 네이버가 요청을 접수했음을 의미하며 메일 도착의 증거가 아니다.

서명은 `POST /mail/v2/services/{serviceId}/requests`와 epoch 밀리초, access key를 HMAC-SHA256으로 처리한다. 수신자 한 명만 TO로 전달하고 광고성 메일을 끈다. 인증 및 재설정 URL의 인증 서버 origin·경로와 callback origin을 제한한다. 실패나 모호한 응답은 민감한 공급자 오류를 노출하지 않는 일반 오류를 반환하고 자동 재발송하지 않는다. 공급자의 202 응답이라도 request ID와 단일 발송 건수가 없으면 결과 불명으로 처리한다. `requestId`나 오류에 인증 링크·비밀이 포함되지 않도록 저장·관찰 시스템을 별도로 검토해야 한다.

기존 `createSmtpMailSender`도 같은 발신자·수신자·링크 검증을 사용한다. SMTP TLS 465 또는 STARTTLS 필수 587만 허용한다. 두 전송 수단은 명시적으로 선택해야 하며 이 모듈은 환경 변수를 자동으로 읽거나 전송을 시작하지 않는다.

## 설정 전 준비

- SENS MAIL 프로젝트와 메일 서비스 ID, 인증된 발신자 주소·도메인 및 최소 권한 서브 계정 API 키를 안전한 비밀 저장소에서 제공한다. 공식 안내에 따라 발신 도메인 SPF·DKIM·DMARC 및 발송 가능 상태를 확인한다.
- 인증 서버와 프론트의 실제 HTTPS origin 및 인증·재설정 복귀 경로를 확정한다. `redirectOrigins`에는 실제 허용 origin만 넣고 wildcard를 사용하지 않는다. 사용자가 보낸 callback은 서버에서도 별도 검증해야 한다.
- 실제 사용 전 격리 서비스에서 주소·URL·서명·수신·만료·실패 및 중복 방지, 지연/비동기 배달 결과를 검증한다. 응답 유실 이후 자동 재시도하면 중복 메일이 생길 수 있으므로 운영 정책을 정한다.
- 제공자의 발송 이력 및 관찰 로그에 인증 URL과 개인 정보가 남는 범위, 보관 기간과 접근 권한을 검토한다. 인증 URL을 출력하거나 진단 데이터로 기록하지 않는다.

검증: `node --test mail.test.mjs auth.test.mjs`는 합성 주소·고정 가짜 키·mock 응답만 사용한다. 제공자 공식 [SENS 메일 발송 API](https://api.ncloud-docs.com/docs/sens-mail-request-create), [Ncloud API 서명](https://api.ncloud-docs.com/docs/common-ncpapi), [메일 도메인 안내](https://guide.ncloud-docs.com/docs/sens-troubleshoot-mail)를 기준으로 한다.
