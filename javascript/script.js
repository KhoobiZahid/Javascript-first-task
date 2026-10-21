const KEY='studyplanner.tasks.v1',TKEY='studyplanner.theme';
const $=s=>document.querySelector(s);
const st={status:'all',q:'',cat:'all',sort:'manual'};
let tasks=load(),editing=null,confirmId=null,editErr='',dragId=null;

function load(){try{const v=JSON.parse(localStorage.getItem(KEY));if(!Array.isArray(v))return[];
  return v.filter(t=>t&&typeof t.id==='string'&&typeof t.title==='string'&&t.title.trim()).map(t=>({id:t.id,title:t.title,due:/^\d{4}-\d{2}-\d{2}$/.test(t.due)?t.due:'',category:['Homework','Assignment','Exam','Personal'].includes(t.category)?t.category:'Personal',priority:['low','medium','high'].includes(t.priority)?t.priority:'medium',done:!!t.done}))}catch(e){return[]}}
function save(){try{localStorage.setItem(KEY,JSON.stringify(tasks))}catch(e){}}
function today(){return new Date(Date.now()-new Date().getTimezoneOffset()*6e4).toISOString().slice(0,10)}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
const PR={high:0,medium:1,low:2};
const isLate=t=>!t.done&&t.due&&t.due<today();
function fmt(d){return new Date(d+'T00:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}

function visible(){
  let l=tasks.filter(t=>
    (st.status==='all'||(st.status==='completed')===t.done)&&
    (st.cat==='all'||t.category===st.cat)&&
    t.title.toLowerCase().includes(st.q.trim().toLowerCase()));
  if(st.sort==='due')l=[...l].sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999'));
  if(st.sort==='priority')l=[...l].sort((a,b)=>PR[a.priority]-PR[b.priority]);
  return l;
}

function actions(t){
  if(editing===t.id)return '<button class="btn primary" data-a="save">Save</button><button class="btn" data-a="cancel">Cancel</button>';
  if(confirmId===t.id)return '<button class="btn danger" data-a="delyes">Yes, delete</button><button class="btn" data-a="delno">Keep</button>';
  const busy=editing!==null?' disabled':'';
  const ed=t.done?' disabled title="Completed tasks can’t be edited"':busy;
  return '<button class="btn" data-a="edit"'+ed+'>Edit</button><button class="btn" data-a="del"'+busy+'>Delete</button>';
}

function render(){
  const done=tasks.filter(t=>t.done).length;
  $('#sTotal').textContent=tasks.length;$('#sDone').textContent=done;$('#sPend').textContent=tasks.length-done;
  const l=visible();const locked=editing!==null;
  $('#list').innerHTML=l.length?l.map(t=>`
<li class="task p-${t.priority}${t.done?' done':''}${isLate(t)?' overdue':''}" draggable="${locked||confirmId===t.id?'false':'true'}" data-id="${t.id}">
<input type="checkbox" ${t.done?'checked':''} ${locked?'disabled':''} aria-label="Mark complete" data-a="toggle">
<div class="body">${editing===t.id
 ?`<input class="edit" value="${esc(t.title)}" maxlength="120" aria-label="Edit task name" data-a="input">${editErr?`<div class="err" role="alert">${editErr}</div>`:''}`
 :`<div class="title">${esc(t.title)}</div>`}
<div class="meta"><span>${esc(t.category)}</span><span class="p-${t.priority}">${t.priority[0].toUpperCase()+t.priority.slice(1)} priority</span>${t.due?`<span class="${isLate(t)?'late':''}">${isLate(t)?'Overdue: ':'Due '}${fmt(t.due)}</span>`:'<span>No due date</span>'}</div></div>
<div class="acts">${actions(t)}</div>
</li>`).join(''):`<li class="empty">${tasks.length?'No tasks match your search or filters.':'No tasks yet. Add your first one above.'}</li>`;
  $('#addForm [name=due]').min=today();
  document.querySelectorAll('#addForm input,#addForm select,#addForm button,.tools input,.tools select,.tools button').forEach(el=>el.disabled=locked);
  $('#lockNote').hidden=!locked;
  const ed=$('.edit');if(ed){ed.focus();ed.setSelectionRange(ed.value.length,ed.value.length)}
}

$('#addForm').addEventListener('submit',e=>{
  e.preventDefault();if(editing!==null)return;
  const f=e.target,title=f.title.value.trim(),err=$('#formErr');
  const bad=!title?'Please enter a task name.':!f.due.value?'Please choose a due date.':f.due.value<today()?'Due date can’t be in the past.':'';
  err.hidden=!bad;err.textContent=bad;if(bad)return;
  tasks.push({id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),title,due:f.due.value,category:f.category.value,priority:f.priority.value,done:false});
  save();f.title.value='';f.due.value='';render();f.title.focus();
});

function commitEdit(li){
  const v=li.querySelector('.edit').value.trim(),t=tasks.find(x=>x.id===li.dataset.id);
  if(!t||t.done){editing=null;editErr='';render();return}
  if(!v){editErr='Task name can’t be empty.';render();return}
  t.title=v;editing=null;editErr='';save();render();
}

$('#list').addEventListener('click',e=>{
  const b=e.target.closest('[data-a]'),li=e.target.closest('li.task');if(!b||!li)return;
  const id=li.dataset.id,a=b.dataset.a,t=tasks.find(x=>x.id===id);
  if(!t||(editing!==null&&editing!==id))return;
  if(a==='toggle'){confirmId=null;t.done=b.checked;save();render()}
  else if(a==='del'){confirmId=id;render()}
  else if(a==='delyes'){tasks=tasks.filter(x=>x.id!==id);confirmId=null;save();render()}
  else if(a==='delno'){confirmId=null;render()}
  else if(a==='edit'){if(t.done)return;confirmId=null;editing=id;editErr='';render()}
  else if(a==='cancel'){editing=null;editErr='';render()}
  else if(a==='save')commitEdit(li);
});
$('#list').addEventListener('keydown',e=>{
  if(e.target.dataset.a!=='input')return;
  if(e.key==='Enter')commitEdit(e.target.closest('li'));
  if(e.key==='Escape'){editing=null;editErr='';render()}
});

/* drag and drop */
const L=$('#list');
L.addEventListener('dragstart',e=>{const li=e.target.closest('li.task');if(!li)return;dragId=li.dataset.id;li.classList.add('dragging');e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',dragId)});
L.addEventListener('dragend',()=>{dragId=null;render()});
L.addEventListener('dragover',e=>{const li=e.target.closest('li.task');if(!li||!dragId)return;e.preventDefault();L.querySelectorAll('.over').forEach(x=>x.classList.remove('over'));if(li.dataset.id!==dragId)li.classList.add('over')});
L.addEventListener('drop',e=>{
  const li=e.target.closest('li.task');if(!li||!dragId||li.dataset.id===dragId)return;e.preventDefault();
  const from=tasks.findIndex(t=>t.id===dragId),[m]=tasks.splice(from,1);
  tasks.splice(tasks.findIndex(t=>t.id===li.dataset.id),0,m);
  st.sort='manual';$('#sort').value='manual';save();dragId=null;render();
});

$('#addForm').addEventListener('input',()=>{$('#formErr').hidden=true});
/* filters */
$('#q').addEventListener('input',e=>{st.q=e.target.value;render()});
$('#cat').addEventListener('change',e=>{st.cat=e.target.value;render()});
$('#sort').addEventListener('change',e=>{st.sort=e.target.value;render()});
$('#status').addEventListener('click',e=>{
  const b=e.target.closest('[data-s]');if(!b)return;st.status=b.dataset.s;
  document.querySelectorAll('#status .btn').forEach(x=>x.setAttribute('aria-pressed',x===b));render();
});

/* theme */
function applyTheme(t){
  document.documentElement.dataset.theme=t;
  $('#theme').textContent=t==='dark'?'Light mode':'Dark mode';
}
(function(){
  let t=null;try{t=localStorage.getItem(TKEY)}catch(e){}
  applyTheme(t||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'));
})();
$('#theme').addEventListener('click',()=>{
  const t=document.documentElement.dataset.theme==='dark'?'light':'dark';
  applyTheme(t);try{localStorage.setItem(TKEY,t)}catch(e){}
});

render();
