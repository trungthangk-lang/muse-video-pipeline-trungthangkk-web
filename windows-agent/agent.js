require('dotenv').config();
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const BASE = (process.env.RENDER_URL || '').replace(/\/$/, '');
const TOKEN = process.env.AGENT_TOKEN || '';
const POLL = Math.max(3000, Number(process.env.POLL_INTERVAL_MS || 5000));
const profile = path.join(__dirname, 'muse-chrome-profile');
let busy = false;
if (!BASE.startsWith('https://') || TOKEN.length < 32) {
 console.error('Set RENDER_URL to your HTTPS Render URL and AGENT_TOKEN to the same random secret configured on Render (at least 32 characters).'); process.exit(1);
}
async function report(id,status,result){
 const r=await fetch(`${BASE}/api/agent/jobs/${id}/result`,{method:'POST',headers:{'content-type':'application/json','x-agent-token':TOKEN},body:JSON.stringify({status,result})});
 if(!r.ok) throw new Error(`Could not report job status: HTTP ${r.status}`);
}
async function runJob(job){
 let context;
 try {
  // Persistent profile retains the user's Muse login locally. Do not upload this folder or its cookies.
  context=await chromium.launchPersistentContext(profile,{headless:false,args:['--start-maximized'],viewport:null});
  let page=context.pages()[0] || await context.newPage();
  await page.goto('https://muse.ai/',{waitUntil:'domcontentloaded',timeout:60000}).catch(()=>{});
  console.log(`Job ${job.id}: Muse opened. If not logged in, sign in manually in the visible browser.`);
  // This MVP deliberately does not guess at the site's prompt box or click an unknown Generate button.
  // It makes the prompt available via clipboard-like page text only when a recognizable editable exists;
  // otherwise it asks the user to paste manually, avoiding accidental clicks or prompt submission.
  await page.waitForTimeout(1500);
  const editables=page.locator('textarea, input:not([type=password]):not([type=hidden]), [contenteditable="true"], [role="textbox"]');
  const count=await editables.count().catch(()=>0);
  let filled=false;
  for(let i=0;i<Math.min(count,12);i++){
    const el=editables.nth(i); const visible=await el.isVisible().catch(()=>false); if(!visible)continue;
    const meta=((await el.getAttribute('placeholder').catch(()=>''))+' '+(await el.getAttribute('aria-label').catch(()=>''))+' '+(await el.getAttribute('data-placeholder').catch(()=>''))).toLowerCase();
    if(/prompt|describe|video|message|ask|type|create|tell/.test(meta)){
      await el.fill(job.prompt).catch(async()=>{await el.click();await page.keyboard.insertText(job.prompt)});
      filled=true; break;
    }
  }
  if(filled){
   await report(job.id,'needs_login','Prompt đã được điền vào ô có vẻ phù hợp. Hãy kiểm tra giao diện Muse và bấm nút tạo/gửi thủ công; Agent chưa tự bấm nút vì chưa xác minh bộ chọn chính xác.');
   console.log(`Job ${job.id}: prompt filled; verify and submit manually in Muse.`);
  } else {
   await report(job.id,'needs_login','Đã mở Muse nhưng chưa nhận diện chắc chắn ô nhập prompt. Đăng nhập nếu cần, rồi dán prompt thủ công. Cần kiểm tra giao diện thực tế để bật gửi tự động an toàn.');
   console.log(`Job ${job.id}: opened Muse, could not safely identify prompt field.`);
  }
  // Keep browser open so user can inspect, log in, and submit. Close it manually when finished.
 } catch(e){
  console.error(e); try{await report(job.id,'error',String(e.message||e))}catch{}
 } finally { if(context) { /* Keep persistent browser open for user interaction. */ } }
}
async function poll(){if(busy)return;busy=true;try{
 const r=await fetch(`${BASE}/api/agent/next`,{headers:{'x-agent-token':TOKEN}});
 if(!r.ok)throw new Error(`Render returned HTTP ${r.status}; check AGENT_TOKEN and deployment.`);
 const d=await r.json(); if(d.job)await runJob(d.job);
 }catch(e){console.error(new Date().toISOString(),e.message)}finally{busy=false}}
console.log('Muse Windows Agent started. Browser profile:',profile,'Polling:',BASE);
setInterval(poll,POLL);poll();
