'use client';
import {createContext} from 'react';
import type {ReportEvidence} from '@/lib/diagnosis-analysis';
export const ReportEvidenceContext=createContext<((evidence:Partial<ReportEvidence>)=>void)|null>(null);
