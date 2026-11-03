"use client";
import type {InputHTMLAttributes} from 'react';
import {formatNumericInput,normalizeNumericInput} from '@/lib/numeric-input';
type Props=Omit<InputHTMLAttributes<HTMLInputElement>,'value'|'onChange'|'type'> & {value:string;onValueChange:(value:string)=>void};
export function FormattedNumberInput({value,onValueChange,...props}:Props){
 return <input {...props} type="text" inputMode="decimal" value={formatNumericInput(value)} onChange={event=>{
  const input=event.currentTarget;const raw=normalizeNumericInput(input.value);if(raw===null)return;
  const digits=input.value.slice(0,input.selectionStart??input.value.length).replaceAll(',','').length;
  const formatted=formatNumericInput(raw);let caret=0,count=0;
  while(caret<formatted.length&&count<digits){if(formatted[caret]!==',')count++;caret++;}
  onValueChange(raw);requestAnimationFrame(()=>{if(document.activeElement===input)input.setSelectionRange(caret,caret);});
 }}/>;
}
