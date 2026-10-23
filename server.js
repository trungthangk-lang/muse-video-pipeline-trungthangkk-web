const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const Database = require("better-sqlite3");
const crypto = require("node:crypto");
const path = require("node:path");
const fs = require("node:fs");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const APP_PASSWORD = process.env.APP_PASSWORD;
const SESSION_SECRET = process.env.SESSION_SECRET;
if (!APP_PASSWORD || APP_PASSWORD.length < 14) {
  console.error("Set APP_PASSWORD to a strong password (at least 14 characters).");
  process.exit(1);
}
if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
  console.error("Set SESSION_SECRET to a random secret of at least 32 characters.");
  process.exit(1);
}
const dataDir = process.env.DATA_DIR || path.join(__dirname, "data");
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, "pipeline-web.sqlite"));
db.pragma("journal_mode = WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS accounts (
 id TEXT PRIMARY KEY, label TEXT NOT NULL, proxy_host TEXT DEFAULT '',
 proxy_port TEXT DEFAULT '', proxy_enabled INTEGER DEFAULT 0,
 notes TEXT DEFAULT '', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS projects (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, total_scenes INTEGER NOT NULL DEFAULT 0,
 completed_scenes INTEGER NOT NULL DEFAULT 0, active_account_id TEXT DEFAULT '',
 status TEXT NOT NULL DEFAULT 'ready', notes TEXT DEFAULT '',
 updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
 id INTEGER PRIMARY KEY AUTOINCREMENT, project_id TEXT NOT NULL,
 message TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS agent_jobs (
 id TEXT PRIMARY KEY, prompt TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'queued',
 result TEXT DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
`);
app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: { directives: {
 defaultSrc:["'self'"], scriptSrc:["'self'"], styleSrc:["'self'"], imgSrc:["'self'","data:"],
 connectSrc:["'self'"], objectSrc:["'none'"], frameAncestors:["'none'"], upgradeInsecureRequests: []
}}}));
app.use(express.json({limit:"100kb"}));
app.use(express.static(path.join(__dirname,"public"), { etag:true, maxAge:"1h" }));
const limiter=rateLimit({windowMs:15*60*1000,max:120,standardHeaders:true,legacyHeaders:false});
app.use("/api",limiter);
const sessions = new Map();
const cookieName="mvp_session";
const safeEqual=(a,b)=>{const aa=Buffer.from(String(a));const bb=Buffer.from(String(b));return aa.length===bb.length && crypto.timingSafeEqual(aa,bb)};
function parseCookies(req){return Object.fromEntries((req.headers.cookie||"").split(";").map(x=>x.trim()).filter(Boolean).map(x=>{const i=x.indexOf("=");return [x.slice(0,i),decodeURIComponent(x.slice(i+1))]}))}
function auth(req,res,next){
 const token=parseCookies(req)[cookieName]; const item=token&&sessions.get(token);
 if(!item || item.expires<Date.now()){if(token)sessions.delete(token);return res.status(401).json({error:"Vui lòng đăng nhập lại."})}
 item.expires=Date.now()+12*60*60*1000; next();
}
app.post("/api/login",(req,res)=>{
 const pass=String(req.body?.password||"");
 if(!safeEqual(pass,APP_PASSWORD))return res.status(401).json({error:"Mật khẩu không đúng."});
 const token=crypto.randomBytes(32).toString("hex");
 sessions.set(token,{expires:Date.now()+12*60*60*1000});
 res.setHeader("Set-Cookie",`${cookieName}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=43200`);
 res.json({ok:true});
});
app.post("/api/logout",auth,(req,res)=>{const token=parseCookies(req)[cookieName];sessions.delete(token);res.setHeader("Set-Cookie",`${cookieName}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`);res.json({ok:true})});
app.get("/api/state",auth,(req,res)=>{
 const accounts=db.prepare("SELECT id,label,proxy_host AS proxyHost,proxy_port AS proxyPort,proxy_enabled AS proxyEnabled,notes,created_at AS createdAt FROM accounts ORDER BY created_at").all();
 const projects=db.prepare("SELECT id,name,total_scenes AS totalScenes,completed_scenes AS completedScenes,active_account_id AS activeAccountId,status,notes,updated_at AS updatedAt FROM projects ORDER BY updated_at DESC").all();
 const events=db.prepare("SELECT id,project_id AS projectId,message,created_at AS createdAt FROM events ORDER BY id DESC LIMIT 50").all();
 res.json({accounts,projects,events});
});
app.post("/api/accounts",auth,(req,res)=>{
 const id=crypto.randomUUID(), label=String(req.body?.label||"").trim().slice(0,80);
 if(!label)return res.status(400).json({error:"Hãy nhập tên tài khoản."});
 const host=String(req.body?.proxyHost||"").trim().slice(0,255);
 const port=String(req.body?.proxyPort||"").trim();
 const enabled=Boolean(req.body?.proxyEnabled);
 if(enabled && (!host || !/^\d{1,5}$/.test(port) || +port<1 || +port>65535))return res.status(400).json({error:"SOCKS5 cần host và port hợp lệ."});
 db.prepare("INSERT INTO accounts(id,label,proxy_host,proxy_port,proxy_enabled,notes,created_at) VALUES(?,?,?,?,?,?,?)").run(id,label,host,port,enabled?1:0,String(req.body?.notes||"").slice(0,500),new Date().toISOString());
 res.json({ok:true});
});
app.delete("/api/accounts/:id",auth,(req,res)=>{db.prepare("DELETE FROM accounts WHERE id=?").run(req.params.id);db.prepare("UPDATE projects SET active_account_id='' WHERE active_account_id=?").run(req.params.id);res.json({ok:true})});
app.post("/api/projects",auth,(req,res)=>{
 const id=crypto.randomUUID(),name=String(req.body?.name||"").trim().slice(0,120), total=Math.max(0,Math.min(100000,Number(req.body?.totalScenes)||0));
 if(!name)return res.status(400).json({error:"Hãy nhập tên dự án."});
 const now=new Date().toISOString();
 db.prepare("INSERT INTO projects(id,name,total_scenes,completed_scenes,status,notes,updated_at) VALUES(?,?,?,?,?,?,?)").run(id,name,total,0,"ready","",now);
 db.prepare("INSERT INTO events(project_id,message,created_at) VALUES(?,?,?)").run(id,`Tạo dự án "${name}" (${total} cảnh).`,now);
 res.json({ok:true});
});
app.patch("/api/projects/:id",auth,(req,res)=>{
 const old=db.prepare("SELECT * FROM projects WHERE id=?").get(req.params.id);if(!old)return res.status(404).json({error:"Không tìm thấy dự án."});
 const completed=Math.max(0,Math.min(old.total_scenes,Number(req.body?.completedScenes ?? old.completed_scenes)));
 const status=["ready","rendering","paused","done","error"].includes(req.body?.status)?req.body.status:old.status;
 const accountId=String(req.body?.activeAccountId ?? old.active_account_id).slice(0,100);
 if(accountId && !db.prepare("SELECT id FROM accounts WHERE id=?").get(accountId))return res.status(400).json({error:"Tài khoản không tồn tại."});
 const now=new Date().toISOString();
 db.prepare("UPDATE projects SET completed_scenes=?,status=?,active_account_id=?,updated_at=? WHERE id=?").run(completed,status,accountId,now,old.id);
 if(completed!==old.completed_scenes || status!==old.status || accountId!==old.active_account_id)db.prepare("INSERT INTO events(project_id,message,created_at) VALUES(?,?,?)").run(old.id,`Cập nhật: ${completed}/${old.total_scenes} cảnh; trạng thái ${status}.`,now);
 res.json({ok:true});
});
app.delete("/api/projects/:id",auth,(req,res)=>{db.prepare("DELETE FROM events WHERE project_id=?").run(req.params.id);db.prepare("DELETE FROM projects WHERE id=?").run(req.params.id);res.json({ok:true})});
// Agent bridge: the Windows helper polls Render over outbound HTTPS. Set AGENT_TOKEN on Render and in agent .env.
const AGENT_TOKEN = process.env.AGENT_TOKEN || "";
function agentAuth(req,res,next){
 const supplied=String(req.headers["x-agent-token"]||"");
 if(!AGENT_TOKEN || !safeEqual(supplied,AGENT_TOKEN)) return res.status(401).json({error:"Agent authentication failed. Configure AGENT_TOKEN."});
 next();
}
app.get("/api/agent/next",agentAuth,(req,res)=>{
 const job=db.prepare("SELECT * FROM agent_jobs WHERE status='queued' ORDER BY created_at LIMIT 1").get();
 if(!job)return res.json({job:null});
 const now=new Date().toISOString();
 db.prepare("UPDATE agent_jobs SET status='processing',updated_at=? WHERE id=? AND status='queued'").run(now,job.id);
 res.json({job:{id:job.id,prompt:job.prompt}});
});
app.post("/api/agent/jobs/:id/result",agentAuth,(req,res)=>{
 const status=["needs_login","submitted","done","error"].includes(req.body?.status)?req.body.status:"error";
 const result=String(req.body?.result||"").slice(0,2000),now=new Date().toISOString();
 const info=db.prepare("UPDATE agent_jobs SET status=?,result=?,updated_at=? WHERE id=?").run(status,result,now,req.params.id);
 if(!info.changes)return res.status(404).json({error:"Job not found"});
 res.json({ok:true});
});
app.post("/api/jobs",auth,(req,res)=>{
 const prompt=String(req.body?.prompt||"").trim();
 if(!prompt)return res.status(400).json({error:"Hãy nhập prompt trước."});
 if(prompt.length>30000)return res.status(413).json({error:"Prompt vượt quá 30.000 ký tự."});
 const id=crypto.randomUUID(),now=new Date().toISOString();
 db.prepare("INSERT INTO agent_jobs(id,prompt,status,result,created_at,updated_at) VALUES(?,?, 'queued','',?,?)").run(id,prompt,now,now);
 db.prepare("INSERT INTO events(project_id,message,created_at) VALUES(?,?,?)").run("",`Đã gửi prompt vào hàng đợi (${id.slice(0,8)}).`,now);
 res.json({ok:true,id,status:"queued"});
});
app.get("/api/jobs",auth,(req,res)=>{
 res.json({jobs:db.prepare("SELECT id,prompt,status,result,created_at AS createdAt,updated_at AS updatedAt FROM agent_jobs ORDER BY created_at DESC LIMIT 30").all()});
});
app.get("/health",(req,res)=>res.json({ok:true}));
app.listen(PORT,"0.0.0.0",()=>console.log(`Muse Video Pipeline Web listening on ${PORT}`));
