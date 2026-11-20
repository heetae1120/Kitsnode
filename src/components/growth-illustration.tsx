type GrowthKind='trend'|'bars'|'steps'|'compound'|'arrow'|'milestones'|'columns';

/** Decorative vector artwork stays crisp as the cards move through perspective. */
export function GrowthIllustration({kind}:{kind:GrowthKind}){
 return <svg viewBox="0 0 360 240" fill="none" aria-hidden="true" focusable="false" className="ag-growth-art">
  {kind==='trend'&&<>
   <path d="M35 193L96 161L147 174L213 111L253 126L321 45" stroke="currentColor" strokeWidth="10" strokeLinejoin="round" strokeLinecap="round"/>
   <path d="M284 45H321V82" stroke="currentColor" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round"/>
   <circle cx="96" cy="161" r="5" fill="currentColor"/><circle cx="213" cy="111" r="5" fill="currentColor"/>
  </>}
  {kind==='bars'&&<>
   <rect x="43" y="153" width="42" height="54" rx="3" fill="currentColor" opacity=".2"/>
   <rect x="119" y="118" width="42" height="89" rx="3" fill="currentColor" opacity=".4"/>
   <rect x="195" y="78" width="42" height="129" rx="3" fill="currentColor" opacity=".65"/>
   <rect x="271" y="32" width="42" height="175" rx="3" fill="currentColor"/>
  </>}
  {kind==='steps'&&<>
   <path d="M43 203V166H108V124H173V83H238V40H306V203Z" fill="currentColor" opacity=".2"/>
   <path d="M43 161H108V119H173V78H238V35H306" stroke="currentColor" strokeWidth="9" strokeLinejoin="round"/>
   <path d="M280 18L307 35L280 52" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/>
  </>}
  {kind==='compound'&&<>
   <path d="M37 202C103 202 158 194 205 153S277 83 316 30" stroke="currentColor" strokeWidth="11" strokeLinecap="round"/>
   <path d="M37 202C104 202 159 193 205 153S277 83 316 30V207H37Z" fill="currentColor" opacity=".12"/>
   <circle cx="316" cy="30" r="13" fill="currentColor"/>
  </>}
  {kind==='arrow'&&<>
   <path d="M65 190L199 56H143V24H258V139H226V82L89 219Z" fill="currentColor"/>
   <path d="M110 223L266 67M143 223L294 72" stroke="currentColor" strokeWidth="2" opacity=".25"/>
  </>}
  {kind==='milestones'&&<>
   <path d="M43 203L121 150L211 101L307 38" stroke="currentColor" strokeWidth="3"/>
   <circle cx="43" cy="203" r="9" fill="currentColor"/>
   <circle cx="121" cy="150" r="17" stroke="currentColor" strokeWidth="5"/>
   <circle cx="211" cy="101" r="26" stroke="currentColor" strokeWidth="6"/>
   <circle cx="307" cy="38" r="34" fill="currentColor"/>
  </>}
  {kind==='columns'&&<>
   <path d="M48 206V145H26L67 104L108 145H86V206Z" fill="currentColor" opacity=".3"/>
   <path d="M158 206V105H136L177 64L218 105H196V206Z" fill="currentColor" opacity=".6"/>
   <path d="M268 206V65H246L287 24L328 65H306V206Z" fill="currentColor"/>
  </>}
 </svg>;
}
