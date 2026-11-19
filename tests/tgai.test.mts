import os from "node:os"; const TMP = os.tmpdir();
import http from "node:http";
import assert from "node:assert";
const calls: any[] = [];
const srv = http.createServer((req, res) => { let b=""; req.on("data",d=>b+=d); req.on("end",()=>{ const j=b?JSON.parse(b):{}; calls.push({url:req.url,j,h:req.headers});
  res.setHeader("content-type","application/json");
  if (req.url!.includes("/messages")) {
    const sys = String(j.system||"");
    const text = sys.includes("to-do items") ? JSON.stringify({tasks:[{title:"Send invoice",due:"2026-11-20",time:null,priority:1,estimate_minutes:15,project:null,tags:["work"],notes:null},{title:"",due:"bad",time:null,priority:0,estimate_minutes:null,project:null,tags:[],notes:null}]}) : "Stub answer";
    return res.end(JSON.stringify({id:"msg_1",type:"message",role:"assistant",model:j.model,content:[{type:"text",text}],stop_reason:"end_turn",stop_sequence:null,usage:{input_tokens:1,output_tokens:1}}));
  }
  res.end(JSON.stringify({ok:true,result:{}})); }); }).listen(0);
await new Promise(r=>srv.once("listening",r));
const port=(srv.address() as any).port;
process.env.LIFEOS_DB=TMP + "/tgai.db"; process.env.LIFEOS_TELEGRAM_API=`http://127.0.0.1:${port}`; process.env.TELEGRAM_BOT_TOKEN="T0K"; process.env.ANTHROPIC_BASE_URL=`http://127.0.0.1:${port}`; process.env.ANTHROPIC_API_KEY="k";
const fs=await import("node:fs"); fs.rmSync(process.env.LIFEOS_DB,{force:true});
const tg=await import("../src/lib/telegram.ts"); const ai=await import("../src/lib/ai.ts");
const sent:string[]=[]; const send=async(_c:number,t:string)=>{sent.push(t)};
const u=(chat:number,text:string)=>({message:{chat:{id:chat},text}});
assert(await tg.handleUpdate(u(5,"hello"),send)); assert(/private/.test(sent.at(-1)!));
assert.equal(await tg.handleUpdate(u(5,"/start wrong"),send) !== null, true); assert(!tg.tgChat());
await tg.handleUpdate(u(5,`/start ${tg.tgLinkCode()}`),send); assert.equal(tg.tgChat(),"5"); assert(/Linked/.test(sent.at(-1)!));
assert.equal(await tg.handleUpdate(u(9,"/today"),send),null); // other chat ignored
await tg.handleUpdate(u(5,"Call mum tomorrow 5pm #family"),send); assert(/Added #1/.test(sent.at(-1)!),sent.at(-1));
await tg.handleUpdate(u(5,"/today"),send); await tg.handleUpdate(u(5,"/inbox"),send);
await tg.handleUpdate(u(5,"/search mum"),send); assert(/Call mum/.test(sent.at(-1)!));
await tg.handleUpdate(u(5,"/done 1"),send); assert(/Done/.test(sent.at(-1)!));
await tg.handleUpdate(u(5,"/spent 4.50 coffee"),send); console.log("spent:",sent.at(-1));
await tg.handleUpdate(u(5,"/subs"),send); await tg.handleUpdate(u(5,"/brief"),send); await tg.handleUpdate(u(5,"/help"),send);
await tg.tgSend(5,"hi"); assert(calls.some(c=>c.url==="/botT0K/sendMessage"&&c.j.text==="hi"));
const props=await ai.extractTasks("Please send the invoice by Friday"); assert.equal(props.length,1); assert.equal(props[0].title,"Send invoice");
const m=calls.filter(c=>c.url.includes("/messages")).at(-1); assert.equal(m.j.model,"claude-opus-5-5"); console.log("req keys:",Object.keys(m.j), JSON.stringify(m.j.output_config).slice(0,80), m.h["anthropic-beta"]);
assert.equal(await ai.ask("what's up?"),"Stub answer");
delete process.env.ANTHROPIC_API_KEY; await assert.rejects(()=>ai.ask("x"),/ANTHROPIC_API_KEY/);
console.log("ALL OK"); srv.close(); process.exit(0);
