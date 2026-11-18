// Interactive local preparation only. This CLI does not transmit an invitation,
// accept one, connect existing Chrome sessions, or collect credentials.
import { createInterface } from 'node:readline/promises';
import { pathToFileURL } from 'node:url';
import { runLocalInvitePreparation } from './invite-local-preparation.mjs';

export async function runInviteLocalCli({args, input, output, puppeteer, run = runLocalInvitePreparation}) {
 const [executablePath,accountId,advertiserId,recipientId] = args;
 if (args.length !== 4 || !executablePath || !/^[1-9][0-9]{0,15}$/.test(accountId ?? '') ||
   !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(advertiserId ?? '') ||
   !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(recipientId ?? '') || advertiserId === recipientId) {
  output.write('사용법: node invite-local-cli.mjs <Chrome 실행 경로> <광고계정 번호> <광고주 ID> <수신자 ID>\n'); return 2;
 }
 const rl=createInterface({input,output});
 try {
  const result=await run({puppeteer,executablePath,accountId,advertiserId,recipientId,
   onWindowReady:async ({role})=>{
    const destination=role==='advertiser'
      ? `https://ads.naver.com/manage/ad-accounts/${accountId}/settings/authorities/members/invited`
      : 'https://ads.naver.com/settings/profile-info';
    const expected=role==='advertiser'?advertiserId:recipientId;
    await rl.question(`열린 ${role==='advertiser'?'광고주':'수신자'} 창에서 ${expected}로 직접 로그인하고 ${destination} 화면으로 이동한 후 Enter를 누르세요. 비밀번호는 터미널에 입력하지 마세요.\n`);
   },
   onPolicyReview:async ()=>{
    await rl.question('초대 정책을 확인하세요. 이 시험은 초대를 발송하지 않습니다. 종료하려면 Enter를 누르세요.\n');
   },
  });
  output.write(result.status==='prepared_only'?'초대 화면 준비를 확인했습니다. 초대는 발송되지 않았습니다.\n':'화면 또는 로그인 상태를 확인하지 못했습니다. 초대는 발송되지 않았습니다.\n');
  return result.status==='prepared_only'?0:1;
 } finally {rl.close();}
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
 try {
  const puppeteer=await import('puppeteer-core');
  process.exitCode=await runInviteLocalCli({args:process.argv.slice(2),input:process.stdin,output:process.stdout,puppeteer});
 } catch {
  process.stderr.write('브라우저 실행 구성요소를 불러오지 못했거나 세션 준비가 실패했습니다.\n');
  process.exitCode=1;
 }
}
