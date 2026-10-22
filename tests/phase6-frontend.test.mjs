import assert from "node:assert/strict";
import { test, mock } from "node:test";
import { createLoader } from "./helpers/load-ts.mjs";
mock.method(globalThis,"fetch",()=>{throw new Error("Live network forbidden");});
function nodes(tree,predicate){if(!tree||typeof tree!=="object")return[];return [...(predicate(tree)?[tree]:[]),...[].concat(tree.props?.children??[]).flatMap(child=>nodes(child,predicate))];}
function text(tree){if(Array.isArray(tree))return tree.map(text).join("");if(typeof tree==="string"||typeof tree==="number")return String(tree);return tree&&typeof tree==="object"?text(tree.props?.children):"";}
function harness(t,handler){
  const values=[];let cursor=0;const saved=[];const storage=new Map();const previous=globalThis.sessionStorage;
  globalThis.sessionStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)};
  t.after(()=>{if(previous===undefined)delete globalThis.sessionStorage;else globalThis.sessionStorage=previous;});
  t.mock.method(globalThis,"fetch",handler);
  const load=createLoader({react:{useRef:initial=>{const index=cursor++;values[index]??={current:initial};return values[index];},useState:initial=>{const index=cursor++;if(!(index in values))values[index]=initial;return[values[index],next=>{values[index]=typeof next==="function"?next(values[index]):next;}];},useEffect:()=>{}}});
  const operationFactory=load("src/components/pro/usePersonalOperation.tsx").usePersonalOperation;
  return{render:()=>{cursor=0;return operationFactory("prayer-plan",data=>saved.push(data));},renderComponent:Component=>{cursor=0;return Component({});},load,saved,storage};
}
const quota={pool:"personal",limit:30,used:30,remaining:0,observedAt:"2026-10-20T12:00:00Z",resetsAt:"2026-10-21T00:00:00Z",timezone:"UTC"};
test("real operation hook keeps the same key after a network error",async t=>{
  const calls=[];const h=harness(t,async(url,init)=>{calls.push(JSON.parse(init.body));if(calls.length===1)throw new Error("Network lost");return Response.json({plan:"Saved",quota});});
  let hook=h.render();await assert.rejects(hook.submit({focus:"private input"}));hook=h.render();assert.equal(h.storage.size,1);
  assert.ok(!JSON.stringify([...h.storage]).includes("private input"));
  assert.equal((await hook.submit({focus:"private input"})).status,200);assert.equal(calls[0].requestId,calls[1].requestId);assert.equal(h.storage.size,0);
});
test("404 status does not discard an uncertain request identity",async t=>{
  const calls=[];const h=harness(t,async(url,init)=>{if(!init)return Response.json({error:"Not found"},{status:404});calls.push(JSON.parse(init.body));if(calls.length===1)throw new Error("Lost");return Response.json({plan:"Saved"});});
  await assert.rejects(h.render().submit({focus:"prayer"}));let hook=h.render();
  const check=nodes(hook.controls,node=>node.type==="button")[0];await check.props.onClick();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.storage.size,1);await h.render().submit({focus:"prayer"});assert.equal(calls[0].requestId,calls[1].requestId);
});
test("rapid double submission cannot invoke another fetch",async t=>{
  let finish;let calls=0;const gate=new Promise(resolve=>{finish=resolve;});const h=harness(t,async()=>{calls++;await gate;return Response.json({plan:"Answer"});});
  const hook=h.render();const first=hook.submit({focus:"prayer"});assert.equal((await hook.submit({focus:"prayer"})).status,409);assert.equal(calls,1);finish();await first;
});
test("changed inputs cannot replace an uncertain request",async t=>{
  let calls=0;const h=harness(t,async()=>{calls++;throw new Error("Lost");});await assert.rejects(h.render().submit({focus:"first"}));
  assert.equal((await h.render().submit({focus:"changed"})).status,409);assert.equal(calls,1);
});
test("saved-result action displays a cached answer without AI POST",async t=>{
  let posts=0;const h=harness(t,async(url,init)=>{if(init){posts++;throw new Error("Lost");}return Response.json({replayed:true,plan:"Original result",quota});});
  await assert.rejects(h.render().submit({focus:"prayer"}));const button=nodes(h.render().controls,node=>node.type==="button")[0];await button.props.onClick();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(posts,1);assert.equal(h.saved[0].plan,"Original result");assert.equal(h.storage.size,0);
});
test("daily exhaustion displays actual zero allowance and clears a rejected new key",async t=>{
  const h=harness(t,async()=>Response.json({error:"Exhausted",code:"DAILY_QUOTA_EXHAUSTED",quota},{status:429}));await h.render().submit({focus:"prayer"});
  assert.equal(h.storage.size,0);assert.match(text(h.render().controls),/Remaining personal requests today: 0/);
});
test("explicit recovery must succeed before a new key is generated",async t=>{
  const keys=[];const h=harness(t,async(url,init)=>{
    if(url==="/api/ai/requests/recover")return Response.json({recovered:true,message:"Previous result fenced"});
    keys.push(JSON.parse(init.body).requestId);if(keys.length===1)throw new Error("Lost");return Response.json({plan:"New result"});
  });
  await assert.rejects(h.render().submit({focus:"prayer"}));const recover=nodes(h.render().controls,node=>node.type==="button")[1];await recover.props.onClick();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.storage.size,0);await h.render().submit({focus:"prayer"});assert.notEqual(keys[0],keys[1]);
});
test("real ChatBox displays the fifth answer even when remaining reaches zero",async t=>{
  const oldWindow=globalThis.window;globalThis.window={location:{href:"https://example.test/chat"},history:{replaceState:()=>{}}};
  t.after(()=>{if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow;});
  const h=harness(t,async(url,init)=>url==="/api/chat"&&init?Response.json({answer:"Fifth admitted answer",remaining:0,conversationId:"conv",patristicSources:[],quota:{...quota,pool:"chat",limit:5,used:5}}):Response.json({conversations:[],interruptedConversationIds:[]}));
  const Chat=h.load("src/components/chat/ChatBox.tsx").ChatBox;const render=()=>h.renderComponent(Chat);
  let tree=render();nodes(tree,node=>node.type==="textarea")[0].props.onChange({target:{value:"Final question"}});tree=render();
  nodes(tree,node=>node.type==="button"&&node.props.children==="Send")[0].props.onClick();
  for(let i=0;i<100;i++){await new Promise(resolve=>setImmediate(resolve));tree=render();if(JSON.stringify(tree).includes("Fifth admitted answer"))break;}
  assert.match(text(tree),/Fifth admitted answer/);assert.match(text(tree),/Questions remaining today: 0/);
});
test("a rejected retry after uncertainty does not discard its original key",async t=>{
  const keys=[];const h=harness(t,async(url,init)=>{keys.push(JSON.parse(init.body).requestId);if(keys.length===1)throw new Error("Lost");return Response.json({error:"Invalid",code:"INVALID_INPUT"},{status:400});});
  await assert.rejects(h.render().submit({focus:"prayer"}));await h.render().submit({focus:"prayer"});assert.equal(h.storage.size,1);
  await h.render().submit({focus:"corrected"});assert.ok(keys.every(key=>key===keys[0]));
});
