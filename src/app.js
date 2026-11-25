import { auth, db, storage } from "./firebase.js";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signInAnonymously, onAuthStateChanged, signOut, updateProfile
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import {
  ref, set, get, push, update, remove, onValue, query, limitToLast,
  serverTimestamp, onDisconnect
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js";
import {
  ref as storageRef, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-storage.js";

const $ = id => document.getElementById(id);
let user = null, activeServer = null, activeChannel = null, stopMessages = null, stopMembers = null;
let servers = {}, currentMessages = new Set();

function showError(message) { $("authError").textContent = message; }
function safeText(value="") { return String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function avatarHTML(name, photo) { return `<div class="avatar">${photo ? `<img src="${safeText(photo)}" alt="">` : safeText((name||"?").slice(0,1).toUpperCase())}</div>`; }
function openModal(title, fields, submitText="Confirmar") {
  $("modalTitle").textContent = title;
  $("modalBody").innerHTML = fields;
  $("modalSubmit").textContent = submitText;
  $("modal").showModal();
  return new Promise(resolve => {
    const form = $("modalForm");
    const done = e => { if (e.submitter?.value === "cancel") return; e.preventDefault(); const data = Object.fromEntries([...new FormData(form).entries()]); $("modal").close(); form.removeEventListener("submit", done); resolve(data); };
    form.addEventListener("submit", done, { once:true });
    $("modal").addEventListener("close", () => resolve(null), { once:true });
  });
}

$("loginBtn").onclick = async () => {
  try { await signInWithEmailAndPassword(auth, $("email").value.trim(), $("password").value); showError(""); }
  catch(e) { showError(authMessage(e)); }
};
$("registerBtn").onclick = async () => {
  try {
    const cred = await createUserWithEmailAndPassword(auth, $("email").value.trim(), $("password").value);
    await updateProfile(cred.user, { displayName: $("email").value.split("@")[0] });
    await set(ref(db, `users/${cred.user.uid}/profile`), { displayName: cred.user.displayName, bio:"", status:"Online", createdAt:serverTimestamp() });
  } catch(e) { showError(authMessage(e)); }
};
$("anonymousBtn").onclick = async () => { try { await signInAnonymously(auth); } catch(e) { showError(authMessage(e)); } };
$("logoutBtn").onclick = () => signOut(auth);
function authMessage(e) {
  const map = {"auth/invalid-email":"E-mail inválido.","auth/weak-password":"A senha precisa ter pelo menos 6 caracteres.","auth/email-already-in-use":"Este e-mail já está cadastrado.","auth/invalid-credential":"E-mail ou senha incorretos.","auth/operation-not-allowed":"Ative este método de login no Firebase Authentication."};
  return map[e.code] || e.message || "Não foi possível autenticar.";
}

onAuthStateChanged(auth, async u => {
  user = u;
  $("auth").classList.toggle("hidden", !!u);
  $("app").classList.toggle("hidden", !u);
  if (!u) { if(stopMessages) stopMessages(); if(stopMembers) stopMembers(); return; }
  const profileRef = ref(db, `users/${u.uid}/profile`);
  const snap = await get(profileRef);
  if (!snap.exists()) await set(profileRef, { displayName:u.displayName || (u.isAnonymous ? "Visitante" : "Usuário"), bio:"", status:"Online", createdAt:serverTimestamp() });
  const p = (await get(profileRef)).val() || {};
  $("myName").textContent = p.displayName || u.displayName || "Usuário";
  $("myAvatar").textContent = ($("myName").textContent[0] || "?").toUpperCase();
  const presenceRef = ref(db, `presence/${u.uid}`);
  await set(presenceRef, { state:"online", lastChanged:serverTimestamp() });
  onDisconnect(presenceRef).set({ state:"offline", lastChanged:serverTimestamp() });
  $("connectionState").textContent = "Conectado ao Firebase";
  await loadServers();
});

async function loadServers() {
  const membership = await get(ref(db, `userServers/${user.uid}`));
  const ids = Object.keys(membership.val() || {});
  servers = {};
  for (const id of ids) {
    const s = await get(ref(db, `servers/${id}`));
    if (s.exists()) servers[id] = s.val();
  }
  renderServers();
  const first = ids.find(id => servers[id]);
  if (first) selectServer(first);
  else { $("serverTitle").textContent = "Mensagens"; $("textChannels").innerHTML = ""; $("voiceChannels").innerHTML = ""; }
}
function renderServers() {
  $("serverList").innerHTML = Object.entries(servers).map(([id,s]) =>
    `<button class="server-icon ${id===activeServer?"active":""}" data-server="${safeText(id)}" title="${safeText(s.name)}">${s.iconUrl ? `<img src="${safeText(s.iconUrl)}">` : safeText((s.name||"S").slice(0,2).toUpperCase())}</button>`
  ).join("");
  document.querySelectorAll("[data-server]").forEach(b => b.onclick = () => selectServer(b.dataset.server));
}
async function selectServer(id) {
  activeServer = id; activeChannel = null;
  const s = servers[id]; $("serverTitle").textContent = s.name || "Servidor";
  renderServers();
  const snap = await get(ref(db, `servers/${id}/channels`));
  const channels = snap.val() || {};
  const text = Object.entries(channels).filter(([,c])=>c.type==="text");
  const voice = Object.entries(channels).filter(([,c])=>c.type==="voice");
  $("textChannels").innerHTML = text.map(([cid,c])=>`<button class="channel-item" data-channel="${safeText(cid)}"># ${safeText(c.name)}</button>`).join("") || `<small class="muted">Nenhum canal de texto</small>`;
  $("voiceChannels").innerHTML = voice.map(([cid,c])=>`<button class="channel-item" data-voice="${safeText(cid)}">◖ ${safeText(c.name)} <span class="muted">Entrar</span></button>`).join("");
  document.querySelectorAll("[data-channel]").forEach(b=>b.onclick=()=>selectChannel(b.dataset.channel, channels[b.dataset.channel].name));
  document.querySelectorAll("[data-voice]").forEach(b=>b.onclick=()=>startVoice(b.dataset.voice, channels[b.dataset.voice].name));
  const first = text[0];
  if(first) selectChannel(first[0], first[1].name);
  else { $("messages").innerHTML = `<div class="welcome"><h2>Sem canais de texto</h2><p>Crie um canal para começar.</p></div>`; }
  await loadMembers();
}
async function selectChannel(id, name) {
  activeChannel = id; $("channelTitle").textContent = name;
  document.querySelectorAll("[data-channel]").forEach(b=>b.classList.toggle("active", b.dataset.channel===id));
  if(stopMessages) stopMessages();
  $("messages").innerHTML = "";
  const q = query(ref(db, `messages/${activeServer}/${id}`), limitToLast(100));
  stopMessages = onValue(q, snap => {
    const rows = Object.entries(snap.val() || {});
    $("messages").innerHTML = rows.map(([mid,m]) => renderMessage(mid,m)).join("") || `<div class="welcome"><div class="welcome-icon">✦</div><h2>Comece a conversa</h2><p>Envie a primeira mensagem deste canal.</p></div>`;
    $("messages").scrollTop = $("messages").scrollHeight;
    document.querySelectorAll("[data-delete]").forEach(b=>b.onclick=()=>deleteOwnMessage(b.dataset.delete));
  }, err => $("uploadStatus").textContent = `Erro ao carregar mensagens: ${err.message}`);
}
function renderMessage(id,m) {
  const date = m.createdAt ? new Date(m.createdAt).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}) : "";
  const attachment = m.fileUrl ? (m.fileType?.startsWith("image/") ? `<img class="attachment" src="${safeText(m.fileUrl)}" alt="Imagem enviada">` : `<a href="${safeText(m.fileUrl)}" target="_blank" rel="noopener">📎 ${safeText(m.fileName||"Arquivo")}</a>`) : "";
  return `<article class="message">${avatarHTML(m.authorName,m.authorPhoto)}<div class="message-body"><div class="message-meta"><strong>${safeText(m.authorName||"Usuário")}</strong><time>${date}</time>${m.uid===user.uid?`<button class="icon-btn" data-delete="${safeText(id)}" title="Excluir">×</button>`:""}</div><div class="message-text">${safeText(m.text||"")}</div>${attachment}</div></article>`;
}
async function deleteOwnMessage(id) {
  const snap = await get(ref(db, `messages/${activeServer}/${activeChannel}/${id}`));
  if (snap.exists() && snap.val().uid===user.uid) await remove(ref(db, `messages/${activeServer}/${activeChannel}/${id}`));
}
$("messageForm").onsubmit = async e => {
  e.preventDefault(); const text = $("messageInput").value.trim();
  if (!text || !activeServer || !activeChannel) return;
  $("messageInput").value = "";
  try {
    const p = (await get(ref(db, `users/${user.uid}/profile`))).val() || {};
    await push(ref(db, `messages/${activeServer}/${activeChannel}`), { uid:user.uid, authorName:p.displayName||user.displayName||"Usuário", text, createdAt:Date.now() });
  } catch(e) { $("uploadStatus").textContent = `Falha ao enviar: ${e.message}`; $("messageInput").value = text; }
};
$("fileInput").onchange = async e => {
  const file = e.target.files[0]; if(!file) return;
  if(!activeServer || !activeChannel) { alert("Selecione um canal primeiro."); return; }
  const allowed = ["image/png","image/jpeg","image/gif","image/webp","application/pdf","text/plain"];
  if(!allowed.includes(file.type) || file.size > 8*1024*1024) { alert("Arquivo não permitido. Use PNG/JPG/GIF/WEBP/PDF/TXT de até 8 MB."); e.target.value=""; return; }
  $("uploadStatus").textContent = "Enviando arquivo…";
  try {
    const path = `uploads/${activeServer}/${activeChannel}/${user.uid}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
    const obj = await uploadBytes(storageRef(storage,path),file,{contentType:file.type});
    const url = await getDownloadURL(obj.ref);
    const p = (await get(ref(db,`users/${user.uid}/profile`))).val()||{};
    await push(ref(db,`messages/${activeServer}/${activeChannel}`),{uid:user.uid,authorName:p.displayName||"Usuário",text:"",fileUrl:url,fileName:file.name,fileType:file.type,createdAt:Date.now()});
    $("uploadStatus").textContent = "Arquivo enviado.";
  } catch(err) { $("uploadStatus").textContent = `Erro no upload: ${err.message}`; }
  e.target.value="";
};
$("emojiBtn").onclick = () => { $("messageInput").value += " 😀"; $("messageInput").focus(); };
async function loadMembers() {
  if(stopMembers) stopMembers();
  stopMembers = onValue(ref(db,`servers/${activeServer}/members`), async snap => {
    const ids = Object.keys(snap.val()||{});
    const rows = await Promise.all(ids.map(async uid => {
      const p=(await get(ref(db,`users/${uid}/profile`))).val()||{};
      const presence=(await get(ref(db,`presence/${uid}`))).val()||{};
      return `<div class="member">${avatarHTML(p.displayName||"Usuário",p.photoURL)}<span>${safeText(p.displayName||"Usuário")}</span><i class="online-dot" style="background:${presence.state==="online"?"#54d28a":"#606779"}"></i></div>`;
    }));
    $("memberList").innerHTML=rows.join("");
  });
}
$("createServerBtn").onclick = async () => {
  const d=await openModal("Criar servidor",`<label>Nome<input name="name" maxlength="40" required placeholder="Minha comunidade"></label><label>Descrição<textarea name="description" maxlength="180"></textarea></label>`);
  if(!d?.name?.trim()) return;
  try {
    const s=push(ref(db,"servers")); const id=s.key;
    const p=(await get(ref(db,`users/${user.uid}/profile`))).val()||{};
    await set(s,{name:d.name.trim(),description:d.description||"",ownerId:user.uid,createdAt:Date.now(),members:{[user.uid]:{role:"owner",joinedAt:Date.now()}},channels:{general:{name:"geral",type:"text"},voice:{name:"Sala de voz",type:"voice"}}});
    await set(ref(db,`userServers/${user.uid}/${id}`),true);
    await loadServers(); selectServer(id);
  } catch(e) { alert(`Não foi possível criar. Confira as regras do Realtime Database: ${e.message}`); }
};
$("createChannelBtn").onclick = async () => {
  if(!activeServer) return alert("Crie ou entre em um servidor.");
  const d=await openModal("Criar canal",`<label>Nome<input name="name" maxlength="40" required></label><label>Tipo<select name="type"><option value="text">Texto</option><option value="voice">Voz</option></select></label>`);
  if(!d?.name?.trim()) return;
  const key=push(ref(db,`servers/${activeServer}/channels`)).key;
  try { await set(ref(db,`servers/${activeServer}/channels/${key}`),{name:d.name.trim().toLowerCase().replace(/\s+/g,"-"),type:d.type,createdAt:Date.now()}); await selectServer(activeServer); }
  catch(e) { alert(`Falha ao criar canal: ${e.message}`); }
};
$("serverMenuBtn").onclick = async () => {
  if(!activeServer) return;
  const d=await openModal("Convidar pessoas",`<p>Compartilhe o ID do servidor com quem deseja convidar. O ingresso por convite público ainda requer uma função de backend para validar e consumir códigos com segurança.</p><label>ID do servidor<input name="id" value="${safeText(activeServer)}" readonly></label>`);
};
$("profileBtn").onclick = async () => {
  const p=(await get(ref(db,`users/${user.uid}/profile`))).val()||{};
  const d=await openModal("Editar perfil",`<label>Nome de exibição<input name="displayName" maxlength="32" value="${safeText(p.displayName||"")}"></label><label>Biografia<textarea name="bio" maxlength="160">${safeText(p.bio||"")}</textarea></label><label>Status<input name="status" maxlength="40" value="${safeText(p.status||"Online")}"></label>`);
  if(!d) return;
  await update(ref(db,`users/${user.uid}/profile`),d);
  $("myName").textContent=d.displayName||"Usuário";
};
$("membersToggle").onclick=()=>$("membersPanel").classList.toggle("show");
$("mobileMenuBtn").onclick=()=>$("channelSidebar").classList.toggle("open");

