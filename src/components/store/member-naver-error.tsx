import React from 'react';

export function MemberNaverError({message, conflict, signupRequired, basePath}: {message:string; conflict:boolean; signupRequired:boolean; basePath:string}) {
  return <div role="alert">
    <p>{message}</p>
    {conflict && <p>이 네이버 계정으로 별도의 키츠노드 회원이 만들어졌을 수 있습니다. 해당 회원에 가입 정보나 다른 데이터가 저장되어 있을 수 있으니 먼저 확인해 주세요. 확인하려면 현재 계정에서 로그아웃한 뒤 회원가입 화면에서 해당 네이버 계정으로 로그인해 주세요.</p>}
    {(conflict || signupRequired) && <a href={`${basePath}/store/signup/`}>회원가입 화면으로 이동</a>}
  </div>;
}
