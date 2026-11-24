"use client";
import {Suspense} from 'react';
import {useSearchParams} from 'next/navigation';
import {MarketingPlanner} from '@/components/marketing-planner';

function DiagnosisRoute(){
 const params=useSearchParams();
 return <MarketingPlanner adCheckRoute={params.get('view')==='ad-check'}/>;
}

export default function Page(){
 return <Suspense fallback={<MarketingPlanner/>}><DiagnosisRoute/></Suspense>;
}