// Chamadas: camada WebRTC de demonstração funcional para 1 par. Para produção,
// implemente gerenciamento de salas/grupos, TURN autenticado e sinalização protegida.
let pc=null, localStream=null, callRoom=null, stopSignal=null, micEnabled=true, cameraEnabled=false;
const rtcConfig={iceServers:[{urls:"stun:stun.l.google.com:19302"}]}; // Adicione TURN próprio/credenciais temporárias no backend.
async function startVoice(channelId,channelName) {
  if(!activeServer) return;
  try {
    localStream=await navigator.mediaDevices.getUserMedia({audio:true,video:false});
    await startCall(channelId,channelName,localStream);
  } catch(e) { alert(`Não foi possível acessar o microfone: ${e.message}. Verifique as permissões e use HTTPS.`); }
}
async function startCall(channelId,channelName,stream) {
  $("callDock").classList.remove("hidden"); $("callTitle").textContent=channelName; $("callStatus").textContent="Aguardando outro participante";
  $("localVideo").srcObject=stream; callRoom=`${activeServer}_${channelId}`;
  pc=new RTCPeerConnection(rtcConfig); stream.getTracks().forEach(t=>pc.addTrack(t,stream));
  pc.ontrack=e=>{let v=document.getElementById("remoteVideo");if(!v){v=document.createElement("video");v.id="remoteVideo";v.autoplay=true;v.playsInline=true;$("callVideos").append(v);}v.srcObject=e.streams[0];$("callStatus").textContent="Conectado";};
  const signalRef=ref(db,`callSignals/${callRoom}`);
  pc.onicecandidate=e=>{if(e.candidate) push(ref(db,`callSignals/${callRoom}/candidates/${user.uid}`),e.candidate.toJSON());};
  const snap=await get(signalRef);
  if(!snap.exists() || !snap.val()?.offer) {
    const offer=await pc.createOffer(); await pc.setLocalDescription(offer);
    await update(signalRef,{caller:user.uid,offer:{type:offer.type,sdp:offer.sdp},createdAt:Date.now()});
  } else if(snap.val().caller!==user.uid && snap.val().offer) {
    await pc.setRemoteDescription(new RTCSessionDescription(snap.val().offer));
    const answer=await pc.createAnswer(); await pc.setLocalDescription(answer);
    await update(signalRef,{answer:{type:answer.type,sdp:answer.sdp},callee:user.uid});
  }
  stopSignal=onValue(signalRef,s=>{const v=s.val();if(v?.answer&&v.caller===user.uid&&!pc.currentRemoteDescription)pc.setRemoteDescription(new RTCSessionDescription(v.answer)).catch(()=>{});});
  onValue(ref(db,`callSignals/${callRoom}/candidates`),s=>{const all=s.val()||{};for(const [uid,items] of Object.entries(all)){if(uid!==user.uid)Object.values(items||{}).forEach(c=>pc.addIceCandidate(new RTCIceCandidate(c)).catch(()=>{}));}});
}
$("micBtn").onclick=()=>{if(!localStream)return;micEnabled=!micEnabled;localStream.getAudioTracks().forEach(t=>t.enabled=micEnabled);$("micBtn").textContent=micEnabled?"🎙 Microfone":"🔇 Microfone mutado";};
$("cameraBtn").onclick=async()=>{try{if(!localStream)localStream=await navigator.mediaDevices.getUserMedia({audio:true,video:true});else if(!localStream.getVideoTracks().length){const s=await navigator.mediaDevices.getUserMedia({video:true});const track=s.getVideoTracks()[0];localStream.addTrack(track);pc?.addTrack(track,localStream);$("localVideo").srcObject=localStream;}cameraEnabled=!cameraEnabled;localStream.getVideoTracks().forEach(t=>t.enabled=cameraEnabled);$("localVideo").srcObject=localStream;}catch(e){alert(`Câmera indisponível: ${e.message}`);}};
$("screenBtn").onclick=async()=>{try{const screen=await navigator.mediaDevices.getDisplayMedia({video:true,audio:true});const track=screen.getVideoTracks()[0];const sender=pc?.getSenders().find(s=>s.track?.kind==="video");if(sender)await sender.replaceTrack(track);else pc?.addTrack(track,screen);$("localVideo").srcObject=screen;track.onended=()=>{if(localStream)$("localVideo").srcObject=localStream;};}catch(e){alert(`Compartilhamento não permitido ou indisponível: ${e.message}`);}};
$("hangupBtn").onclick=async()=>{if(stopSignal)stopSignal();if(pc)pc.close();if(localStream)localStream.getTracks().forEach(t=>t.stop());if(callRoom)await remove(ref(db,`callSignals/${callRoom}`)).catch(()=>{});pc=null;localStream=null;$("callDock").classList.add("hidden");$("callVideos").querySelectorAll("#remoteVideo").forEach(v=>v.remove());};
