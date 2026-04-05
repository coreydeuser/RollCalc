const STORAGE_KEY='rollcalc_saved_rolls_v10';

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
    chipOd:document.getElementById('chip-od'),
    chipThickness:document.getElementById('chip-thickness')
  };

  let saveNoteTimer=null;
  let armedField=els.od;
  const measurementFields=[els.od,els.id,els.thickness];

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

  function formatTrimmed(value,decimals=4){
    const num=Number(value);
    if(!Number.isFinite(num)) return '';
    return num.toFixed(decimals).replace(/\.?0+$/,'');
  }

  function calcLengthInches(od,id,thicknessInches){
    if(!(od>0)||!(id>=0)||!(thicknessInches>0)||od<=id) return 0;
    return (Math.PI*((od*od)-(id*id)))/(4*thicknessInches);
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

  function setCaptureHighlight(activeField){
    els.od.classList.toggle('capture-ready',activeField===els.od||activeField===els.id);
    els.id.classList.toggle('capture-ready',activeField===els.od||activeField===els.id);
    els.thickness.classList.toggle('capture-ready',activeField===els.thickness);
    els.chipOd.classList.toggle('active',activeField===els.od||activeField===els.id);
    els.chipThickness.classList.toggle('active',activeField===els.thickness);
  }

  function updateCaptureNote(){
    if(armedField===els.thickness){
      els.captureNote.textContent='Thickness is armed. New input replaces the value. Enter finishes.';
    } else {
      els.captureNote.textContent='OD / ID auto-detect is armed. New input replaces the selected value, and Enter moves to Thickness after the OD/ID pair is set.';
    }
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

  function setODIDFromValues(a,b){
    const nums=[parseMeasurement(a),parseMeasurement(b)].filter(v=>v>0);
    if(!nums.length){
      els.od.value=''; els.id.value=''; return;
    }
    if(nums.length===1){
      els.od.value=formatTrimmed(nums[0]); els.id.value=''; return;
    }
    const od=Math.max(nums[0],nums[1]);
    const id=Math.min(nums[0],nums[1]);
    els.od.value=formatTrimmed(od);
    els.id.value=formatTrimmed(id);
  }

  function focusThickness(){
    armedField=els.thickness;
    els.thickness.focus();
    if(els.thickness.select) els.thickness.select();
    setCaptureHighlight(armedField);
    updateCaptureNote();
  }

  function focusODID(){
    armedField=els.od;
    els.od.focus();
    if(els.od.select) els.od.select();
    setCaptureHighlight(armedField);
    updateCaptureNote();
  }

  function handleODIDInput(targetEl,newRawValue){
    const newVal=parseMeasurement(newRawValue);
    if(!(newVal>0)){
      if(targetEl===els.od) els.od.value='';
      if(targetEl===els.id) els.id.value='';
      updateResults();
      return;
    }
    const otherEl=targetEl===els.od?els.id:els.od;
    const otherVal=parseMeasurement(otherEl.value);

    if(otherVal>0){
      setODIDFromValues(newVal,otherVal);
    } else {
      els.od.value=formatTrimmed(newVal);
      els.id.value='';
    }
    updateResults();
  }

  function setupODIDField(el){
    let replaceNext=false;

    el.addEventListener('focus',()=>{
      armedField=el;
      setCaptureHighlight(armedField);
      updateCaptureNote();
      replaceNext=true;
      setTimeout(()=>{ if(el.select) el.select(); },0);
    });

    el.addEventListener('pointerdown',()=>{
      armedField=el;
      replaceNext=true;
      setTimeout(()=>{ if(document.activeElement===el && el.select) el.select(); },0);
    });

    el.addEventListener('keydown',e=>{
      if(replaceNext && e.key.length===1){
        el.value='';
        replaceNext=false;
      }
      if(e.key==='Enter'){
        e.preventDefault();
        handleODIDInput(el,el.value);
        focusThickness();
        replaceNext=true;
      }
    });

    el.addEventListener('input',()=>{
      handleODIDInput(el,el.value);
      replaceNext=false;
    });

    el.addEventListener('change',()=>handleODIDInput(el,el.value));
  }

  function setupThicknessField(el){
    let replaceNext=false;

    el.addEventListener('focus',()=>{
      armedField=el;
      setCaptureHighlight(armedField);
      updateCaptureNote();
      replaceNext=true;
      setTimeout(()=>{ if(el.select) el.select(); },0);
    });

    el.addEventListener('pointerdown',()=>{
      armedField=el;
      replaceNext=true;
      setTimeout(()=>{ if(document.activeElement===el && el.select) el.select(); },0);
    });

    el.addEventListener('keydown',e=>{
      if(replaceNext && e.key.length===1){
        el.value='';
        replaceNext=false;
      }
      if(e.key==='Enter'){
        e.preventDefault();
        updateResults();
        el.blur();
        setCaptureHighlight(null);
        updateCaptureNote();
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
        <div style="margin-top:10px;">
          <button class="ghost tiny" type="button" data-delete="${roll.createdAt}">Delete</button>
        </div>
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
    updateResults();
    focusODID();
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

  setupODIDField(els.od);
  setupODIDField(els.id);
  setupThicknessField(els.thickness);

  els.saveBtn.addEventListener('click',saveCurrentRoll);
  els.exportBtn.addEventListener('click',exportCSV);
  els.clearBtn.addEventListener('click',clearInputs);
  els.installBtn.addEventListener('click',showInstallHelp);
  els.clearHistoryBtn.addEventListener('click',clearAllHistory);
  els.chipOd.addEventListener('click',focusODID);
  els.chipThickness.addEventListener('click',focusThickness);

  els.rollDate.value=todayLocalDate();
  renderHistory();
  updateResults();
  focusODID();

  if('serviceWorker' in navigator){
    window.addEventListener('load',()=>{
      navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
    });
  }
});
