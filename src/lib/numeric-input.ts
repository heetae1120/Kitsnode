export function normalizeNumericInput(value:string):string|null{
 const raw=value.replace(/[,\s]/g,'');
 return /^\d*(?:\.\d*)?$/.test(raw)?raw:null;
}
export function formatNumericInput(raw:string){
 const [integer,...fraction]=raw.split('.');
 return integer.replace(/\B(?=(\d{3})+(?!\d))/g,',')+(fraction.length?'.'+fraction.join(''):'');
}
