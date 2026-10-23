const $=id=>document.getElementById(id);let state={accounts:[],projects:[],events:[]};
async function api(url,opts={}){const r=await fetch('/api'+url,{credentials:'same-origin',headers:{'Content-Type':'application/json',...(opts.headers||{})},...opts});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||`HTTP ${r.status}`);return d}
function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function notify(s){alert(s)}
function showApp(){ $('login').classList.add('hidden');$('app').classList.remove('hidden');load()}
async function load(){try{state=await api('/state');render()}catch(e){if(e.message.includes('đăng nhập')){$('app').classList.add('hidden');$('login').classList.remove('hidden')}else notify(e.message)}}
$('loginForm').onsubmit=async e=>{e.preventDefault();try{await api('/login',{method:'POST',body:JSON.stringify({password:$('password').value})});$('password').value='';$('loginMsg').textContent='';showApp()}catch(err){$('loginMsg').textContent=err.message}};
$('logout').onclick=async()=>{try{await api('/logout',{method:'POST'});location.reload()}catch(e){location.reload()}};
$('addProject').onclick=()=>{$('projectForm').classList.remove('hidden');$('projectName').focus()};
$('cancelProject').onclick=()=>{$('projectForm').reset();$('projectForm').classList.add('hidden')};
$('projectForm').onsubmit=async e=>{e.preventDefault();try{await api('/projects',{method:'POST',body:JSON.stringify({name:$('projectName').value,totalScenes:$('totalScenes').value})});$('projectForm').reset();$('totalScenes').value=90;$('projectForm').classList.add('hidden');await load()}catch(err){notify(err.message)}};
$('addAccount').onclick=()=>{$('accountForm').reset();$('accountForm').classList.remove('hidden');$('proxyFields').classList.toggle('hidden',!$('proxyEnabled').checked)};
$('cancelAccount').onclick=()=>{$('accountForm').reset();$('accountForm').classList.add('hidden')};
$('proxyEnabled').onchange=()=> $('proxyFields').classList.toggle('hidden',!$('proxyEnabled').checked);
$('accountForm').onsubmit=async e=>{e.preventDefault();try{await api('/accounts',{method:'POST',body:JSON.stringify({label:$('accountLabel').value,proxyEnabled:$('proxyEnabled').checked,proxyHost:$('proxyHost').value,proxyPort:$('proxyPort').value,proxyUsername:$('proxyUsername').value,proxyPassword:$('proxyPassword').value,notes:$('accountNotes').value})});$('accountForm').reset();$('accountForm').classList.add('hidden');await load()}catch(err){notify(err.message)}};
$('refresh').onclick=load;
function render(){ $('statProjects').textContent=state.projects.length;$('statAccounts').textContent=state.accounts.length;$('statDone').textContent=state.projects.reduce((n,p)=>n+p.completedScenes,0);
$('projects').innerHTML=state.projects.map(p=>{const pct=p.totalScenes?Math.round(100*p.completedScenes/p.totalScenes):0;const active=state.accounts.find(a=>a.id===p.activeAccountId);return `<article class="item"><div class="item-main"><b>${esc(p.name)}</b><div class="muted">${p.completedScenes}/${p.totalScenes} cảnh · cập nhật ${new Date(p.updatedAt).toLocaleString()}</div><div class="progress"><span style="width:${pct}%"></span></div><span class="badge ${p.status}">${esc(({ready:'Sẵn sàng',rendering:'Đang render',paused:'Tạm dừng',done:'Hoàn tất',error:'Có lỗi'})[p.status]||p.status)}</span><div class="muted">Tài khoản tham chiếu: ${esc(active?.label||'Chưa chọn')}</div></div><div class="item-actions"><button data-edit-project="${p.id}">Cập nhật</button><button class="light" data-delete-project="${p.id}">Xóa</button></div></article>`}).join('');
$('noProjects').classList.toggle('hidden',state.projects.length>0);
$('accounts').innerHTML=state.accounts.map(a=>`<article class="item"><div class="item-main"><b>${esc(a.label)}</b><div class="muted">${a.proxyEnabled?'SOCKS5 cấu hình: '+esc(a.proxyHost)+':'+esc(a.proxyPort)+(a.hasProxyUsername?' · Có username':' · Không có username')+(a.hasProxyPassword?' · Đã lưu password mã hóa':' · Không có password'):'Không khai báo proxy'}${a.notes?' · '+esc(a.notes):''}</div></div><div class="item-actions"><button class="light" data-delete-account="${a.id}">Xóa</button></div></article>`).join('');
$('noAccounts').classList.toggle('hidden',state.accounts.length>0);
$('events').innerHTML=state.events.map(ev=>`<div class="item"><div class="item-main">${esc(ev.message)}<div class="muted">${new Date(ev.createdAt).toLocaleString()} · ${esc(state.projects.find(p=>p.id===ev.projectId)?.name||'Dự án đã xóa')}</div></div></div>`).join('')||'<div class="empty">Chưa có hoạt động.</div>';
}
$('projects').onclick=async e=>{const b=e.target.closest('button');if(!b)return;const p=state.projects.find(x=>x.id===(b.dataset.editProject||b.dataset.deleteProject));if(!p)return;try{if(b.dataset.deleteProject){if(confirm('Xóa dự án và nhật ký liên quan?'))await api('/projects/'+p.id,{method:'DELETE'});}else{const completed=prompt(`Số cảnh đã hoàn thành (0–${p.totalScenes})`,p.completedScenes);if(completed===null)return;const status=prompt('Trạng thái: ready, rendering, paused, done, error',p.status);if(status===null)return;const account=prompt('ID tài khoản tham chiếu (để trống nếu không chọn):\\n'+state.accounts.map(a=>`${a.id} = ${a.label}`).join('\\n'),p.activeAccountId||'');await api('/projects/'+p.id,{method:'PATCH',body:JSON.stringify({completedScenes:Number(completed),status,activeAccountId:account})})}await load()}catch(err){notify(err.message)}};
$('accounts').onclick=async e=>{const b=e.target.closest('button');if(b?.dataset.deleteAccount&&confirm('Xóa cấu hình tài khoản?')){try{await api('/accounts/'+b.dataset.deleteAccount,{method:'DELETE'});await load()}catch(err){notify(err.message)}}};
api('/state').then(showApp).catch(()=>{$('login').classList.remove('hidden')});

