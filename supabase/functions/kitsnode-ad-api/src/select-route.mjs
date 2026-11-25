// Select lazily: a performance or shopping request must not initialize the
// unrelated review application or depend on its operator configuration.
export function selectRoute(route,{getApps,getShopping,getPerformance,performanceEnabled,shoppingEnabled,shadowEnabled}) {
 if(route==='/connections'||/^\/connections\/[0-9a-f-]{36}$/i.test(route))return {path:'/api/ad-connections'+route.slice('/connections'.length),handler:getApps().connection.handler};
 if(route==='/reviews')return {path:'/api/ad-connection-reviews',handler:getApps().review.handler};
 if(route==='/performance'&&performanceEnabled)return {path:'/api/performance',handler:getPerformance().handler};
 if((route==='/shopping-catalog'||route==='/shopping-bid-preview'||route==='/shopping-master-compare'||route==='/shopping-rank-estimate'||(route==='/shopping-shadow'&&shadowEnabled))&&shoppingEnabled)return {path:'/api'+route,handler:getShopping().handler};
 return null;
}
