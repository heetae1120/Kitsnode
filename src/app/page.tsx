"use client";
import {useEffect} from 'react';
import Link from 'next/link';
export default function Page(){
 useEffect(()=>{window.location.replace((process.env.NEXT_PUBLIC_BASE_PATH||'')+'/tools/');},[]);
 return <main><h1>KITSNODE</h1><Link href="/tools/">수익성 분석으로 이동</Link></main>;
}
