const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
// Keep actual destructive actions restricted until the production flow is verified.
export function withdrawalEnabledFor(userId,{release,testSubject}){
 if(!uuid(userId))return false;
 if(release==='true')return true;
 return uuid(testSubject)&&userId===testSubject;
}
