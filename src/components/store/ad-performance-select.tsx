'use client';

import {useEffect, useRef, useState, type KeyboardEvent} from 'react';

type Option = {value: string; label: string};

/** A select-only combobox whose list is aligned below the field on every platform. */
export function AdPerformanceSelect({id, value, options, disabled, onChange}: {id:string; value:string; options:Option[]; disabled:boolean; onChange:(value:string)=>void}) {
 const [open,setOpen]=useState(false),[active,setActive]=useState(0);
 const root=useRef<HTMLDivElement>(null), button=useRef<HTMLButtonElement>(null);
 const selected=Math.max(0,options.findIndex(option=>option.value===value));
 useEffect(()=>{if(disabled)setOpen(false);},[disabled]);
 useEffect(()=>{if(!open)return; const close=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false);};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);},[open]);
 useEffect(()=>{if(open)document.getElementById(`${id}-option-${active}`)?.scrollIntoView({block:'nearest'});},[open,active,id]);
 function choose(index:number){const option=options[index];if(!option)return;setOpen(false);onChange(option.value);button.current?.focus();}
 function key(event:KeyboardEvent<HTMLButtonElement>){
  if(event.key==='Tab'){setOpen(false);return;}
  if(event.key==='Escape'){if(open){event.preventDefault();setOpen(false);}return;}
  if(event.key==='ArrowDown'||event.key==='ArrowUp'||event.key==='Home'||event.key==='End'){
   event.preventDefault(); if(!open){setActive(event.key==='End'?options.length-1:event.key==='Home'?0:selected);setOpen(true);return;}
   setActive(index=>event.key==='Home'?0:event.key==='End'?options.length-1:Math.max(0,Math.min(options.length-1,index+(event.key==='ArrowDown'?1:-1))));return;
  }
  if(event.key==='Enter'||event.key===' '){event.preventDefault();if(open)choose(active);else{setActive(selected);setOpen(true);}}
 }
 return <div className="ad-performance-select" ref={root} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null))setOpen(false);}}>
  <button ref={button} id={id} type="button" className="ad-performance-select__button" role="combobox" aria-expanded={open} aria-controls={`${id}-list`} aria-activedescendant={open?`${id}-option-${active}`:undefined} aria-haspopup="listbox" disabled={disabled} onClick={()=>{if(!open)setActive(selected);setOpen(!open);}} onKeyDown={key}><span>{options[selected]?.label}</span><span className="ad-performance-select__arrow" aria-hidden="true" /></button>
  {open&&<div className="ad-performance-select__list" id={`${id}-list`} role="listbox" aria-label={button.current?.labels?.[0]?.textContent||undefined}>{options.map((option,index)=><div key={option.value} id={`${id}-option-${index}`} role="option" aria-selected={option.value===value} className={`ad-performance-select__option${index===active?' is-active':''}`} onMouseDown={event=>event.preventDefault()} onMouseEnter={()=>setActive(index)} onClick={()=>choose(index)}>{option.label}{option.value===value&&<span aria-hidden="true">✓</span>}</div>)}</div>}
 </div>;
}
