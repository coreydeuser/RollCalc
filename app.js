const STORAGE_KEY='rollcalc_saved_rolls_v11';

document.addEventListener('DOMContentLoaded',()=>{
  const els={
    rollName:document.getElementById('rollName'),
    rollDate:document.getElementById('rollDate'),
    od:document.getElementById('od'),
    id:document.getElementById('id'),
    thickness:document.getElementById('thickness'),
    feetResult:document.getElementById('feetResult'),
    saveBtn:document.getElementById('saveBtn'),
    exportBtn:document.getElementById('exportBtn'),
    clearBtn:document.getElementById('clearBtn'),
    installBtn:document.getElementById('installBtn'),
    history:document.getElementById('history'),
    clearHistoryBtn:document.getElementById('clearHistoryBtn'),
    warningText:document.getElementById('warningText'),
    saveNote:document.getElementById('saveNote'),
    captureNote:document.getElementById('captureNote'),
    chipODID:document.getElementById('chip-odid'),
    chipThickness:document.getElementById('chip-thickness')
  };

  let saveNoteTimer=null;
  let mode='odid';
  let activeODIDField='od';
  let odidStage=1;

  function todayLocalDate(){
    const now=new Date();
    const offset=now.getTimezoneOffset()*60000;
    return new Date(now-offset).toISOString().slice(0,10);
  }

  function parseMeasurement(value){
    if(value==null) return 0;
    const cleaned=String(value).trim().replace(/,/g,'').replace(/[^0-9.\-]/g,'');
    const num=parseFloat(cleaned);
    return Number.isFinite(num)?num:0;
  }

  function formatTrimmed(value, decimals=4){
    const num=Number(value);
    if(!Number.isFinite(num)) return '';
    return num.toFixed(decimals).replace(/\.?0+$/,'');
  }

  function calcLengthInches(od,id,thickness){
    if(!(od>0)||!(id>=0)||!(thickness>0)||od<=id) return 0;
    return (Math.PI*((od*od)-(id*id)))/(4*thickness);
  }

  function currentValues(){
    const od=parseMeasurement(els.od.value);
    const id=parseMeasurement(els.id.value);
    const thickness=parseMeasurement(els.thickness.value);
    const inches=calcLengthInches(od,id,thickness);
    const feet=inches/12;
    return {od,id,thickness,inches,feet};
  }

  function showSaveNote(text){
    els.saveNote.textContent=text||'';
    if(saveNoteTimer) clearTimeout(saveNoteTimer);
    if(text) saveNoteTimer=setTimeout(()=>{els.saveNote.textContent='';},1800);
  }

  function updateResults(){
    const values=currentValues();
    els.feetResult.textContent=`${values.feet.toFixed(2)} ft`;
    let msg='';
    if(values.od&&values.id&&values.od<=values.id) msg='OD must be larger than ID.';
    else if(values.od||values.id||values.thickness){
      if(!values.thickness) msg='Enter a valid thickness.';
      else if(!values.feet) msg='Check the values.';
    }
    els.warningText.textContent=msg;
  }

  function setCaptureState(){
    els.od.classList.toggle('capture-ready',mode==='odid' && activeODIDField==='od');
    els.id.classList.toggle('capture-ready',mode==='odid' && activeODIDField==='id');
    els.thickness.classList.toggle('capture-ready',mode==='thickness');
    els.chipODID.classList.toggle('active',mode==='odid');
    els.chipThickness.classList.toggle('active',mode==='thickness');
  }

  function updateCaptureNote(){
    if(mode==='thickness'){
      els.captureNote.textContent='Thickness is armed. New input replaces the value. Enter finishes.';
    } else if(odidStage===1){
      els.captureNote.textContent=`${activeODIDField.toUpperCase()} is armed. First Enter moves to the other OD/ID box.`;
    } else {
      els.captureNote.textContent=`${activeODIDField.toUpperCase()} is armed. Second Enter sorts larger to OD and smaller to ID, then moves to Thickness.`;
    }
  }

  function armODID(which){
    mode='odid';
    activeODIDField=which;
    const active=which==='od'?els.od:els.id;
    active.focus();
    active.select?.();
    setCaptureState();
    updateCaptureNote();
  }

  function armThickness(){
    mode='thickness';
    els.thickness.focus();
    els.thickness.select?.();
    setCaptureState();
    updateCaptureNote();
  }

  function sortODID(){
    const a=parseMeasurement(els.od.value);
    const b=parseMeasurement(els.id.value);
    if(a>0 && b>0){
      const od=Math.max(a,b);
      const id=Math.min(a,b);
      els.od.value=formatTrimmed(od);
      els.id.value=formatTrimmed(id);
    }
    updateResults();
  }

  function setupReplaceField(el, fieldName){
    let replaceNext=false;

    el.addEventListener('focus',()=>{
      replaceNext=true;
      if(fieldName==='thickness'){
        mode='thickness';
      } else {
        mode='odid';
        activeODIDField=fieldName;
      }
      setCaptureState();
      updateCaptureNote();
      setTimeout(()=>el.select?.(),0);
    });

    el.addEventListener('pointerdown',()=>{
      replaceNext=true;
      if(fieldName==='thickness'){
        mode='thickness';
      } else {
        mode='odid';
        activeODIDField=fieldName;
      }
      setTimeout(()=>{ if(document.activeElement===el) el.select?.(); },0);
    });

    el.addEventListener('keydown',e=>{
      if(replaceNext && e.key.length===1){
        el.value='';
        replaceNext=false;
      }

      if(e.key==='Enter'){
        e.preventDefault();
        updateResults();

        if(fieldName==='thickness'){
          el.blur();
          mode='odid';
          setCaptureState();
          updateCaptureNote();
          replaceNext=true;
          return;
        }

        if(odidStage===1){
          odidStage=2;
          activeODIDField=(fieldName==='od') ? 'id' : 'od';
          armODID(activeODIDField);
        } else {
          sortODID();
          odidStage=1;
          armThickness();
        }
        replaceNext=true;
      }
    });

    el.addEventListener('input',()=>{
      updateResults();
      replaceNext=false;
    });

    el.addEventListener('change',updateResults);
  }

  function loadRolls(){
    try{return JSON.parse(localStorage.getItem(STORAGE_KEY))||[];}
    catch{return [];}
  }

  function saveRolls(rolls){
    localStorage.setItem(STORAGE_KEY,JSON.stringify(rolls));
  }

  function escapeHtml(value){
    return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
  }

  function renderHistory(){
    const rolls=loadRolls().sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    if(!rolls.length){
      els.history.innerHTML='<div class="empty">No rolls saved yet.</div>';
      return;
    }
    els.history.innerHTML=rolls.map(roll=>`
      <div class="history-item">
        <div class="name">${escapeHtml(roll.rollName||'Untitled Roll')}</div>
        <div class="date">${escapeHtml(roll.rollDate||'')}</div>
        <div class="feet">${Number(roll.feet).toFixed(2)} ft</div>
        <div class="meta">
          <div>OD: ${Number(roll.od).toFixed(3)} in</div>
          <div>ID: ${Number(roll.id).toFixed(3)} in</div>
          <div>Thickness: ${Number(roll.thickness).toFixed(4)} in</div>
        </div>
        <div style="margin-top:10px;"><button class="ghost tiny" type="button" data-delete="${roll.createdAt}">Delete</button></div>
      </div>`).join('');

    els.history.querySelectorAll('[data-delete]').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const createdAt=btn.getAttribute('data-delete');
        const rolls=loadRolls().filter(r=>r.createdAt!==createdAt);
        saveRolls(rolls);
        renderHistory();
        showSaveNote('Roll deleted');
      });
    });
  }

  function saveCurrentRoll(){
    const values=currentValues();
    const rollName=els.rollName.value.trim();
    const rollDate=els.rollDate.value||todayLocalDate();
    if(!rollName){
      els.warningText.textContent='Enter a roll name.';
      els.rollName.focus();
      return;
    }
    if(!(values.feet>0)){
      els.warningText.textContent='Enter valid OD, ID, and thickness values.';
      return;
    }
    const rolls=loadRolls();
    rolls.push({
      rollName,rollDate,
      od:values.od,id:values.id,thickness:values.thickness,
      inches:values.inches,feet:values.feet,
      createdAt:new Date().toISOString()
    });
    saveRolls(rolls);
    renderHistory();
    showSaveNote('Roll saved');
    els.warningText.textContent='';
  }

  function exportCSV(){
    const rolls=loadRolls().sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    if(!rolls.length){
      showSaveNote('No saved rolls to export');
      return;
    }
    const headers=['Roll Name','Date','OD (in)','ID (in)','Thickness (in)','Length (in)','Length (ft)'];
    const rows=rolls.map(r=>[
      r.rollName,r.rollDate,
      Number(r.od).toFixed(3),
      Number(r.id).toFixed(3),
      Number(r.thickness).toFixed(4),
      Number(r.inches).toFixed(2),
      Number(r.feet).toFixed(2)
    ]);
    const csv=[headers,...rows].map(row=>row.map(value=>`"${String(value).replaceAll('"','""')}"`).join(',')).join('\\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    const stamp=new Date().toISOString().slice(0,10);
    a.href=url;
    a.download=`rollcalc-export-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showSaveNote('CSV exported');
  }

  function clearInputs(){
    els.rollName.value='';
    els.rollDate.value=todayLocalDate();
    els.od.value='';
    els.id.value='';
    els.thickness.value='';
    els.warningText.textContent='';
    odidStage=1;
    updateResults();
    armODID('od');
    showSaveNote('');
  }

  function clearAllHistory(){
    if(!loadRolls().length) return;
    localStorage.removeItem(STORAGE_KEY);
    renderHistory();
    showSaveNote('All rolls cleared');
  }

  function showInstallHelp(){
    showSaveNote('Open in Safari, then Share → Add to Home Screen');
  }

  setupReplaceField(els.od,'od');
  setupReplaceField(els.id,'id');
  setupReplaceField(els.thickness,'thickness');

  els.saveBtn.addEventListener('click',saveCurrentRoll);
  els.exportBtn.addEventListener('click',exportCSV);
  els.clearBtn.addEventListener('click',clearInputs);
  els.installBtn.addEventListener('click',showInstallHelp);
  els.clearHistoryBtn.addEventListener('click',clearAllHistory);
  els.chipODID.addEventListener('click',()=>{odidStage=1;armODID('od');});
  els.chipThickness.addEventListener('click',()=>{odidStage=1;armThickness();});

  els.rollDate.value=todayLocalDate();
  renderHistory();
  updateResults();
  armODID('od');

  if('serviceWorker' in navigator){
    window.addEventListener('load',()=>{navigator.serviceWorker.register('./service-worker.js').catch(()=>{});});
  }
});