// Prompt import: text-only preview and browser-local draft; does not call Muse/render APIs.
const PROMPT_DRAFT_KEY = 'muse-video-pipeline-prompt-draft-v1';
function splitPromptScenes(text){
  const raw=String(text||'').replace(/\r/g,'').trim();
  if(!raw)return [];
  const lines=raw.split('\n');
  const heading=/^\s*(?:#{1,6}\s*)?(?:cảnh|canh|scene|shot|prompt)\s*(?:số\s*)?\d{1,4}\b.*$/i;
  const chunks=[]; let current=[];
  for(const line of lines){
    if(heading.test(line) && current.some(x=>x.trim())){chunks.push(current.join('\n').trim());current=[line];}
    else if(heading.test(line) && !current.some(x=>x.trim())) current=[line];
    else current.push(line);
  }
  if(current.some(x=>x.trim()))chunks.push(current.join('\n').trim());
  if(chunks.length>1)return chunks.filter(Boolean);
  // If there are no recognizable scene headings, treat separated paragraphs as prompts.
  const paras=raw.split(/\n\s*\n+/).map(x=>x.trim()).filter(Boolean);
  return paras.length>1?paras:[raw];
}
function renderPromptPreview(scenes){
  const target=$('promptPreview'); if(!target)return;
  target.innerHTML=scenes.slice(0,200).map((s,i)=>`<article class="prompt-scene"><b>Cảnh ${String(i+1).padStart(3,'0')}</b><pre>${esc(s)}</pre></article>`).join('');
  if(scenes.length>200)target.insertAdjacentHTML('beforeend',`<div class="muted">Chỉ hiển thị 200 cảnh đầu trong bản xem trước; nội dung đầy đủ vẫn nằm trong ô prompt.</div>`);
  $('promptCount').textContent=`${scenes.length} cảnh`;
}
function parsePromptUI(){
  const text=$('promptText').value; const scenes=splitPromptScenes(text);
  renderPromptPreview(scenes);
  $('promptMessage').textContent=scenes.length?`Đã tách được ${scenes.length} khối prompt để xem trước. Đây chưa phải trạng thái render.`:'Chưa tìm thấy nội dung prompt.';
  return scenes;
}
if($('promptText')){
  try{const saved=localStorage.getItem(PROMPT_DRAFT_KEY);if(saved){$('promptText').value=saved;parsePromptUI();$('promptMessage').textContent='Đã khôi phục bản nháp từ trình duyệt này.'}}catch{}
  $('promptFile').addEventListener('change',async e=>{
    const file=e.target.files?.[0]; if(!file)return;
    if(file.size>5*1024*1024){$('promptMessage').textContent='File quá lớn. Hãy dùng file TXT/MD dưới 5 MB.';e.target.value='';return;}
    try{$('promptText').value=await file.text();$('promptMessage').textContent=`Đã đọc file ${file.name}. Bấm “Tách prompt / xem trước” để kiểm tra.`;parsePromptUI();}
    catch(err){$('promptMessage').textContent='Không đọc được file: '+(err.message||String(err));}
  });
  $('parsePrompts').onclick=parsePromptUI;
  $('savePromptDraft').onclick=()=>{try{localStorage.setItem(PROMPT_DRAFT_KEY,$('promptText').value);$('promptMessage').textContent='Đã lưu bản nháp trong trình duyệt hiện tại.';}catch{$('promptMessage').textContent='Không thể lưu bản nháp trong trình duyệt này.'}};
  $('clearPrompts').onclick=()=>{if(!confirm('Xóa nội dung prompt và bản nháp đã lưu trên trình duyệt này?'))return;$('promptText').value='';$('promptFile').value='';$('promptPreview').innerHTML='';$('promptCount').textContent='0 cảnh';$('promptMessage').textContent='Đã xóa nội dung.';try{localStorage.removeItem(PROMPT_DRAFT_KEY)}catch{}};
}

// Agent jobs: send the full prompt currently in the editor to the authenticated Windows helper.
async function refreshMuseJobs(){try{const d=await api('/jobs');$('museJobs').innerHTML=(d.jobs||[]).map(j=>`<article class="item"><div class="item-main"><b>${esc(j.status)}</b><div class="muted">${new Date(j.createdAt).toLocaleString()} · ${esc(j.id.slice(0,8))}</div><div class="muted">${esc(j.result||'')}</div><details><summary>Xem prompt</summary><pre>${esc(j.prompt)}</pre></details></div></article>`).join('')||'<div class="empty">Chưa có công việc.</div>';}catch(e){$('museJobMessage').textContent=e.message}}
if($('sendMuseJob')){$('sendMuseJob').onclick=async()=>{const prompt=$('promptText').value.trim();if(!prompt){$('museJobMessage').textContent='Hãy dán hoặc tải prompt vào ô nội dung trước.';return}if(!confirm('Gửi toàn bộ nội dung prompt hiện tại tới máy tính đã kết nối?'))return;try{const d=await api('/jobs',{method:'POST',body:JSON.stringify({prompt})});$('museJobMessage').textContent=`Đã xếp hàng công việc ${d.id.slice(0,8)}. Hãy kiểm tra máy tính Windows đang chạy Agent.`;await refreshMuseJobs()}catch(e){$('museJobMessage').textContent=e.message}};$('refreshMuseJobs').onclick=refreshMuseJobs;}
