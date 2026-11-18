// A single, non-sensitive marker for the host's file monitoring plugin.
// Presence means the most recent run was successful and is still timely.
import {chmodSync,unlinkSync,writeFileSync} from 'node:fs';

export function createHealthMarker({path,writeFile=writeFileSync,chmod=chmodSync,unlink=unlinkSync}={}){
 if(path===undefined)return Object.freeze({sync:()=>true});
 if(typeof path!=='string'||!path)return Object.freeze({sync:()=>false});
 return Object.freeze({sync(healthy){
  try{
   if(healthy===true){writeFile(path,'healthy\n',{mode:0o644});chmod(path,0o644);}
   else {try{unlink(path)}catch(error){if(error?.code!=='ENOENT')throw error;}}
   return true;
  }catch{try{unlink(path)}catch{/* failure remains visible through the fixed I/O alert */}return false;}
 }});
}
