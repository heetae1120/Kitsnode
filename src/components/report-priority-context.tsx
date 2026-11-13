"use client";
import {createContext} from 'react';
import type {keywordGoalDiagnostics} from '@/lib/keyword-goal';
export type ReportDiagnostic=ReturnType<typeof keywordGoalDiagnostics>;
export const ReportPriorityContext=createContext<((diagnostic:ReportDiagnostic)=>void)|null>(null);
