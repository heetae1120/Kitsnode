"use client";
import {useEffect} from 'react';
import Link from 'next/link';
export default function Page(){
 useEffect(()=>{window.location.replace((process.env.NEXT_PUBLIC_BASE_PATH||'')+'/tools/start/');},[]);
 return <main><h1>KITSNODE</h1><Link href="/tools/start/">수익 진단 시작하기</Link></main>;
}
