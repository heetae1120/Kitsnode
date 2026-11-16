"use client";
import {useState,type InputHTMLAttributes} from 'react';
import {formatNumericInput,normalizeNumericInput} from '@/lib/numeric-input';
type Props=Omit<InputHTMLAttributes<HTMLInputElement>,'value'|'onChange'|'type'> & {value:string;onValueChange:(value:string)=>void};
export function FormattedNumberInput({value,onValueChange,...props}:Props){
 const [editing,setEditing]=useState(false);
 // Format only after the edit is committed. No deferred caret writes can race typing.
 return <input {...props} type="text" inputMode="decimal" value={editing?value:formatNumericInput(value)} onFocus={event=>{setEditing(true);props.onFocus?.(event);}} onBlur={event=>{setEditing(false);props.onBlur?.(event);}} onChange={event=>{
  const raw=normalizeNumericInput(event.currentTarget.value);if(raw!==null)onValueChange(raw);
 }}/>;
}
