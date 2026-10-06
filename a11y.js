/* VocVoc accessibility layer: dialog focus management, keyboard behaviour for the custom dropdowns, accessible names and
   live announcements. It only adds focus/ARIA behaviour on top of the existing markup; what a control does is unchanged. */
'use strict';
(()=>{
  const FOCUSABLE='a[href],button,input:not([type="hidden"]),select,textarea,summary,[tabindex]';
  // [overlay id, how Escape closes it (null = the owner handles Escape itself), control to focus first (null = the panel itself)]
  const DIALOGS=[
    ['modalOverlay',()=>closeModal(),null],
    ['languageChangeOverlay',()=>cancelLearningLanguageChange(),'#languageChangeCancelBtn'],
    ['resetConfirmOverlay',()=>closeResetConfirmation(),'#resetCancelBtn'],
    ['archiveOverlay',()=>closeArchive(),null],
    ['historyDetails',()=>closeHistoryDetail(),null],
    ['relatedWordPopup',()=>closeRelatedWordPopup(),null],
    ['flipOverlay',null,'#flipCard']
  ];
  const DYNAMIC=new Set(['archiveOverlay','historyDetails','relatedWordPopup','flipOverlay']); // their content is re-rendered while open
  const stack=[],focusLog=[];
  const visible=el=>el.getClientRects().length>0&&getComputedStyle(el).visibility!=='hidden';
  const isShown=el=>{const style=getComputedStyle(el);return style.display!=='none'&&style.visibility!=='hidden';};
  const focusables=root=>[...root.querySelectorAll(FOCUSABLE)].filter(el=>!el.disabled&&el.tabIndex>=0&&!el.closest('[inert],[hidden],[aria-hidden="true"]')&&visible(el));
  const panelOf=el=>{
    const panel=el.querySelector(':scope > .modal, :scope > .confirm-panel, :scope > .archive-panel, :scope > .word-popup-shell, :scope > .flip-layout, :scope > .ui-panel')||el;
    if(!panel.hasAttribute('tabindex'))panel.setAttribute('tabindex','-1');
    return panel;
  };
  const remember=target=>{if(target&&target.nodeType===1){focusLog.push(target);if(focusLog.length>10)focusLog.shift();}};
  // Where focus was just before a dialog opened. pointerdown covers browsers that do not focus a clicked button (Safari).
  document.addEventListener('focusin',event=>remember(event.target));
  document.addEventListener('pointerdown',event=>remember(event.target.closest?.(FOCUSABLE)),true);

  // The opener may have been re-rendered while the dialog was open (History chips): find its replacement.
  function reacquire(opener){
    if(!opener)return null;
    if(opener.isConnected&&visible(opener))return opener;
    // A chosen dropdown option disappears with its menu: the control that owns the menu is the right place to return to.
    const group=opener.closest?.('.ui-dropdown,.ui-combo'),owner=group&&triggerOf(group);
    if(owner&&visible(owner))return owner;
    let found=null;
    if(opener.id)found=document.getElementById(opener.id);
    else if(opener.dataset?.historyWord)found=document.querySelector(`.history-chip[data-history-word="${CSS.escape(opener.dataset.historyWord)}"]`);
    else if(opener.dataset?.relatedWord)found=document.querySelector(`.clickable-badge[data-related-word="${CSS.escape(opener.dataset.relatedWord)}"]`);
    return found&&visible(found)?found:null;
  }
  function focusInside(entry){
    const {el,initial}=entry,target=(initial&&el.querySelector(initial))||panelOf(el);
    if(target&&!el.contains(document.activeElement))target.focus({preventScroll:true});
  }
  function giveBack(entry){
    const active=document.activeElement;
    if(active&&active!==document.body&&!entry.el.contains(active))return; // focus already went somewhere else on purpose
    (reacquire(entry.opener)||document.getElementById('searchInput'))?.focus({preventScroll:true});
  }
  function sync(){
    for(const [id,close,initial] of DIALOGS){
      const el=document.getElementById(id);if(!el)continue;
      const entry=stack.find(item=>item.el===el),shown=isShown(el);
      if(shown&&!entry){
        const opener=[...focusLog].reverse().find(item=>item.isConnected&&!el.contains(item))||null;
        const created={el,close,initial,opener};stack.push(created);focusInside(created);
      }else if(!shown&&entry){
        stack.splice(stack.indexOf(entry),1);giveBack(entry);
      }else if(shown&&entry&&entry===stack[stack.length-1]&&!el.contains(document.activeElement)){
        focusInside(entry); // content was replaced while open (next word, re-rendered list): keep focus in the dialog
      }
    }
  }
  const observer=new MutationObserver(()=>sync());
  function watchDialogs(){
    for(const [id] of DIALOGS){
      const el=document.getElementById(id);if(!el)continue;
      observer.observe(el,{attributes:true,attributeFilter:['style','class','hidden'],childList:DYNAMIC.has(id),subtree:DYNAMIC.has(id)});
    }
    sync();
  }

  // Tab stays inside the topmost dialog.
  document.addEventListener('keydown',event=>{
    if(event.key!=='Tab'||!stack.length)return;
    const {el}=stack[stack.length-1],items=focusables(el),active=document.activeElement;
    if(!items.length){event.preventDefault();panelOf(el).focus({preventScroll:true});return;}
    const first=items[0],last=items[items.length-1];
    if(!el.contains(active)){event.preventDefault();(event.shiftKey?last:first).focus();return;}
    if(event.shiftKey&&(active===first||active===panelOf(el))){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&active===last){event.preventDefault();first.focus();}
  },true);

  // Keyboard support for the custom dropdowns (button + list of buttons) and the daily-limit combo box.
  const closeMenus=()=>{closeUiDropdowns();closeDailyLimitMenu();};
  const menuOf=dd=>dd.querySelector('.ui-dropdown-menu');
  const optionsOf=dd=>[...dd.querySelectorAll('.ui-dropdown-option')].filter(visible);
  const triggerOf=dd=>dd.querySelector('.ui-dropdown-trigger')||dd.querySelector('.daily-limit-toggle');
  function focusOption(dd,which){
    const items=optionsOf(dd);if(!items.length)return;
    const current=items.indexOf(document.activeElement),selected=Math.max(0,items.findIndex(item=>item.classList.contains('selected')));
    const index=which==='first'?0:which==='last'?items.length-1:which==='selected'?selected:Math.min(items.length-1,Math.max(0,current+which));
    items[index].focus();
  }
  document.addEventListener('keydown',event=>{
    const dd=event.target.closest?.('.ui-dropdown,.ui-combo');if(!dd)return;
    const open=dd.classList.contains('open'),inMenu=!!event.target.closest('.ui-dropdown-menu');
    if(event.key==='Escape'&&open){event.preventDefault();closeMenus();triggerOf(dd)?.focus();return;}
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){
      event.preventDefault();
      if(!open){triggerOf(dd)?.click();focusOption(dd,event.key==='ArrowDown'?'selected':'last');}
      else focusOption(dd,event.key==='ArrowDown'?1:-1);
    }else if(inMenu&&(event.key==='Home'||event.key==='End')){event.preventDefault();focusOption(dd,event.key==='Home'?'first':'last');}
  });
  document.addEventListener('click',event=>{
    const dd=event.target.closest?.('.ui-dropdown,.ui-combo');if(!dd)return;
    if(event.target.closest('.ui-dropdown-trigger,.daily-limit-toggle')){
      // Opened from the keyboard (Enter/Space, detail===0): put focus on the current option.
      if(event.detail===0&&dd.classList.contains('open'))focusOption(dd,'selected');
    }else if(event.target.closest('.ui-dropdown-option')){
      // A chosen option disappears with the menu: return focus to the control, unless a dialog (language change) took it.
      const active=document.activeElement;
      if(!active||active===document.body||dd.contains(active))(dd.querySelector('.ui-combo-control input')||triggerOf(dd))?.focus({preventScroll:true});
    }
  });
  document.addEventListener('focusout',event=>{
    const dd=event.target.closest?.('.ui-dropdown.open,.ui-combo.open'),next=event.relatedTarget;
    if(dd&&next&&!dd.contains(next))closeMenus(); // keyboard focus left an open menu
  });

  // Escape closes the topmost dialog. Registered after the dropdown handler above, which consumes Escape first when a menu is open.
  // Flip (close === null) handles its own Escape.
  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape'||event.defaultPrevented||event.isComposing||!stack.length)return;
    const top=stack[stack.length-1];
    if(!top.close)return;
    event.preventDefault();top.close();
  });

  // Accessible names. Re-run whenever the interface language changes (applyAppLanguage).
  let named=false;
  function caption(id,text){
    let el=document.getElementById(id);
    if(!el){el=document.createElement('span');el.id=id;el.className='sr-only';document.body.append(el);}
    el.textContent=text;return el.id;
  }
  function refreshAccessibleNames(){
    const text=key=>typeof t==='function'?t(key):key;
    // Text fields are named like their placeholder.
    for(const id of ['searchInput','historyFilterInput','archiveSearchInput']){
      const input=document.getElementById(id);if(input&&input.placeholder)input.setAttribute('aria-label',input.placeholder);
    }
    // Settings rows: the dropdown button is named "<row label>: <current value>".
    for(const row of document.querySelectorAll('.settings-row')){
      const label=row.querySelector('label[id]'),trigger=row.querySelector('.ui-dropdown-trigger'),value=trigger?.querySelector('.ui-dropdown-label');
      if(label&&trigger&&value){if(!value.id)value.id=`${label.id}Value`;trigger.setAttribute('aria-labelledby',`${label.id} ${value.id}`);}
    }
    // History/Archive filter and sort dropdowns have no visible label: "<what it does>: <current value>".
    for(const [dropdown,key] of [['historyStatusDropdown','statusFilter'],['historySortDropdown','sortOrder'],['archiveStatusDropdown','statusFilter'],['archiveSortDropdown','sortOrder']]){
      const dd=document.getElementById(dropdown),trigger=dd?.querySelector('.ui-dropdown-trigger'),value=trigger?.querySelector('.ui-dropdown-label');
      if(!trigger||!value)continue;
      if(!value.id)value.id=`${dropdown}Value`;
      trigger.setAttribute('aria-labelledby',`${caption(`${dropdown}Caption`,text(key))} ${value.id}`);
    }
    for(const trigger of document.querySelectorAll('.ui-dropdown-trigger,.daily-limit-toggle'))trigger.setAttribute('aria-haspopup','true');
    document.getElementById('apiToggleBtn')?.setAttribute('aria-controls','apiKeyInput');
    named=true;
  }

  // Polite live announcements (status changes that are otherwise only visual).
  let announcer=null;
  window.announce=message=>{
    if(!announcer){announcer=document.createElement('div');announcer.id='a11yAnnouncer';announcer.className='sr-only';announcer.setAttribute('role','status');announcer.setAttribute('aria-live','polite');announcer.setAttribute('aria-atomic','true');document.body.append(announcer);}
    announcer.textContent='';setTimeout(()=>{announcer.textContent=String(message||'');},40);
  };
  window.refreshAccessibleNames=refreshAccessibleNames;

  const start=()=>{watchDialogs();if(!named)refreshAccessibleNames();};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
