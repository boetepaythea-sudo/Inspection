import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, sendPasswordResetEmail,
  signOut
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, getDocs, getDoc, doc, setDoc, updateDoc,
  deleteDoc, query, orderBy, limit, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

/* =========================================================
   1. TEMPEL CONFIG FIREBASE ANDA DI SINI
   Firebase Console > Project settings > Your apps > Web app
   ========================================================= */
const firebaseConfig = {
  apiKey: "AIzaSyAa-vijHMSv9J4bfGo-h7g6AAIKjYzTsFo",
  authDomain: "accounting-8aac9.firebaseapp.com",
  projectId: "accounting-8aac9",
  storageBucket: "accounting-8aac9.firebasestorage.app",
  messagingSenderId: "779833044688",
  appId: "1:779833044688:web:5e33e27b07165c17cf38d5",
  measurementId: "G-4GDCR4910X"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = id => document.getElementById(id);
const money = n => new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(n)||0);
const todayISO = () => new Date().toISOString().slice(0,10);
const monthISO = () => new Date().toISOString().slice(0,7);
const esc = s => String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const toast = msg => { $("toast").textContent=msg; $("toast").classList.add("show"); setTimeout(()=>$("toast").classList.remove("show"),2800); };

let employees=[], attendance=[], payroll=[], editingId=null, modalType=null;

$("today").textContent = new Intl.DateTimeFormat("id-ID",{dateStyle:"full"}).format(new Date());
$("attendanceDate").value = todayISO();
$("payrollMonth").value = monthISO();

function statusPill(s){
  const c = ["Hadir","Lunas"].includes(s)?"green":["Izin","Cuti","Terlambat"].includes(s)?"yellow":["Sakit","Alpha"].includes(s)?"red":"";
  return `<span class="pill ${c}">${esc(s||"-")}</span>`;
}

async function loadAll(){
  try{
    const [e,a,p] = await Promise.all([
      getDocs(query(collection(db,"employees"),orderBy("createdAt","desc"))),
      getDocs(query(collection(db,"attendance"),orderBy("date","desc"),limit(500))),
      getDocs(query(collection(db,"payroll"),orderBy("period","desc"),limit(500)))
    ]);
    employees=e.docs.map(d=>({id:d.id,...d.data()}));
    attendance=a.docs.map(d=>({id:d.id,...d.data()}));
    payroll=p.docs.map(d=>({id:d.id,...d.data()}));
    renderAll();
    $("firebaseStatus").textContent="● Terhubung";
  }catch(err){console.error(err);$("firebaseStatus").textContent="● Cek Firestore";toast("Gagal membaca Firestore: "+err.message);}
}

function renderAll(){renderEmployees();renderAttendance();renderPayroll();renderSlips();renderDashboard();}

function renderEmployees(){
  const term=($("employeeSearch")?.value||"").toLowerCase();
  const rows=employees.filter(x=>[x.nik,x.name,x.position,x.department,x.phone].join(" ").toLowerCase().includes(term));
  $("employeeTable").innerHTML=rows.map(x=>`<tr>
    <td>${esc(x.nik)}</td><td><strong>${esc(x.name)}</strong><br><small>${esc(x.email||"")}</small></td>
    <td>${esc(x.position)}</td><td>${esc(x.department)}</td><td>${esc(x.phone)}</td><td>${money(x.baseSalary)}</td>
    <td>${statusPill(x.status)}</td><td><div class="actions"><button data-edit-employee="${x.id}">Edit</button><button data-del-employee="${x.id}">Hapus</button></div></td>
  </tr>`).join("") || `<tr><td colspan="8">Belum ada data.</td></tr>`;
}

