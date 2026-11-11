// Music Course Builder V55 beta — browser-only Firebase client.
// Never add Firebase Admin SDK or service-account credentials to this file.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { getFirestore, collection, doc, getDocs, getDoc, onSnapshot, runTransaction, deleteDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
const firebaseConfig={apiKey:'AIzaSyD6pKMpxgNq39ggIBDrZtSPZHFtRX4WCkU',authDomain:'music-course-builder-aac32.firebaseapp.com',projectId:'music-course-builder-aac32',storageBucket:'music-course-builder-aac32.firebasestorage.app',messagingSenderId:'854096928683',appId:'1:854096928683:web:841ad064db269b2de37cee'};
const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app);
const el=id=>document.getElementById(id);
let authGeneration=0;
const lastCourseKey=uid=>'mcb_v55_last_cloud_course_'+uid;
function rememberCourse(id){if(!user)return;try{if(id)localStorage.setItem(lastCourseKey(user.uid),id);else localStorage.removeItem(lastCourseKey(user.uid))}catch(e){}}
function lastCourse(){try{return localStorage.getItem(lastCourseKey(user.uid))}catch(e){return null}}
let user=null,activeId=null,revision=0,loading=false, saving=false, pending=false, timer=null, courses=[], opening=false, changeCounter=0, unsubscribeActive=null, remoteConflict=false, listeningId=null;
const status=(message)=>{el('cloudStatus').textContent=message};
function saveState(state){
 const btn=el('cloudSave');if(!btn)return;
 const labels={idle:'Save to Cloud',dirty:'● Unsaved Changes',saving:'↻ Saving…',saved:'✓ Saved to Cloud',error:'⚠ Save Failed — Retry'};
 btn.dataset.state=state;btn.textContent=labels[state]||labels.idle;
 btn.disabled=!user||!activeId||state==='saving';
 btn.setAttribute('aria-label',state==='error'?'Retry saving course to cloud':btn.textContent);
}

