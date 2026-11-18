'use client';
import {StoreButton} from './store-ui';
const days=['월','화','수','목','금','토','일'];
const hours=Array.from({length:24},(_,hour)=>hour);
const cellStyle={minWidth:36,textAlign:'center' as const,padding:'3px'};

type Props={slots:string;disabled:boolean;onChange:(slots:string)=>void};
export function ShoppingScheduleGrid({slots,disabled,onChange}:Props){
 function setDay(day:number,value:'0'|'1'){onChange(slots.slice(0,day*24)+value.repeat(24)+slots.slice((day+1)*24));}
 function setHour(index:number,value:boolean){onChange(slots.slice(0,index)+(value?'1':'0')+slots.slice(index+1));}
 return <div>
  <p>시간표는 한국 시간 기준입니다. 선택한 한 시간은 정각부터 다음 정각 전까지입니다.</p>
  <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
   <StoreButton type="button" disabled={disabled} onClick={()=>onChange('1'.repeat(168))}>전체 시간 ON</StoreButton>
   <StoreButton type="button" disabled={disabled} onClick={()=>onChange('0'.repeat(168))}>전체 시간 OFF</StoreButton>
  </div>
  <p>선택 {Array.from(slots).filter(x=>x==='1').length}시간 / 주 168시간</p>
  <div style={{overflowX:'auto',maxWidth:'100%'}}>
   <table><caption>요일별 한 시간 단위 운영 시간표</caption><thead><tr><th scope="col">요일</th><th scope="col">하루 설정</th>{hours.map(hour=><th scope="col" key={hour} style={cellStyle}>{String(hour).padStart(2,'0')}시</th>)}</tr></thead>
    <tbody>{days.map((day,d)=><tr key={day}><th scope="row">{day}요일</th><td style={{whiteSpace:'nowrap'}}><button type="button" disabled={disabled} onClick={()=>setDay(d,'1')} aria-label={`${day}요일 전체 시간 ON`}>ON</button>{' '}<button type="button" disabled={disabled} onClick={()=>setDay(d,'0')} aria-label={`${day}요일 전체 시간 OFF`}>OFF</button></td>{hours.map(hour=><td key={hour} style={cellStyle}><input type="checkbox" aria-label={`${day}요일 ${String(hour).padStart(2,'0')}시부터 ${String(hour+1).padStart(2,'0')}시까지`} checked={slots[d*24+hour]==='1'} disabled={disabled} onChange={e=>setHour(d*24+hour,e.target.checked)}/></td>)}</tr>)}</tbody>
   </table>
  </div>
 </div>;
}