function renderAttendance(){
  const date=$("attendanceDate").value, filter=$("attendanceFilter").value;
  let rows=attendance.filter(x=>(!date||x.date===date)&&(!filter||x.status===filter));
  $("attendanceTable").innerHTML=rows.map(x=>`<tr><td>${esc(x.date)}</td><td><strong>${esc(x.employeeName)}</strong><br><small>${esc(x.nik)}</small></td><td>${esc(x.inTime||"-")}</td><td>${esc(x.outTime||"-")}</td><td>${statusPill(x.status)}</td><td>${Number(x.overtime||0)}</td><td><div class="actions"><button data-edit-att="${x.id}">Edit</button><button data-del-att="${x.id}">Hapus</button></div></td></tr>`).join("")||`<tr><td colspan="7">Belum ada absensi.</td></tr>`;
}

function renderPayroll(){
  const period=$("payrollMonth").value;
  const rows=payroll.filter(x=>!period||x.period===period);
  $("payrollTable").innerHTML=rows.map(x=>`<tr><td>${esc(x.period)}</td><td>${esc(x.nik)}</td><td><strong>${esc(x.employeeName)}</strong></td><td>${money(x.baseSalary)}</td><td>${money(x.allowance)}</td><td>${money(x.overtimePay)}</td><td>${money(x.deduction)}</td><td><strong>${money(x.netSalary)}</strong></td><td><div class="actions"><button data-slip="${x.id}">Slip</button><button data-del-pay="${x.id}">Hapus</button></div></td></tr>`).join("")||`<tr><td colspan="9">Belum ada payroll untuk periode ini.</td></tr>`;
}

function renderSlips(){
  const term=($("slipSearch").value||"").toLowerCase();
  const rows=payroll.filter(x=>[x.period,x.employeeName,x.nik].join(" ").toLowerCase().includes(term));
  $("slipTable").innerHTML=rows.map(x=>{
    const emp=employees.find(e=>e.nik===x.nik)||{};
    return `<tr><td>${esc(x.period)}</td><td>${esc(x.nik)}</td><td>${esc(x.employeeName)}</td><td><strong>${money(x.netSalary)}</strong></td><td>${esc(emp.email||"-")}</td><td>${esc(emp.phone||"-")}</td><td><div class="actions"><button data-slip="${x.id}">PDF</button><button data-email-slip="${x.id}">Email</button><button data-wa-slip="${x.id}">WhatsApp</button></div></td></tr>`;
  }).join("")||`<tr><td colspan="7">Belum ada slip.</td></tr>`;
}

function renderDashboard(){
  const t=todayISO(), a=attendance.filter(x=>x.date===t);
  $("statEmployees").textContent=employees.filter(x=>x.status!=="Nonaktif").length;
  $("statPresent").textContent=a.filter(x=>["Hadir","Terlambat"].includes(x.status)).length;
  $("statLeave").textContent=a.filter(x=>["Izin","Sakit","Cuti"].includes(x.status)).length;
  const p=payroll.filter(x=>x.period===monthISO()).reduce((s,x)=>s+Number(x.netSalary||0),0);
  $("statPayroll").textContent=money(p);
  $("recentAttendance").innerHTML=attendance.slice(0,5).map(x=>`<div class="list-row"><div><b>${esc(x.employeeName)}</b><small>${esc(x.date)} · ${esc(x.inTime||"-")}</small></div>${statusPill(x.status)}</div>`).join("")||"<div class='muted'>Belum ada aktivitas.</div>";
  $("recentEmployees").innerHTML=employees.slice(0,5).map(x=>`<div class="list-row"><div><b>${esc(x.name)}</b><small>${esc(x.position||"-")} · ${esc(x.department||"-")}</small></div>${statusPill(x.status)}</div>`).join("")||"<div class='muted'>Belum ada karyawan.</div>";
}

function showPage(name){
  document.querySelectorAll(".page").forEach(x=>x.classList.add("hidden"));
  $(name+"Page").classList.remove("hidden");
  document.querySelectorAll(".nav-item").forEach(x=>x.classList.toggle("active",x.dataset.page===name));
  $("pageTitle").textContent={dashboard:"Dashboard",employees:"Data Karyawan",attendance:"Absensi",payroll:"Payroll",slips:"Slip Gaji"}[name];
  document.querySelector(".sidebar").classList.remove("open");
}

