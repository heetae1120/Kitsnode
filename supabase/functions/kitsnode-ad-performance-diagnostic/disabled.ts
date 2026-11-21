import {disabled} from './disabled.mjs';
declare const Deno: {serve(handler:()=>Response):void};
Deno.serve(disabled);
