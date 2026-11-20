const STORAGE_KEY = "docdash-queuezero-state-v1";
const initialState = {
  activeToken: 11,
  patientToken: 14,
  averageDuration: 12,
  doctorOffsetDelay: 0,
  doctorStatus: "In consultation",
  completed: [10],
  skipped: [],
  patientName: "Patient A",
  lastUpdated: Date.now()
};
let state = loadState();
let toastTimer;

function loadState(){
  try { return {...initialState, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}")}; }
  catch { return {...initialState}; }
}
function saveState(){
  state.lastUpdated = Date.now();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
}
function estimateWait(){
  const queuePosition = Math.max(0, state.patientToken - state.activeToken);
  return Math.max(0, (queuePosition - 1) * state.averageDuration + state.doctorOffsetDelay);
}
function patientsAhead(){ return Math.max(0, state.patientToken - state.activeToken - 1); }
function tokenLabel(n){ return `#${n}`; }
function showToast(message){
  const el = document.getElementById("global-toast");
  el.textContent = message; el.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(()=>el.classList.remove("show"),2600);
}
function setView(view){
  document.querySelectorAll(".view").forEach(el=>el.classList.remove("active-view"));
  document.getElementById(`${view}-view`).classList.add("active-view");
  document.querySelectorAll(".nav-item").forEach(el=>el.classList.toggle("active",el.dataset.view===view));
  const titles={patient:"Good evening, Patient A",doctor:"Doctor console",board:"Live queue board"};
  document.getElementById("page-title").textContent=titles[view];
}
document.querySelectorAll(".nav-item").forEach(btn=>btn.addEventListener("click",()=>setView(btn.dataset.view)));

function render(){
  const wait=estimateWait(), ahead=patientsAhead();
  const alert=document.getElementById("arrival-alert");
  document.getElementById("patient-token").textContent=tokenLabel(state.patientToken);
  document.getElementById("patient-wait").textContent=wait;
  document.getElementById("serving-token").textContent=tokenLabel(state.activeToken);
  document.getElementById("ahead-count").textContent=ahead + (state.activeToken < state.patientToken ? 1 : 0);
  document.getElementById("doctor-status").textContent=state.doctorStatus;
  document.getElementById("status-detail").textContent=state.doctorStatus==="In consultation"?"Dr. Mehta is seeing a patient":state.doctorStatus;
  document.getElementById("progress-bar").style.width=`${Math.min(100,Math.max(5,100-(wait/((state.patientToken-11)*12||36))*100))}%`;
  document.getElementById("progress-text").textContent=`${Math.max(0,Math.round(wait/36*100))}% to go`;
  document.getElementById("your-queue-time").textContent=`~${wait} min`;
  document.getElementById("doctor-serving").textContent=tokenLabel(state.activeToken);
  document.getElementById("doctor-waiting").textContent=Math.max(0,state.patientToken-state.activeToken);
  document.getElementById("doctor-average").innerHTML=`${state.averageDuration} <small>min</small>`;
  document.getElementById("current-patient-name").textContent=`Patient #${state.activeToken}`;
  document.getElementById("board-serving").textContent=tokenLabel(state.activeToken);
  document.getElementById("board-current").textContent=tokenLabel(state.activeToken);
  document.getElementById("board-next").textContent=tokenLabel(state.activeToken+1);
  document.getElementById("board-average").innerHTML=`${state.averageDuration} <small>min</small>`;
  document.getElementById("waiting-count-chip").textContent=`${Math.max(0,state.patientToken-state.activeToken)} patients`;
  // The amber alert is deliberately triggered at two patients ahead, as in the demo brief.
  alert.classList.toggle("show", ahead===2);
  renderQueueSteps(); renderWaitingLists();
}
function renderQueueSteps(){
  const host=document.getElementById("queue-steps");
  const start=Math.max(1,state.activeToken-1), end=Math.max(state.patientToken+1,state.activeToken+3);
  let html="";
  for(let n=start;n<=end;n++){
    let cls="upcoming",label="Waiting",time=`~${Math.max(0,n-state.activeToken)*state.averageDuration} min`;
    if(state.completed.includes(n)||state.skipped.includes(n)){cls="done";label=state.skipped.includes(n)?"Skipped":"Completed";time="Done";}
    else if(n===state.activeToken){cls="current";label="In consultation";time="Now";}
    else if(n===state.activeToken+1){cls="next";label="Up next";time=`~${state.averageDuration} min`;}
    if(n===state.patientToken){cls="yours";label="Your token";time=`~${estimateWait()} min`;}
    html+=`<div class="queue-step ${cls}"><span class="step-number">${cls==="done"?"✓":n}</span><div><strong>${n===state.patientToken?"Your token ":"Token "}${tokenLabel(n)}</strong><small>${label}</small></div><time>${time}</time></div>`;
  }
  host.innerHTML=html;
}
function renderWaitingLists(){
  const start=state.activeToken+1, end=Math.max(state.patientToken,state.activeToken+4);
  let waiting="",board="";
  for(let n=start;n<=end;n++){
    if(state.completed.includes(n)||state.skipped.includes(n)) continue;
    const isYours=n===state.patientToken;
    const eta=(n-state.activeToken-1)*state.averageDuration+state.doctorOffsetDelay;
    waiting+=`<div class="waiting-person"><div class="mini-token">${n}</div><div><strong>${isYours?state.patientName:`Patient #${n}`}</strong><small>${isYours?"Cardiology · Your appointment":"General consultation"}</small></div><time>${eta===0?"Next":`~${eta} min`}</time></div>`;
    board+=`<div class="board-person ${n===state.activeToken+1?"active":""}"><div class="mini-token">${n}</div><div><strong>${isYours?state.patientName:`Patient #${n}`}</strong><small>${isYours?"Your appointment":"Waiting for consultation"}</small></div><em>${n===state.activeToken+1?"NEXT":isYours?"YOUR TOKEN":"WAITING"}</em></div>`;
  }
  document.getElementById("doctor-waiting-list").innerHTML=waiting||'<p class="muted">No patients currently waiting.</p>';
  document.getElementById("board-list").innerHTML=board||'<p class="muted">No upcoming patients.</p>';
}
function advanceToken(){
  state.completed.push(state.activeToken);
  const current=state.appointments.find(a=>a.token===state.activeToken && a.status!=="cancelled");
  if(current) current.status="completed";
  state.activeToken++;
  // Bypass cancelled tokens so they are never called from the active queue.
  while(state.appointments.some(a=>a.token===state.activeToken && a.status==="cancelled")){
    state.activeToken++;
  }
  const next=state.appointments.find(a=>a.token===state.activeToken && a.status!=="cancelled");
  if(next) next.status="serving";
  state.doctorStatus="In consultation";
  state.doctorOffsetDelay=0;
  saveState();
  showToast(`Token ${tokenLabel(state.activeToken)} has been called. Patient screens updated.`);
  document.getElementById("doctor-toast").textContent=`${tokenLabel(state.activeToken)} called successfully.`;
}
document.getElementById("next-patient").addEventListener("click",advanceToken);
document.getElementById("complete-patient").addEventListener("click",()=>{
  if(!state.completed.includes(state.activeToken))state.completed.push(state.activeToken);
  state.doctorStatus="Ready for next patient"; saveState();
  document.getElementById("doctor-toast").textContent=`${tokenLabel(state.activeToken)} marked completed.`;
  showToast("Consultation marked completed.");
});
document.getElementById("delay-patient").addEventListener("click",()=>{
  state.doctorOffsetDelay+=10;state.doctorStatus="Delayed";saveState();
  document.getElementById("doctor-toast").textContent="A 10-minute delay has been added to estimated waits.";
  showToast("Queue estimates adjusted by 10 minutes.");
});
document.getElementById("skip-patient").addEventListener("click",()=>{
  state.skipped.push(state.activeToken);state.activeToken++;state.doctorStatus="In consultation";saveState();
  document.getElementById("doctor-toast").textContent="Absent token skipped. Queue advanced.";
  showToast("Absent token skipped; next patient called.");
});
document.getElementById("dismiss-alert").addEventListener("click",()=>document.getElementById("arrival-alert").classList.remove("show"));
const modal=document.getElementById("booking-modal");
function openModal(){modal.classList.add("open");modal.setAttribute("aria-hidden","false");}
function closeModal(){modal.classList.remove("open");modal.setAttribute("aria-hidden","true");}
document.getElementById("open-booking").addEventListener("click",openModal);
document.getElementById("show-booking").addEventListener("click",()=>showToast("Booking ID: DD-2026-0014 · Token "+tokenLabel(state.patientToken)));
document.getElementById("close-booking").addEventListener("click",closeModal);
modal.addEventListener("click",e=>{if(e.target===modal)closeModal();});
document.getElementById("booking-form").addEventListener("submit",e=>{
  e.preventDefault();
  state.patientName=document.getElementById("booking-name").value.trim()||"Patient";
  state.patientToken=Math.max(state.patientToken+1,state.activeToken+1);
  state.averageDuration=12;
  saveState();closeModal();showToast(`Booking confirmed! Your token is ${tokenLabel(state.patientToken)}.`);
});
// Cross-tab synchronization: open Patient Dashboard and Doctor Console in separate tabs to demo live updates.
window.addEventListener("storage",e=>{
  if(e.key===STORAGE_KEY&&e.newValue){try{state={...initialState,...JSON.parse(e.newValue)};render();}catch{}}
});
// Polling fallback also keeps the display fresh if another tab updates storage.
setInterval(()=>{
  const latest=loadState();
  if(latest.lastUpdated!==state.lastUpdated){state=latest;render();}
},1000);
render();