document.querySelectorAll(".nav-item").forEach(b=>b.onclick=()=>showPage(b.dataset.page));
document.querySelectorAll("[data-page-jump]").forEach(b=>b.onclick=()=>showPage(b.dataset.pageJump));
$("menuBtn").onclick=()=>document.querySelector(".sidebar").classList.toggle("open");

function openModal(type,id=null){
  modalType=type; editingId=id; $("modal").classList.remove("hidden");
  const emp=employees.find(x=>x.id===id), att=attendance.find(x=>x.id===id);
  if(type==="employee"){
    $("modalTitle").textContent=id?"Edit Karyawan":"Tambah Karyawan";
    const x=emp||{};
    $("modalBody").innerHTML=`
      <label>NIK<input name="nik" required value="${esc(x.nik)}"></label>
      <label>Nama Lengkap<input name="name" required value="${esc(x.name)}"></label>
      <label>Jabatan<input name="position" value="${esc(x.position)}"></label>
      <label>Departemen<input name="department" value="${esc(x.department)}"></label>
      <label>Email<input name="email" type="email" value="${esc(x.email)}"></label>
      <label>No. HP (+62...)<input name="phone" value="${esc(x.phone)}" placeholder="+62812..."></label>
      <label>Status<select name="status">${["Aktif","Nonaktif","Kontrak","Tetap"].map(s=>`<option ${x.status===s?"selected":""}>${s}</option>`).join("")}</select></label>
      <label>Gaji Pokok<input name="baseSalary" type="number" value="${x.baseSalary||0}"></label>
      <label>Tunjangan Tetap<input name="fixedAllowance" type="number" value="${x.fixedAllowance||0}"></label>
      <label>Tarif Lembur / Jam<input name="overtimeRate" type="number" value="${x.overtimeRate||0}"></label>
      <label>Bank / Rekening<input name="bankAccount" value="${esc(x.bankAccount)}"></label>`;
  }else if(type==="attendance"){
    $("modalTitle").textContent=id?"Edit Absensi":"Input Absensi";
    const x=att||{date:todayISO(),status:"Hadir"};
    $("modalBody").innerHTML=`
      <label>Karyawan<select name="employeeId" required>${employees.map(e=>`<option value="${e.id}" ${x.employeeId===e.id?"selected":""}>${esc(e.nik)} — ${esc(e.name)}</option>`).join("")}</select></label>
      <label>Tanggal<input name="date" type="date" required value="${esc(x.date||todayISO())}"></label>
      <label>Jam Masuk<input name="inTime" type="time" value="${esc(x.inTime||"08:00")}"></label>
      <label>Jam Pulang<input name="outTime" type="time" value="${esc(x.outTime||"17:00")}"></label>
      <label>Status<select name="status">${["Hadir","Terlambat","Izin","Sakit","Cuti","Alpha"].map(s=>`<option ${x.status===s?"selected":""}>${s}</option>`).join("")}</select></label>
      <label>Lembur (jam)<input name="overtime" type="number" min="0" step=".5" value="${x.overtime||0}"></label>
      <label class="full-col">Catatan<textarea name="note">${esc(x.note)}</textarea></label>`;
  }
}

function closeModal(){ $("modal").classList.add("hidden"); $("modalForm").reset(); editingId=null; modalType=null; }
$("closeModal").onclick=closeModal;$("cancelModal").onclick=closeModal;

