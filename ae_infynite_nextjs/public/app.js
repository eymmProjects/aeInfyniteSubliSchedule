/* ============================================================
   AE INFINITE PRINTING — ORDER SCHEDULE LOGIC

   FUNCTION GROUPS
   1. App configuration and shared state
   2. Password/access handling
   3. Loading monthly data
   4. Saving monthly data
   5. Safe text rendering
   6. Calendar rendering and input events
   7. Status legend
   8. Order table rendering and editing
   9. Month navigation, backup, print, and initialization
   ============================================================ */

/* 1. APP CONFIGURATION: statuses, month names, and shared state */
const statuses = [
  {name:'New Order',color:'#1976d2'},
  {name:'In Design',color:'#f4b719'},
  {name:'Ready to Print',color:'#8e24aa'},
  {name:'Printing',color:'#2e9d43'},
  {name:'Pressing',color:'#ef8800'},
  {name:'Ready for Delivery',color:'#e3222b'},
  {name:'Delivered',color:'#999999'}
];
const monthNames=['January','February','March','April','May','June','July','August','September','October','November','December'];
const today=new Date();
let shownYear=today.getFullYear(), shownMonth=today.getMonth();
let data={days:{},orders:[],notes:''};
const $=id=>document.getElementById(id);
const key=()=>`ae-schedule-${shownYear}-${String(shownMonth+1).padStart(2,'0')}`;
let saveTimer=null;
let appPassword=sessionStorage.getItem('ae-app-password')||'';
/* 2. ACCESS: ask for and retain the shared schedule password */
function ensurePassword(){
  if(!appPassword){
    appPassword=prompt('Enter your AE Infynite schedule access password:')||'';
    if(appPassword){sessionStorage.setItem('ae-app-password',appPassword);}
  }
  return !!appPassword;
}
/* 3. DATA LOADING: fetch the selected month from the online API; use local fallback */
async function loadMonth(){
  $('monthLabel').value=monthNames[shownMonth]; $('yearLabel').value=shownYear;
  $('monthSelect').value=shownMonth; $('yearSelect').value=shownYear;
  $('saveState').textContent='Loading saved schedule…';
  try{
    if(!ensurePassword()) throw new Error('Password required');
    const response=await fetch(`/api/data?month=${encodeURIComponent(key())}`,{headers:{'x-app-password':appPassword}});
    if(response.status===401){sessionStorage.removeItem('ae-app-password');appPassword='';throw new Error('Incorrect password. Refresh and try again.');}
    if(!response.ok) throw new Error('Database could not be reached');
    const result=await response.json();
    data=result.data||{days:{},orders:[],notes:''};
    $('saveState').textContent='Connected to online database ✓';
  }catch(e){
    try { const saved=localStorage.getItem(key()); data=saved?JSON.parse(saved):{days:{},orders:[],notes:''}; }
    catch(err){data={days:{},orders:[],notes:''};}
    $('saveState').textContent='Offline/local fallback: '+e.message;
  }
  if(!data.days)data.days={}; if(!Array.isArray(data.orders))data.orders=[]; if(typeof data.notes!=='string')data.notes='';
  $('generalNotes').value=data.notes;
  renderCalendar(); renderOrders();
}
/* 4. DATA SAVING: save locally immediately, then sync online after a short delay */
function save(){
  data.notes=$('generalNotes').value;
  try{localStorage.setItem(key(),JSON.stringify(data));}catch(e){}
  $('saveState').textContent='Saving…';
  clearTimeout(saveTimer);
  saveTimer=setTimeout(async()=>{
    try{
      if(!ensurePassword()) throw new Error('Password required');
      const response=await fetch('/api/data',{method:'PUT',headers:{'Content-Type':'application/json','x-app-password':appPassword},body:JSON.stringify({month:key(),data})});
      if(response.status===401){sessionStorage.removeItem('ae-app-password');appPassword='';throw new Error('Incorrect password. Refresh and try again.');}
      if(!response.ok) throw new Error('Online save failed');
      $('saveState').textContent='Saved to online database ✓';
    }catch(e){$('saveState').textContent='Local backup saved; online save failed: '+e.message;}
  },500);
}
/* 5. SAFE HTML: escape user-entered text before inserting it into generated markup */
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
/* 6. CALENDAR: build date cells and connect note/status inputs */
function renderCalendar(){
  const el=$('calendar');el.innerHTML='';
  const first=new Date(shownYear,shownMonth,1).getDay();
  const count=new Date(shownYear,shownMonth+1,0).getDate();
  for(let i=0;i<first;i++){const d=document.createElement('div');d.className='day empty';el.appendChild(d);}
  for(let n=1;n<=count;n++){
    const dateKey=`${shownYear}-${String(shownMonth+1).padStart(2,'0')}-${String(n).padStart(2,'0')}`;
    const entry=data.days[dateKey]||{note:'',status:''};
    const d=document.createElement('div');d.className='day';
    if(shownYear===today.getFullYear()&&shownMonth===today.getMonth()&&n===today.getDate())d.classList.add('today');
    d.innerHTML=`<div class="day-number">${n}</div>
      <textarea aria-label="Notes for ${dateKey}" placeholder="Orders, printing, pressing, delivery..." data-date="${dateKey}">${escapeHtml(entry.note||'')}</textarea>
      <select class="day-status" aria-label="Daily status for ${dateKey}" data-date-status="${dateKey}">
        <option value="">Daily status (optional)</option>${statuses.map(s=>`<option value="${escapeHtml(s.name)}" ${entry.status===s.name?'selected':''}>${escapeHtml(s.name)}</option>`).join('')}
      </select>`;
    el.appendChild(d);
  }
  const total=first+count; const trailing=(7-total%7)%7;
  for(let i=0;i<trailing;i++){const d=document.createElement('div');d.className='day empty';el.appendChild(d);}
  el.querySelectorAll('textarea[data-date]').forEach(t=>t.addEventListener('input',e=>{const k=e.target.dataset.date;data.days[k]=data.days[k]||{note:'',status:''};data.days[k].note=e.target.value;save();}));
  el.querySelectorAll('select[data-date-status]').forEach(s=>s.addEventListener('change',e=>{const k=e.target.dataset.dateStatus;data.days[k]=data.days[k]||{note:'',status:''};data.days[k].status=e.target.value;save();}));
}
/* 7. STATUS LEGEND: display the production status colors */
function renderLegend(){$('legend').innerHTML=statuses.map(s=>`<div class="legend-item"><span class="dot" style="background:${s.color}"></span><span>${s.name.toUpperCase()}</span></div>`).join('');}
/* 8. ORDER TABLE: draw orders and attach edit/delete handlers */
function renderOrders(){
  const body=$('orderRows');body.innerHTML='';
  data.orders.forEach((o,i)=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td><input value="${escapeHtml(o.no)}" data-i="${i}" data-field="no" placeholder="AF-001"></td>
      <td><input value="${escapeHtml(o.customer)}" data-i="${i}" data-field="customer" placeholder="Customer"></td>
      <td><input value="${escapeHtml(o.item)}" data-i="${i}" data-field="item" placeholder="Jersey / polo"></td>
      <td><input type="number" min="0" value="${escapeHtml(o.qty)}" data-i="${i}" data-field="qty" style="min-width:45px"></td>
      <td><input type="date" value="${escapeHtml(o.due)}" data-i="${i}" data-field="due" style="min-width:120px"></td>
      <td><select data-i="${i}" data-field="status">${statuses.map(s=>`<option ${o.status===s.name?'selected':''}>${s.name}</option>`).join('')}</select></td>
      <td><textarea data-i="${i}" data-field="notes" placeholder="Sizes, balance...">${escapeHtml(o.notes)}</textarea></td>
      <td class="delete-col"><button class="delete-btn" data-delete="${i}" aria-label="Delete order ${i+1}">✕</button></td>`;
    body.appendChild(tr);
  });
  body.querySelectorAll('[data-field]').forEach(input=>{
    const update=()=>{const i=Number(input.dataset.i),field=input.dataset.field;data.orders[i][field]=input.value;save();};
    input.addEventListener('input',update);input.addEventListener('change',update);
  });
  body.querySelectorAll('[data-delete]').forEach(btn=>btn.addEventListener('click',()=>{const i=Number(btn.dataset.delete);if(confirm(`Delete order ${data.orders[i].no||'#'+(i+1)}?`)){data.orders.splice(i,1);save();renderOrders();}}));
}
/* 9. NAVIGATION AND EVENT HANDLERS: month controls, backups, printing, startup */
function changeMonth(delta){shownMonth+=delta;if(shownMonth<0){shownMonth=11;shownYear--;}if(shownMonth>11){shownMonth=0;shownYear++;}loadMonth();}
$('prevMonth').onclick=()=>changeMonth(-1);
$('nextMonth').onclick=()=>changeMonth(1);
$('todayBtn').onclick=()=>{shownYear=today.getFullYear();shownMonth=today.getMonth();loadMonth();};
$('monthSelect').innerHTML=monthNames.map((m,i)=>`<option value="${i}">${m}</option>`).join('');
$('monthSelect').onchange=e=>{shownMonth=Number(e.target.value);loadMonth();};
$('yearSelect').onchange=e=>{const n=Number(e.target.value);if(n>=2000&&n<=2100){shownYear=n;loadMonth();}};
$('monthLabel').addEventListener('change',e=>{const i=monthNames.findIndex(m=>m.toLowerCase()===e.target.value.trim().toLowerCase());if(i>=0){shownMonth=i;loadMonth();}});
$('yearLabel').addEventListener('change',e=>{const n=Number(e.target.value);if(n>=2000&&n<=2100){shownYear=n;loadMonth();}});
$('generalNotes').addEventListener('input',save);
$('addOrder').onclick=()=>{data.orders.push({no:`AF-${String(data.orders.length+1).padStart(3,'0')}`,customer:'',item:'',qty:'',due:'',status:'New Order',notes:''});save();renderOrders();};
$('printBtn').onclick=()=>window.print();
$('exportBtn').onclick=()=>{const blob=new Blob([JSON.stringify({year:shownYear,month:shownMonth,data},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`AE-Order-Schedule-${shownYear}-${String(shownMonth+1).padStart(2,'0')}.json`;a.click();URL.revokeObjectURL(a.href);};
$('importBtn').onclick=()=>$('importFile').click();
$('importFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const parsed=JSON.parse(await f.text());if(parsed.data&&parsed.data.days&&Array.isArray(parsed.data.orders)){shownYear=Number(parsed.year)||shownYear;shownMonth=Number(parsed.month)||0;data=parsed.data;save();loadMonth();alert('Backup imported successfully.');}else alert('This file does not look like a schedule backup.');}catch(err){alert('Could not read this backup file.');}e.target.value='';};
renderLegend();loadMonth();