function stopListening(){if(unsubscribeActive){unsubscribeActive();unsubscribeActive=null}listeningId=null;remoteConflict=false;}
function listenToActive(){
 stopListening();if(!user||!activeId)return;
 const id=activeId,uid=user.uid;listeningId=id;
 unsubscribeActive=onSnapshot(courseRef(id),async snap=>{
  if(!user||user.uid!==uid||activeId!==id||opening||loading||snap.metadata.hasPendingWrites)return;
  if(!snap.exists()){remoteConflict=true;saveState('error');status('This course was deleted on another device. Export your current course as JSON before leaving.');return}
  const d=snap.data(),remoteRevision=d.revision||0;
  if(remoteRevision<=revision)return;
  if(saving||pending||dirty){
   remoteConflict=true;saveState('error');
   status('CONFLICT: Another device updated this course. Your local edits have NOT been replaced. Export a JSON backup, then switch away and reopen to review the cloud version.');return;
  }
  if(!d.course||!Array.isArray(d.course.classes)){status('Cloud update ignored: invalid course data');return}
  loading=true;
  try{clearTimeout(timer);clearTimeout(autoTimer);fileHandle=null;await dbSet(null);
   if(!user||user.uid!==uid||activeId!==id)return;
   loadCourse(d.course);revision=remoteRevision;pending=false;dirty=false;remoteConflict=false;
   activeLabel();saveState('saved');status('Live update received from another device at '+new Date().toLocaleTimeString());
   setStatus('Course updated from cloud',true);
  }catch(e){status('Could not apply live update: '+e.message);console.error(e)}finally{loading=false}
 },e=>{if(activeId===id)status('Live synchronization disconnected: '+e.message)});
}
const activeLabel=()=>{const node=el('cloudActiveName');if(node)node.textContent=activeId?'Active course: '+(course.name||'Untitled course'):'Active course: none — choose a cloud course';};
const newId=()=>crypto.randomUUID?.()||('course-'+Date.now()+'-'+Math.random().toString(36).slice(2));
const courseRef=id=>doc(db,'users',user.uid,'courses',id);
const scrub=()=>JSON.parse(JSON.stringify(payload()));
function updateUi(){el('cloudUser').textContent=user?'Signed in: '+(user.email||'Google account'):'Local guest — not signed in';for(const id of ['cloudSignIn','cloudRegister','cloudGoogle','cloudEmail','cloudPassword'])el(id).hidden=!!user;el('cloudSignOut').hidden=!user;for(const id of ['cloudNew','cloudCopy','cloudRename','cloudDelete','cloudCourses'])el(id).disabled=!user;saveState(user&&activeId?'saved':'idle');}
function renderCourses(){const sel=el('cloudCourses');sel.innerHTML='';if(!courses.length){sel.add(new Option(user?'No cloud courses yet':'Sign in to see cloud courses',''));return}for(const c of courses)sel.add(new Option(c.name+(c.id===activeId?' (open)':''),c.id));if(activeId&&courses.some(c=>c.id===activeId))sel.value=activeId;}
async function refresh(){if(!user)return;const snap=await getDocs(collection(db,'users',user.uid,'courses'));courses=snap.docs.map(d=>({id:d.id,name:d.data().name||'Untitled course',updated:d.data().updatedAt?.toMillis?.()||0})).sort((a,b)=>b.updated-a.updated);renderCourses()}
async function load(id){if(!user||!id||opening)return false;if(id===activeId){status('This course is already open: '+(course.name||'Untitled course'));return true}if(saving){status('Please wait until the current course finishes saving.');return false}if(pending||dirty){if(!confirm('Open another cloud course? Unsaved changes in the current course may be lost. Export a JSON backup first if needed.'))return false}opening=true;try{const snap=await getDoc(courseRef(id));if(!snap.exists())throw Error('Cloud course not found');const d=snap.data();if(!d.course||!Array.isArray(d.course.classes))throw Error('Invalid cloud course data');stopListening();loading=true;try{clearTimeout(timer);clearTimeout(autoTimer);fileHandle=null;await dbSet(null);loadCourse(d.course);activeId=id;revision=d.revision||0;pending=false;dirty=false;rememberCourse(id);renderCourses();activeLabel();saveState('saved');status('Opened '+(d.name||'course')+' — cloud autosave enabled');setStatus('Cloud course opened',true);listenToActive();return true}finally{loading=false}}finally{opening=false}}
async function save(){if(!user||!activeId){status('Choose New blank course or open a cloud course first.');saveState('idle');return}if(saving){status('Cloud save already in progress…');return}if(remoteConflict){saveState('error');status('CONFLICT: Export a JSON backup and reopen the course before saving. No cloud data was overwritten.');return}if(!pending&&!dirty){saveState('saved');status('Already saved to Firebase — no changes to upload. Checked at '+new Date().toLocaleTimeString());return}status('Saving to Firebase…');clearTimeout(timer);saving=true;saveState('saving');const savedChangeCounter=changeCounter;const id=activeId,base=revision;const data=scrub();const ref=courseRef(id);try{const next=await runTransaction(db,async tx=>{const snap=await tx.get(ref);if(!snap.exists())throw Error('This course was deleted on another device. Export a JSON backup before proceeding.');const remote=snap.data();if((remote.revision||0)!==base)throw Error('Another device has edited this course. Export a JSON backup, then reopen the cloud course to review changes.');tx.update(ref,{name:data.name,course:data,revision:base+1,updatedAt:serverTimestamp()});return base+1});if(activeId===id){revision=next;remoteConflict=false;if(changeCounter===savedChangeCounter){dirty=false;pending=false;saveState('saved');status('Saved to Firebase at '+new Date().toLocaleTimeString())}else{pending=true;saveState('dirty');status('New edits made during save — another sync is needed.')} }await refresh()}catch(e){pending=true;saveState('error');status('Cloud save NOT completed: '+e.message+' — export a JSON backup if needed.');console.error(e)}finally{saving=false;if(pending&&changeCounter!==savedChangeCounter&&activeId===id){clearTimeout(timer);timer=setTimeout(save,1800)}}}
function changed(){if(loading||!user||!activeId)return;pending=true;changeCounter++;clearTimeout(timer);saveState('dirty');status('Unsynced changes — saving shortly…');timer=setTimeout(save,1800)}
async function createBlank(){
 if(!user)return;
 if(saving||pending||(activeId&&dirty)){status('Please wait for the current course to finish saving before creating another.');return}
 const name=prompt('Name for your new BLANK cloud course:','New Music Course');
 if(!name?.trim())return;
 const id=newId(),data=blankCourse();data.id=id;data.name=name.trim();
 try{
  await runTransaction(db,async tx=>{tx.set(courseRef(id),{name:data.name,course:data,revision:1,createdAt:serverTimestamp(),updatedAt:serverTimestamp()})});
  loading=true;
  try{stopListening();clearTimeout(timer);clearTimeout(autoTimer);fileHandle=null;await dbSet(null);loadCourse(data);activeId=id;revision=1;dirty=false;pending=false;rememberCourse(id)}finally{loading=false}
  await refresh();activeLabel();saveState('saved');status('Created blank course "'+data.name+'" — saved to Firebase');setStatus('New blank cloud course created',true);listenToActive();
 }catch(e){status('Could not create cloud course: '+e.message);console.error(e)}
}
async function duplicate(){if(!user||!activeId)return;if(saving||pending||dirty){status('Wait for your current course to finish saving before duplicating.');return}const name=prompt('Name for duplicate:',(course.name||'Course')+' copy');if(!name?.trim())return;const data=scrub(),id=newId();data.id=id;data.name=name.trim();try{await runTransaction(db,async tx=>tx.set(courseRef(id),{name:data.name,course:data,revision:1,createdAt:serverTimestamp(),updatedAt:serverTimestamp()}));stopListening();activeId=id;revision=1;rememberCourse(id);loading=true;loadCourse(data);loading=false;dirty=false;pending=false;await refresh();activeLabel();saveState('saved');status('Duplicate created and opened: '+data.name);setStatus('Duplicate cloud course created',true);listenToActive()}catch(e){status('Duplicate failed: '+e.message)}}
async function rename(){if(!activeId)return;const name=prompt('New course name:',course.name);if(!name?.trim())return;course.name=name.trim();fillFields();markDirty();await save()}
async function remove(){if(!activeId||!user)return;const id=activeId;if(!confirm('Permanently delete this cloud course? This deletion is not recoverable from Firebase. Export a JSON backup first.'))return;try{await deleteDoc(courseRef(id));stopListening();activeId=null;rememberCourse(null);revision=0;pending=false;dirty=false;loading=true;course=blankCourse();fillFields();loading=false;await refresh();activeLabel();saveState('idle');status('Cloud course deleted; local editor reset')}catch(e){status('Delete failed: '+e.message)}}
async function authCall(fn){try{await fn()}catch(e){status('Sign-in failed: '+e.message)}}
el('cloudSignIn').onclick=()=>authCall(()=>signInWithEmailAndPassword(auth,el('cloudEmail').value,el('cloudPassword').value));
el('cloudRegister').onclick=()=>authCall(()=>createUserWithEmailAndPassword(auth,el('cloudEmail').value,el('cloudPassword').value));
el('cloudGoogle').onclick=()=>authCall(async()=>{try{await signInWithPopup(auth,new GoogleAuthProvider())}catch(e){if(e.code==='auth/popup-blocked'||e.code==='auth/operation-not-supported-in-this-environment')await signInWithRedirect(auth,new GoogleAuthProvider());else throw e}});
el('cloudSignOut').onclick=()=>authCall(async()=>{if(pending||dirty){if(!confirm('Unsaved changes may be lost. Export a JSON backup before signing out. Continue?'))return}clearTimeout(timer);stopListening();activeId=null;revision=0;pending=false;await signOut(auth);status('Signed out. Local guest mode.');});
async function openSelected(){const sel=el('cloudCourses'),id=sel.value;try{const ok=await load(id);if(!ok&&activeId)sel.value=activeId}catch(e){status('Open failed: '+e.message);if(activeId)sel.value=activeId;console.error(e)}}
el('cloudCourses').onchange=openSelected;
el('cloudNew').onclick=createBlank;
el('cloudSave').onclick=save;
el('cloudCopy').onclick=duplicate;
el('cloudRename').onclick=rename;
el('cloudDelete').onclick=remove;
window.MCBCloud={active:()=>!!(user&&activeId),changed,save};
getRedirectResult(auth).catch(e=>status('Google redirect sign-in: '+e.message));
onAuthStateChanged(auth,async u=>{
 const generation=++authGeneration;
 stopListening();user=u;activeId=null;revision=0;pending=false;
 updateUi();activeLabel();
 try{
  if(user){
   status('Restoring your cloud course…');saveState('idle');
   await refresh();
   if(generation!==authGeneration)return;
   const remembered=lastCourse();
   const selected=(remembered&&courses.some(c=>c.id===remembered))?remembered:(courses[0]?.id||null);
   if(selected){
    if(remembered&&!courses.some(c=>c.id===remembered))status('Previous course unavailable. Opening another cloud course…');
    await load(selected);
    if(generation!==authGeneration)return;
   }else{
    loading=true;
    try{course=blankCourse();fillFields();dirty=false}finally{loading=false}
    status('No cloud courses yet. Create a new blank course.');saveState('idle');
   }
  }else{
   courses=[];renderCourses();status('Local guest mode. Cloud sync is off.');saveState('idle');
  }
 }catch(e){
  if(generation===authGeneration){status('Could not restore cloud course: '+e.message);saveState('error');console.error(e)}
 }finally{
  if(generation===authGeneration&&typeof window.MCBCloudAuthResolved==='function')window.MCBCloudAuthResolved();
 }
});
window.addEventListener('beforeunload',e=>{if(pending){e.preventDefault();e.returnValue=''}});
updateUi();