$("modalForm").onsubmit=async e=>{
  e.preventDefault();
  const f=Object.fromEntries(new FormData(e.target).entries());
  try{
    if(modalType==="employee"){
      f.baseSalary=Number(f.baseSalary||0);f.fixedAllowance=Number(f.fixedAllowance||0);f.overtimeRate=Number(f.overtimeRate||0);
      if(editingId) await updateDoc(doc(db,"employees",editingId),f);
      else await addDoc(collection(db,"employees"),{...f,createdAt:serverTimestamp()});
      toast("Data karyawan tersimpan");
    }else{
      const emp=employees.find(x=>x.id===f.employeeId); if(!emp) throw Error("Karyawan tidak ditemukan");
      f.overtime=Number(f.overtime||0); f.employeeName=emp.name; f.nik=emp.nik;
      if(editingId) await updateDoc(doc(db,"attendance",editingId),f);
      else await addDoc(collection(db,"attendance"),{...f,createdAt:serverTimestamp()});
      toast("Absensi tersimpan");
    }
    closeModal();await loadAll();
  }catch(err){toast("Gagal: "+err.message)}
};

async function remove(col,id){
  if(!confirm("Yakin ingin menghapus data ini?"))return;
  try{await deleteDoc(doc(db,col,id));toast("Data dihapus");await loadAll()}catch(e){toast(e.message)}
}

$("employeeSearch").oninput=renderEmployees;$("attendanceDate").onchange=renderAttendance;$("attendanceFilter").onchange=renderAttendance;$("payrollMonth").onchange=renderPayroll;$("slipSearch").oninput=renderSlips;
$("addEmployeeBtn").onclick=()=>openModal("employee");$("addAttendanceBtn").onclick=()=>openModal("attendance");

document.addEventListener("click",e=>{
  const t=e.target;
  if(t.dataset.editEmployee)openModal("employee",t.dataset.editEmployee);
  if(t.dataset.delEmployee)remove("employees",t.dataset.delEmployee);
  if(t.dataset.editAtt)openModal("attendance",t.dataset.editAtt);
  if(t.dataset.delAtt)remove("attendance",t.dataset.delAtt);
  if(t.dataset.delPay)remove("payroll",t.dataset.delPay);
  if(t.dataset.slip)generateSlip(t.dataset.slip);
  if(t.dataset.emailSlip)emailSlip(t.dataset.emailSlip);
  if(t.dataset.waSlip)waSlip(t.dataset.waSlip);
});

$("generatePayrollBtn").onclick=async()=>{
  const period=$("payrollMonth").value;
  if(!period)return toast("Pilih periode payroll");
  let count=0;
  for(const emp of employees.filter(x=>x.status!=="Nonaktif")){
    const exists=payroll.find(x=>x.period===period&&x.nik===emp.nik);
    if(exists)continue;
    const logs=attendance.filter(x=>x.nik===emp.nik&&x.date?.startsWith(period));
    const overtimeHours=logs.reduce((s,x)=>s+Number(x.overtime||0),0);
    const allowance=Number(emp.fixedAllowance||0);
    const overtimePay=overtimeHours*Number(emp.overtimeRate||0);
    const deduction=0;
    const netSalary=Number(emp.baseSalary||0)+allowance+overtimePay-deduction;
    await addDoc(collection(db,"payroll"),{period,employeeId:emp.id,employeeName:emp.name,nik:emp.nik,baseSalary:Number(emp.baseSalary||0),allowance,overtimeHours,overtimePay,deduction,netSalary,status:"Lunas",createdAt:serverTimestamp()});
    count++;
  }
  toast(`${count} payroll dibuat. Potongan pajak/BPJS dapat Anda tambahkan sesuai kebijakan perusahaan.`);
  await loadAll();
};

