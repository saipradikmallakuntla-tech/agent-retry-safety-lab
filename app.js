(function(){
'use strict';
const defaults={agentRetries:2,sdkRetries:2,httpRetries:2,clients:20,timeoutMs:1000,serviceMs:120,outageMs:10000,baseDelayMs:250,capDelayMs:4000,seed:7,jitter:false,failureMode:'ambiguous',keyMode:'none',ttlMs:60000};
const samples={
 storm:{...defaults},
 protected:{...defaults,keyMode:'stable'},
 expired:{...defaults,keyMode:'stable',ttlMs:700},
 rotating:{...defaults,keyMode:'per-attempt'},
 healthy:{...defaults,outageMs:0},
 definite:{...defaults,failureMode:'before-commit'}
};
function normalize(input){
 const c={...defaults,...input};
 const bounds={agentRetries:[0,8],sdkRetries:[0,8],httpRetries:[0,8],clients:[1,100],timeoutMs:[1,60000],serviceMs:[1,60000],outageMs:[0,3600000],baseDelayMs:[0,60000],capDelayMs:[0,60000],seed:[0,4294967295],ttlMs:[0,86400000]};
 Object.entries(bounds).forEach(([key,[min,max]])=>{const n=Number(c[key]);if(!Number.isInteger(n)||n<min||n>max)throw new Error(key+' must be an integer between '+min+' and '+max+'.');c[key]=n;});
 if(c.capDelayMs<c.baseDelayMs)throw new Error('Backoff cap must be at least the base delay.');
 if(!['none','stable','per-attempt'].includes(c.keyMode))throw new Error('Unknown idempotency policy.');
 if(!['ambiguous','before-commit'].includes(c.failureMode))throw new Error('Unknown failure mode.');
 c.jitter=!!c.jitter;
 const max=(c.agentRetries+1)*(c.sdkRetries+1)*(c.httpRetries+1)*c.clients;
 if(max>20000)throw new Error('Scenario could exceed 20,000 attempts. Reduce operations or retry counts.');
 return c;
}
function simulate(input){
 const c=normalize(input);const budgets=[c.agentRetries,c.sdkRetries,c.httpRetries];
 const worstCasePerOperation=budgets.reduce((a,b)=>a*(b+1),1);let randomState=c.seed>>>0;
 const random=()=>{randomState=(Math.imul(1664525,randomState)+1013904223)>>>0;return randomState/4294967296;};
 const events=[];const outcomes=[];
 for(let client=1;client<=c.clients;client++){
  let now=0,sequence=0;
  function request(path){
   const start=now,serverAt=start+c.serviceMs;
   const success=c.serviceMs<=c.timeoutMs&&serverAt>=c.outageMs;
   events.push({operation:client,attempt:++sequence,path:path.join('.'),startMs:start,serverAtMs:serverAt,success,effect:'pending'});
   now+=success?c.serviceMs:c.timeoutMs;
   return success;
  }
  function layer(depth,path){
   for(let attempt=0;attempt<=budgets[depth];attempt++){
    const next=path.concat(attempt+1);
    const ok=depth===2?request(next):layer(depth+1,next);
    if(ok)return true;
    if(attempt<budgets[depth]){
     const ceiling=Math.min(c.capDelayMs,c.baseDelayMs*Math.pow(2,attempt));
     now+=c.jitter?Math.floor(random()*ceiling):ceiling;
    }
   }
   return false;
  }
  const success=layer(0,[]);outcomes.push({operation:client,success,clientFinishedMs:now});
 }
 const ledger=new Map(),effectsByOperation=new Map();let sideEffects=0,deduplicated=0;
 events.sort((a,b)=>a.serverAtMs-b.serverAtMs||a.operation-b.operation||a.attempt-b.attempt);
 events.forEach(e=>{
  if(c.failureMode==='before-commit'&&!e.success){e.effect='No commit';return;}
  const key=c.keyMode==='stable'?'operation-'+e.operation:c.keyMode==='per-attempt'?'operation-'+e.operation+'-attempt-'+e.attempt:null;
  const existing=key?ledger.get(key):null;
  if(existing&&e.serverAtMs<existing.expiresMs){e.effect='Deduplicated';deduplicated++;return;}
  e.effect='New effect';sideEffects++;effectsByOperation.set(e.operation,(effectsByOperation.get(e.operation)||0)+1);
  if(key)ledger.set(key,{expiresMs:e.serverAtMs+c.ttlMs});
 });
 const duplicateSideEffects=Array.from(effectsByOperation.values()).reduce((n,v)=>n+Math.max(0,v-1),0);
 const successfulOperations=outcomes.filter(o=>o.success).length;
 const endMs=Math.max(0,...events.map(e=>e.serverAtMs),...outcomes.map(o=>o.clientFinishedMs));
 const counts=new Map();events.forEach(e=>{const bucket=Math.floor(e.startMs/1000);counts.set(bucket,(counts.get(bucket)||0)+1);});
 const buckets=Array.from(counts.entries()).sort((a,b)=>a[0]-b[0]).map(([second,count])=>({second,count}));
 const peakBucket=Math.max(0,...buckets.map(b=>b.count));const findings=[];
 const note=(severity,code,message)=>findings.push({severity,code,message});
 if(budgets.filter(n=>n>0).length>1)note('warning','MULTIPLE_RETRY_OWNERS','Nested retry budgets multiply: '+budgets.map(n=>'('+n+' + 1)').join(' × ')+' = '+worstCasePerOperation+' potential transport attempts per intent. Prefer one retry owner where possible.');
 if(duplicateSideEffects)note('error','DUPLICATE_EFFECTS',duplicateSideEffects+' additional mutations occurred beyond the first effect for each intent in this scenario.');
 if(c.keyMode==='none')note('warning','NO_KEY','No idempotency protection is modeled. An ambiguous timeout can repeat a completed mutation.');
 if(c.keyMode==='per-attempt')note('error','ROTATING_KEY','Changing the idempotency key for each attempt defeats deduplication of one business intent.');
 if(c.keyMode==='stable'&&c.ttlMs<endMs)note('warning','SHORT_RETENTION','Key retention is shorter than the overall modeled horizon ('+endMs+' ms). Review per-operation retry and delayed-work horizons; an expired key can admit a second effect.');
 if(c.serviceMs>c.timeoutMs)note('error','TIMEOUT_TOO_SHORT','Every response exceeds the timeout in this fixed-latency model. Server work may still finish after the caller gives up.');
 if(successfulOperations<c.clients)note('warning','EXHAUSTED_BUDGET',(c.clients-successfulOperations)+' operations exhausted all retry budgets without receiving success.');
 if(c.failureMode==='before-commit')note('info','DEFINITE_FAILURES','This scenario assumes failed attempts never commit. Do not use that assumption for ambiguous network timeouts without evidence.');
 if(!duplicateSideEffects)note('info','NO_DUPLICATES_OBSERVED','No duplicate effects occurred under these exact assumptions. This does not prove exactly-once behavior in production.');
 note('info','SERVER_CONTRACT','Idempotency requires atomic server enforcement, stable business-intent keys, payload fingerprint checks, and retention covering retries and delayed work. Jitter is not deduplication.');
 return {schemaVersion:1,config:c,worstCasePerOperation,attempts:events.length,sideEffects,duplicateSideEffects,deduplicated,successfulOperations,endMs,peakBucket,buckets,outcomes,events,findings};
}
function selfTest(){
 const base={...defaults,agentRetries:1,sdkRetries:1,httpRetries:1,clients:1,timeoutMs:100,serviceMs:20,outageMs:1000000,baseDelayMs:0,capDelayMs:0,keyMode:'none'};
 const checks=[
 ['Nested budgets multiply to eight',()=>{const r=simulate(base);return r.worstCasePerOperation===8&&r.attempts===8;}],
 ['Ambiguous failures repeat mutations',()=>simulate(base).duplicateSideEffects===7],
 ['Stable retained key deduplicates',()=>{const r=simulate({...base,keyMode:'stable',ttlMs:10000});return r.sideEffects===1&&r.deduplicated===7;}],
 ['Expired key allows duplicate effects',()=>simulate({...base,keyMode:'stable',ttlMs:100}).duplicateSideEffects>0],
 ['Different keys do not deduplicate',()=>simulate({...base,keyMode:'per-attempt'}).duplicateSideEffects===7],
 ['Healthy service stops after first attempt',()=>{const r=simulate({...base,outageMs:0});return r.attempts===1&&r.successfulOperations===1&&r.duplicateSideEffects===0;}],
 ['Definite pre-commit failures have no mutations',()=>simulate({...base,failureMode:'before-commit'}).sideEffects===0],
 ['Full-jitter seed is reproducible',()=>{const c={...base,jitter:true,baseDelayMs:30,capDelayMs:60};return JSON.stringify(simulate(c))===JSON.stringify(simulate(c));}],
 ['Late server work is retained in timeline',()=>{const r=simulate({...base,agentRetries:0,sdkRetries:0,httpRetries:0,serviceMs:200});return r.events[0].serverAtMs===200&&r.outcomes[0].clientFinishedMs===100;}],
 ['Excessive simulations are rejected',()=>{try{simulate({...base,clients:100,agentRetries:8,sdkRetries:8,httpRetries:8});return false;}catch(e){return true;}}]
 ];
 return checks.map(([name,fn])=>{try{return {name,pass:!!fn()};}catch(e){return {name,pass:false,error:e.message};}});
}
const api={simulate,normalize,defaults,samples,selfTest};if(typeof module!=='undefined'&&module.exports)module.exports=api;if(typeof globalThis!=='undefined')globalThis.RetrySafetyLab=api;
if(typeof document==='undefined')return;
const $=id=>document.getElementById(id);let current=null;
const numeric=Object.keys(defaults).filter(k=>typeof defaults[k]==='number');
function read(){const c={};numeric.forEach(k=>{c[k]=$ (k).valueAsNumber;});c.jitter=$('jitter').checked;c.keyMode=$('keyMode').value;c.failureMode=$('failureMode').value;return c;}
function load(c){numeric.forEach(k=>{$(k).value=c[k];});$('jitter').checked=c.jitter;$('keyMode').value=c.keyMode;$('failureMode').value=c.failureMode;}
function item(parent,text,kind){const li=document.createElement('li');li.textContent=text;if(kind)li.className=kind;parent.append(li);}
function render(r){
 current=r;$('results').hidden=false;$('worst').textContent=r.worstCasePerOperation;$('attempts').textContent=r.attempts;$('duplicates').textContent=r.duplicateSideEffects;$('successes').textContent=r.successfulOperations+' / '+r.config.clients;
 $('summary').textContent=r.sideEffects+' total server-side effects · '+r.deduplicated+' attempts deduplicated · horizon '+r.endMs+' ms · peak fixed 1-second bucket '+r.peakBucket+' requests.';
 $('findings').replaceChildren();r.findings.forEach(f=>item($('findings'),f.code+': '+f.message,f.severity));
 $('histogram').replaceChildren();r.buckets.slice(0,60).forEach(b=>{const row=document.createElement('div');row.className='bucket';const label=document.createElement('span');label.textContent=b.second+'–'+(b.second+1)+' s';const meter=document.createElement('meter');meter.min=0;meter.max=Math.max(1,r.peakBucket);meter.value=b.count;meter.setAttribute('aria-label','Requests in second '+b.second);const count=document.createElement('span');count.textContent=b.count;row.append(label,meter,count);$('histogram').append(row);});
 $('timeline').replaceChildren();r.events.slice(0,200).forEach(e=>{const tr=document.createElement('tr');[e.operation,e.startMs,e.serverAtMs,e.success?'Received':'Lost / timeout',e.effect].forEach(value=>{const td=document.createElement('td');td.textContent=String(value);tr.append(td);});$('timeline').append(tr);});
 $('status').textContent='Simulated '+r.attempts+' requests locally. No real action was executed.';
}
function run(){try{$('comparison').hidden=true;render(simulate(read()));}catch(e){$('status').textContent=e.message;$('results').hidden=true;current=null;}}
$('simulation-form').addEventListener('submit',e=>{e.preventDefault();run();});
$('load-sample').addEventListener('click',()=>{load(samples[$('sample').value]);run();});
$('compare').addEventListener('click',()=>{if(!$('simulation-form').reportValidity())return;try{const c=read(),without=simulate({...c,jitter:false}),withJitter=simulate({...c,jitter:true});render(simulate(c));$('comparison').hidden=false;$('comparison').textContent='Same seed and scenario: no jitter → '+without.attempts+' attempts, peak bucket '+without.peakBucket+', duplicate effects '+without.duplicateSideEffects+'. Full jitter → '+withJitter.attempts+' attempts, peak bucket '+withJitter.peakBucket+', duplicate effects '+withJitter.duplicateSideEffects+'. Jitter can change timing; it is not guaranteed to reduce requests or duplicates.';}catch(e){$('status').textContent=e.message;}});
$('run-tests').addEventListener('click',()=>{const tests=selfTest();$('tests').hidden=false;$('test-results').replaceChildren();tests.forEach(t=>item($('test-results'),(t.pass?'PASS · ':'FAIL · ')+t.name,t.pass?'pass':'error'));$('status').textContent=tests.filter(t=>t.pass).length+'/'+tests.length+' synthetic tests passed.';});
$('export').addEventListener('click',()=>{if(!current)return;const url=URL.createObjectURL(new Blob([JSON.stringify(current,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='retry-safety-simulation.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
load(samples.storm);run();
})();