function getSlipData(id){return payroll.find(x=>x.id===id)}
function generateSlip(id){
  const x=getSlipData(id);if(!x)return;
  const emp=employees.find(e=>e.nik===x.nik)||{};
  const {jsPDF}=window.jspdf;const pdf=new jsPDF();let y=20;
  pdf.setFontSize(18);pdf.text("SLIP GAJI",20,y);y+=10;pdf.setFontSize(10);
  pdf.text("HRD Pro",20,y);pdf.text(`Periode: ${x.period}`,150,y);y+=15;
  [["NIK",x.nik],["Nama",x.employeeName],["Jabatan",emp.position||"-"],["Bank/Rekening",emp.bankAccount||"-"]].forEach(([a,b])=>{pdf.text(`${a}: ${b}`,20,y);y+=7});
  y+=5;pdf.line(20,y,190,y);y+=10;
  [["Gaji Pokok",x.baseSalary],["Tunjangan",x.allowance],["Lembur",x.overtimePay],["Potongan", -Number(x.deduction||0)]].forEach(([a,b])=>{pdf.text(a,25,y);pdf.text(money(b),130,y);y+=8});
  pdf.line(20,y,190,y);y+=10;pdf.setFontSize(13);pdf.text("GAJI BERSIH",25,y);pdf.text(money(x.netSalary),130,y);
  y+=25;pdf.setFontSize(9);pdf.text("Dokumen elektronik — dihasilkan oleh HRD Pro.",20,y);
  pdf.save(`Slip-Gaji-${x.nik}-${x.period}.pdf`);
}

function emailSlip(id){
  const x=getSlipData(id),emp=employees.find(e=>e.nik===x?.nik)||{};
  if(!emp.email)return toast("Email karyawan belum diisi");
  const subject=encodeURIComponent(`Slip Gaji ${x.period} - ${x.employeeName}`);
  const body=encodeURIComponent(`Halo ${x.employeeName},\n\nSlip gaji periode ${x.period} sebesar ${money(x.netSalary)} tersedia di HRD Pro.\nSilakan buka aplikasi untuk mengunduh PDF slip gaji.\n\nTerima kasih.`);
  location.href=`mailto:${emp.email}?subject=${subject}&body=${body}`;
}
function waSlip(id){
  const x=getSlipData(id),emp=employees.find(e=>e.nik===x?.nik)||{};
  if(!emp.phone)return toast("Nomor HP karyawan belum diisi");
  const phone=String(emp.phone).replace(/\D/g,"").replace(/^0/,"62");
  const text=encodeURIComponent(`Halo ${x.employeeName}, slip gaji periode ${x.period} sudah tersedia. Gaji bersih: ${money(x.netSalary)}. Silakan buka aplikasi HRD Pro untuk mengunduh slip PDF.`);
  window.open(`https://wa.me/${phone}?text=${text}`,"_blank");
}

$("loginForm").onsubmit=async e=>{
  e.preventDefault();
  try{await signInWithEmailAndPassword(auth,$("loginEmail").value.trim(),$("loginPassword").value);toast("Login berhasil")}catch(err){toast("Login gagal: "+err.message)}
};
$("forgotBtn").onclick=async()=>{
  const email=prompt("Masukkan email akun yang terdaftar:");
  if(!email)return;
  try{await sendPasswordResetEmail(auth,email);toast("Link reset password dikirim ke email.")}catch(e){toast("Gagal: "+e.message)}
};
$("logoutBtn").onclick=()=>signOut(auth);

onAuthStateChanged(auth,async user=>{
  if(user){
    $("loginView").classList.add("hidden");$("appView").classList.remove("hidden");
    $("userEmail").textContent=user.email||user.phoneNumber||"";
    $("userName").textContent=user.displayName||"Admin";
    $("userAvatar").textContent=(user.displayName||user.email||"HR").slice(0,2).toUpperCase();
    await loadAll();
  }else{$("loginView").classList.remove("hidden");$("appView").classList.add("hidden")}
});

/* =========================================================
   OTP HP (fondasi untuk reset password custom)
   Firebase Phone Auth memerlukan RecaptchaVerifier dan
   alur backend/akun yang benar. Jangan membuat OTP sendiri
   di browser atau menyimpan password di Firestore.
   ========================================================= */
export const normalizePhone = p => String(p||"").replace(/[^\d+]/g,"").replace(/^0/,"+62");
