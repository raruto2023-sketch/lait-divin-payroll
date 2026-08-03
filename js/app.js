/* =========================================================
   SOURCE: core.js
========================================================= */
const cfg = window.LAIT_DIVIN_CONFIG || {};
if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
  document.addEventListener('DOMContentLoaded', () => {
    const e = document.getElementById('loginError');
    if (e) { e.textContent = 'config.js にSupabaseのURLと公開キーを設定してください。'; e.classList.add('show'); }
  });
}
const sb = window.supabase.createClient(cfg.SUPABASE_URL || '', cfg.SUPABASE_ANON_KEY || '', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});
const $=id=>document.getElementById(id),yen=new Intl.NumberFormat('ja-JP',{style:'currency',currency:'JPY',maximumFractionDigits:0});
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const DRAFT_KEY='ld_server_draft_v1';
let settings={shop:'Lait Divin',city:'Luz City ・ Divine Milk Café',logo:'🐄',prefix:'LD',footer:'Lait Divin\nLuz City\nこの明細書は店舗発行の記録です.'};
let employees=[],historyData=[],attendanceData=[],myAttendance=[],currentEmployee=null,currentProfile=null,currentViewedSlip=null,currentSlipNo='';
let realtimeChannel=null;
let onlinePresenceData=[];
let presenceHeartbeatTimer=null;
let presenceRefreshTimer=null;
let presenceIdle=false;
let lastPresenceActivity=Date.now();

// ===== Ver.13.7 Global State =====
let salesGoals={weekly:0,monthly:0};
let auditRows=[];
let syncTimer=null;
let employeeRankingMode='sales';
let rankingMode='hours';
let salesData=[];
let jobAccountSettings={autoRate:10,updatedAt:null};
let jobAccountTransactions=[];
let expenseRequests=[];
let myHistory=[];
let appMode='login';
let refreshInProgress=false;
let realtimeHealthy=false;
let attendanceDetailEmployee=null;
let selectedAttendanceIds=new Set();

// ===== Ver.26.0.2 Early Global Feature State =====
let realtimeFallbackTimer=null;
let realtimeReconnectTimer=null;
let realtimeSubscribeTimeout=null;
let realtimeLastSuccessAt=0;
let realtimeHealthTimer=null;
let inventorySnapshot=[];
let attendanceControlMode='working';
let inventoryDiscordMessageId='';
let inventorySiteNoticeId='';
let farmPeriods=[];
let farmItems=[];
let farmData={period:null,items:[],staff:[]};
let currentFarmPeriod=null;
let inventoryCountRequests=[];
let farmSubmissionRequests=[];
let inventorySpreadsheetRows=[];
let farmEntryDraft={};
let inventoryCountDraft={};
let inventoryCountNoteDraft='';
let farmManageDraft=[];
let farmManageDirty=false;
let farmAutoSyncBusy=false;
let inventoryAutoSyncBusy=false;
let pendingProfileAvatar='';
let adminEditingProfile=null;
let adminEditingAvatar='';
let achievementCatalog=[];
let profileAchievements=[];
let achievementRealtimeChannel=null;
let notificationRows=[];
let notificationReadIds=new Set();
let campaignData=[];
let adminApprovalTab='expense';
let delegatedApprovalTab='expense';



function markRealtimeStatus(state='connecting'){
  const normalized=state===true?'live':state===false?'reconnecting':state;
  realtimeHealthy=normalized==='live';

  const labels={
    live:'● 同期中',
    fallback:'● 自動同期中',
    connecting:'● 同期準備中',
    reconnecting:'● 再接続中',
    offline:'● オフライン'
  };

  document.querySelectorAll('[data-realtime-status]').forEach(el=>{
    el.textContent=labels[normalized]||labels.connecting;
    el.classList.toggle('sync-ok',normalized==='live'||normalized==='fallback');
    el.classList.toggle('sync-warn',!['live','fallback'].includes(normalized));
    el.dataset.syncState=normalized;
  });
}
function startSyncTimer(){
  if(typeof syncTimer!=='undefined'&&syncTimer)clearInterval(syncTimer);
  syncTimer=setInterval(()=>refreshAllData(true),10000);
}
async function refreshAllData(silent=false){
  if(refreshInProgress||appMode==='login'||!sb)return;
  refreshInProgress=true;
  try{
    if(appMode==='admin'){
      await Promise.all([loadSettings(),loadEmployees(),loadHistoryData(),loadAttendanceData(),loadSalesData(),loadFarmData(),loadOnlinePresence(false),loadNotifications(false),loadSalesGoals(),loadAuditLogs(false),loadJobAccountData(false),loadExpenseRequests(false)]);
      refreshEmployeeSelect();refreshSalesEmployeeSelect();
      renderDashboard();renderAttendance();renderEmployees();renderRanking();renderSalesPage();renderJobAccount();renderAdminExpenses();
    }else{
      await Promise.all([loadSettings(),loadMyHistory(),loadMyAttendance(),loadAttendanceData(),loadSalesData(),loadFarmData(),loadOnlinePresence(false),loadNotifications(false),loadSalesGoals(),loadExpenseRequests(false)]);
      renderEmployeePortal();renderEmployeeAttendance();renderEmployeeDashboard();renderEmployeeRanking();
    }
    if(!silent)toast('最新データに更新しました');
  }catch(error){console.error('全データ更新エラー:',error)}
  finally{refreshInProgress=false}
}
function ensureMobileNavs(){
  if(!$('adminMobileNav')){
    const nav=document.createElement('nav');
    nav.id='adminMobileNav';
    nav.className='mobile-bottom-nav';
    nav.innerHTML=`
      <button data-mobile-admin="dashboard" onclick="mobileAdminPage('dashboard')"><span>⌂</span><b>ホーム</b></button>
      <button data-mobile-admin="attendance" onclick="mobileAdminPage('attendance')"><span>◷</span><b>出退勤</b></button>
      <button data-mobile-admin="inventory" onclick="mobileAdminPage('inventory')"><span>◇</span><b>在庫</b></button>
      <button data-mobile-admin="farm" onclick="mobileAdminPage('farm')"><span>🌾</span><b>Farm</b></button>
      <button onclick="openMobileMenu('admin')"><span>☰</span><b>メニュー</b></button>`;
    $('adminApp')?.appendChild(nav);
  }

  if(!$('employeeMobileNav')){
    const nav=document.createElement('nav');
    nav.id='employeeMobileNav';
    nav.className='mobile-bottom-nav';
    nav.innerHTML=`
      <button data-mobile-employee="home" onclick="mobileEmployeePage('home')"><span>⌂</span><b>ホーム</b></button>
      <button data-mobile-employee="attendance" onclick="mobileEmployeePage('attendance')"><span>◷</span><b>出退勤</b></button>
      <button data-mobile-employee="inventory" onclick="mobileEmployeePage('inventory')"><span>◇</span><b>在庫</b></button>
      <button data-mobile-employee="farm" onclick="mobileEmployeePage('farm')"><span>🌾</span><b>Farm</b></button>
      <button onclick="openMobileMenu('employee')"><span>☰</span><b>メニュー</b></button>`;
    $('employeeApp')?.appendChild(nav);
  }

  if(!$('mobileMenuBackdrop')){
    const backdrop=document.createElement('div');
    backdrop.id='mobileMenuBackdrop';
    backdrop.className='mobile-menu-backdrop hidden';
    backdrop.onclick=e=>{if(e.target===backdrop)closeMobileMenu()};
    backdrop.innerHTML=`
      <section class="mobile-menu-sheet">
        <div class="mobile-menu-handle"></div>
        <header>
          <div>
            <span>LAIT DIVIN PORTAL</span>
            <strong id="mobileMenuTitle">メニュー</strong>
          </div>
          <button onclick="closeMobileMenu()" aria-label="閉じる">×</button>
        </header>
        <div id="mobileAdminMenu" class="mobile-menu-grid hidden">
          <button onclick="mobileAdminPage('dashboard')"><span>⌂</span><b>ダッシュボード</b></button>
          <button onclick="mobileAdminPage('attendance')"><span>◷</span><b>出退勤管理</b></button>
          <button onclick="mobileAdminPage('employees')"><span>♟</span><b>従業員管理</b></button>
          <button onclick="mobileAdminPage('create')"><span>¥</span><b>給与・ボーナス</b></button>
          <button onclick="mobileAdminPage('history')"><span>▤</span><b>明細履歴</b></button>
          <button onclick="mobileAdminPage('inventory')"><span>◇</span><b>在庫管理</b></button>
          <button onclick="mobileAdminPage('farm')"><span>🌾</span><b>Farm管理</b></button>
          <button onclick="mobileAdminPage('sales')"><span>▥</span><b>売上入力</b></button>
          <button data-mobile-admin="job-account" onclick="mobileAdminPage('job-account')"><span>🏦</span><b>ジョブ口座</b></button>
          <button class="mobile-expense-menu-btn" data-mobile-admin="expenses" onclick="mobileAdminPage('expenses')"><span>🧾</span><b>経費申請</b><i id="adminMobileExpenseBadge" class="notification-badge hidden">0</i></button>
          <button data-mobile-admin="approvals" onclick="mobileAdminPage('approvals')"><span>✓</span><b>承認管理</b><i id="adminMobileApprovalBadge" class="notification-badge hidden">0</i></button>
          <button onclick="mobileAdminPage('ranking')"><span>♛</span><b>ランキング</b></button>
          <button onclick="mobileAdminPage('online')"><span>●</span><b>オンライン</b></button>
          <button onclick="mobileAdminPage('community')"><span>♙</span><b>プロフィール一覧</b></button>
          <button onclick="mobileAdminPage('campaigns')"><span>🎪</span><b>イベント管理</b></button>
          <button class="mobile-notification-menu-btn" onclick="mobileAdminPage('notifications')"><span>🔔</span><b>通知センター</b><i id="adminMobileNotificationBadge" class="notification-badge hidden">0</i></button>
          <button onclick="mobileAdminPage('discord-report')"><span>◈</span><b>Discordレポート</b></button>
          <button onclick="mobileAdminPage('settings')"><span>⚙</span><b>設定</b></button>
        </div>
        <div id="mobileEmployeeMenu" class="mobile-menu-grid hidden">
          <button onclick="mobileEmployeePage('home')"><span>⌂</span><b>ダッシュボード</b></button>
          <button onclick="mobileEmployeePage('attendance')"><span>◷</span><b>出退勤</b></button>
          <button onclick="mobileEmployeePage('ranking')"><span>♛</span><b>ランキング</b></button>
          <button onclick="mobileEmployeePage('inventory')"><span>◇</span><b>在庫表</b></button>
          <button onclick="mobileEmployeePage('farm')"><span>🌾</span><b>Farm</b></button>
          <button onclick="mobileEmployeePage('payslips')"><span>¥</span><b>給料明細</b></button>
          <button data-mobile-employee="expenses" onclick="mobileEmployeePage('expenses')"><span>🧾</span><b>経費申請</b></button>
          <button onclick="mobileEmployeePage('profile')"><span>♙</span><b>プロフィール</b></button>
          <button onclick="mobileEmployeePage('online')"><span>●</span><b>オンライン</b></button>
          <button onclick="mobileEmployeePage('community')"><span>♙</span><b>プロフィール一覧</b></button>
          <button onclick="mobileEmployeePage('campaigns')"><span>🎪</span><b>イベント</b></button>
          <button class="mobile-notification-menu-btn" onclick="mobileEmployeePage('notifications')"><span>🔔</span><b>通知センター</b><i id="employeeMobileNotificationBadge" class="notification-badge hidden">0</i></button>
        </div>
        <div class="mobile-menu-actions">
          <button class="mobile-theme-button" onclick="toggleTheme();updateMobileThemeButtons()">
            <span data-mobile-theme-icon>◐</span>
            <div><b data-mobile-theme-label>テーマ切替</b><small>ライト／ダーク</small></div>
          </button>
          <button class="mobile-logout-button" onclick="mobileLogout()">
            <span>↪</span>
            <div><b>ログアウト</b><small>ログイン画面へ戻る</small></div>
          </button>
        </div>
      </section>`;
    document.body.appendChild(backdrop);
  }

  ensureMobileTopActions();
  updateMobileThemeButtons();
}


function ensureMobileTopActions(){
  document.querySelectorAll('.v4-topbar').forEach(topbar=>{
    if(topbar.querySelector('.mobile-top-actions'))return;
    const actions=document.createElement('div');
    actions.className='mobile-top-actions';
    actions.innerHTML=`
      <button onclick="toggleTheme();updateMobileThemeButtons()" title="テーマ切替" aria-label="テーマ切替">
        <span data-mobile-theme-icon>◐</span>
      </button>
      <button onclick="mobileLogout()" title="ログアウト" aria-label="ログアウト">↪</button>`;
    topbar.appendChild(actions);
  });
}
function openMobileMenu(mode){
  ensureMobileNavs();
  $('mobileMenuTitle').textContent=mode==='admin'?'管理者メニュー':'スタッフメニュー';
  $('mobileAdminMenu').classList.toggle('hidden',mode!=='admin');
  $('mobileEmployeeMenu').classList.toggle('hidden',mode!=='employee');
  $('mobileMenuBackdrop').classList.remove('hidden');
  document.body.classList.add('mobile-menu-open');
}
function closeMobileMenu(){
  $('mobileMenuBackdrop')?.classList.add('hidden');
  document.body.classList.remove('mobile-menu-open');
}
function mobileAdminPage(page){
  closeMobileMenu();
  goPage(page);
}
function mobileEmployeePage(page){
  closeMobileMenu();
  employeeGoPage(page);
}
async function mobileLogout(){
  closeMobileMenu();
  if(!confirm('ログアウトしますか？'))return;
  await logout();
}
function updateMobileThemeButtons(){
  const dark=document.body.classList.contains('dark');
  document.querySelectorAll('[data-mobile-theme-icon]').forEach(x=>x.textContent=dark?'☀':'☾');
  document.querySelectorAll('[data-mobile-theme-label]').forEach(x=>x.textContent=dark?'ライトモードに変更':'ダークモードに変更');
  const themeColor=document.querySelector('meta[name="theme-color"]');
  if(themeColor)themeColor.setAttribute('content',dark?'#171311':'#eee6de');
}

function showLoginScreen(){
  closeMobileMenu();
  appMode='login';
  if(typeof syncTimer!=='undefined'&&syncTimer){clearInterval(syncTimer);syncTimer=null}
  document.body.classList.add('login-active');
  $('loginScreen')?.classList.remove('hidden');
  $('adminApp')?.classList.add('hidden');
  $('employeeApp')?.classList.add('hidden');
}

function showAdminApp(){
  appMode='admin';
  document.body.classList.remove('login-active');
  $('loginScreen')?.classList.add('hidden');
  $('employeeApp')?.classList.add('hidden');
  $('adminApp')?.classList.remove('hidden');
  startSyncTimer();ensureMobileNavs();
}

function showEmployeeApp(){
  appMode='employee';
  document.body.classList.remove('login-active');
  $('loginScreen')?.classList.add('hidden');
  $('adminApp')?.classList.add('hidden');
  $('employeeApp')?.classList.remove('hidden');
  startSyncTimer();ensureMobileNavs();
}

function internalEmail(employeeId){
  const safe=String(employeeId||'').trim().toLowerCase().replace(/[^a-z0-9._-]/g,'-');
  return `${safe}@${cfg.LOGIN_DOMAIN || 'lait-divin.local'}`;
}
function newSlipNo(){
  const d=new Date(), p=n=>String(n).padStart(2,'0');
  return `${settings.prefix||'LD'}-${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}-${Math.random().toString(36).slice(2,5).toUpperCase()}`;
}
function switchLogin(type){
  const employee=type==='employee';
  $('tabEmployee')?.classList.toggle('active',employee);
  $('tabAdmin')?.classList.toggle('active',!employee);
  $('employeeLogin')?.classList.toggle('hidden',!employee);
  $('adminLogin')?.classList.toggle('hidden',employee);
  showError('');
  setTimeout(()=>$(employee?'loginEmployeeId':'loginAdminPassword')?.focus(),50);
}
function showError(t){$('loginError').textContent=t;$('loginError').classList.toggle('show',!!t)}
function toast(t){const x=$('toast');x.textContent=t;x.classList.add('show');setTimeout(()=>x.classList.remove('show'),1900)}
function iso(d){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
function jp(v){return v?new Date(v+'T00:00:00').toLocaleDateString('ja-JP'):'-'}

async function getProfile(uid){
  const {data,error}=await sb.from('profiles').select('*').eq('id',uid).single();
  if(error) throw error;
  return data;
}
async function adminLogin(){
  showError('');
  const password=$('loginAdminPassword').value;
  const {data,error}=await sb.auth.signInWithPassword({email:cfg.ADMIN_EMAIL,password});
  if(error){showError('管理者パスワードが違うか、管理者アカウントが未設定です。');return}
  try{
    const profile=await getProfile(data.user.id);
    if(profile.account_type!=='admin') throw new Error('管理者権限がありません');
    currentProfile=profile;
    await openAdmin();
  }catch(e){await sb.auth.signOut();showError(e.message||'管理者権限を確認できませんでした。')}
}
async function employeeLogin(){
  showError('');
  const employeeId=$('loginEmployeeId').value.trim();
  const password=$('loginEmployeePassword').value;
  const {data,error}=await sb.auth.signInWithPassword({email:internalEmail(employeeId),password});
  if(error){showError('従業員番号またはパスワードが違います。');return}
  try{
    const profile=await getProfile(data.user.id);
    if(profile.employee_id.toLowerCase()!==employeeId.toLowerCase()) throw new Error('従業員情報が一致しません。');
    currentProfile=profile; currentEmployee=mapProfile(profile);
    await openEmployee();
  }catch(e){await sb.auth.signOut();showError(e.message||'従業員情報を確認できませんでした。')}
}
async function restoreSession(){
  const {data:{session}}=await sb.auth.getSession();
  if(!session) return;
  try{
    currentProfile=await getProfile(session.user.id);
    if(currentProfile.account_type==='admin') await openAdmin();
    else {currentEmployee=mapProfile(currentProfile);await openEmployee()}
  }catch(e){console.error(e);await sb.auth.signOut()}
}
async function logout(){
  await stopPresenceTracking();
  stopRealtime();
  if(typeof syncTimer!=='undefined'&&syncTimer){clearInterval(syncTimer);syncTimer=null}
  currentEmployee=null;currentProfile=null;employees=[];historyData=[];attendanceData=[];salesData=[];jobAccountTransactions=[];expenseRequests=[];myHistory=[];myAttendance=[];
  selectedAttendanceIds.clear();
  showLoginScreen();switchLogin('employee');showError('');
  ['loginAdminPassword','loginEmployeeId','loginEmployeePassword'].forEach(id=>{if($(id))$(id).value=''});
  try{
    await Promise.race([sb?.auth?.signOut({scope:'local'})||Promise.resolve(),new Promise(r=>setTimeout(r,1500))]);
  }catch(error){console.warn('ログアウト通信エラー:',error)}
  try{
    [localStorage,sessionStorage].forEach(storage=>Object.keys(storage).forEach(key=>{
      if(key.startsWith('sb-')||key.includes('supabase')||key==='ld_session')storage.removeItem(key);
    }));
  }catch(error){console.warn('セッション削除エラー:',error)}
}
async function openAdmin(){
  showAdminApp();
  await Promise.all([loadSettings(),loadEmployees(),loadHistoryData(),loadAttendanceData(),loadSalesData(),loadFarmData(),loadSalesGoals(),loadAuditLogs(false),loadJobAccountData(false),loadExpenseRequests(false),loadInventoryRequests(false),loadFarmRequests(false)]);
  await hydrateCurrentProfileVisuals();
  applyAdminProfileEverywhere();syncAllCurrentAvatarElements();
  refreshEmployeeSelect();loadSettingsUI();currentSlipNo=newSlipNo();update();renderDashboard();renderEmployees();renderOnlinePresence();renderAdminApprovalCenter();applyAdminProfileEverywhere();setTimeout(applyAdminProfileEverywhere,300);setTimeout(applyAdminProfileEverywhere,1200);startPresenceTracking();subscribeRealtime('admin');startRealtimeFallback();
}
async function openEmployee(){
  showEmployeeApp();
  await Promise.all([loadSettings(),loadEmployees(),loadMyHistory(),loadMyAttendance(),loadAttendanceData(),loadSalesData(),loadFarmData(),loadSalesGoals(),loadExpenseRequests(false)]);
  await hydrateCurrentProfileVisuals();
  if(currentProfile && currentEmployee && !cleanAvatarUrl(currentEmployee.avatarUrl) && cleanAvatarUrl(currentProfile.avatar_url)) currentEmployee.avatarUrl=currentProfile.avatar_url;
  renderEmployeePortal();renderEmployeeAttendance();renderEmployeeDashboard();renderEmployeeRanking();applyDelegatedPermissionUI();applyProfileEverywhere();syncAllCurrentAvatarElements();renderOnlinePresence();startPresenceTracking();loadEmployeeInventory();subscribeRealtime('employee');startRealtimeFallback();
}
function mapProfile(p){return {uid:p.id,name:p.display_name||p.employee_name,legalName:p.employee_name,role:p.role,id:p.employee_id,accountType:p.account_type,permissions:p.permissions||{},avatarUrl:p.avatar_url||'',bio:p.bio||'',discordName:p.discord_name||'',statusMessage:p.status_message||''}}

function portalPermission(key){
  if(appMode==='admin'||currentProfile?.account_type==='admin')return true;
  const permissions=currentProfile?.permissions||currentEmployee?.permissions||{};
  return permissions?.[key]===true;
}
function anyDelegatedPermission(){
  return portalPermission('expense_approval')||
    portalPermission('inventory_approval')||
    portalPermission('farm_approval');
}
function permissionPayloadFromModal(){
  return {
    expense_approval:!!$('permissionExpenseApproval')?.checked,
    inventory_approval:!!$('permissionInventoryApproval')?.checked,
    farm_approval:!!$('permissionFarmApproval')?.checked
  };
}
function applyDelegatedPermissionUI(){
  const allowed=anyDelegatedPermission();
  $('employeeApprovalNav')?.classList.toggle('hidden',!allowed);
  $('delegatedExpenseTab')?.classList.toggle('hidden',!portalPermission('expense_approval'));
  $('delegatedInventoryTab')?.classList.toggle('hidden',!portalPermission('inventory_approval'));
  $('delegatedFarmTab')?.classList.toggle('hidden',!portalPermission('farm_approval'));

  if(!allowed&&$('employee-page-approvals')?.classList.contains('active')){
    employeeGoPage('home');
  }

  const first=
    portalPermission('expense_approval')?'expense':
    portalPermission('inventory_approval')?'inventory':
    portalPermission('farm_approval')?'farm':null;
  if(first&&!document.querySelector('.delegated-approval-tabs button.active:not(.hidden)')){
    setDelegatedApprovalTab(first);
  }
}

function mapSlip(x){
  const earnings=x.earnings||[];
  const commissionAmount=Number(x.commission_amount)||earnings
    .filter(item=>String(item.name||'').startsWith('売上歩合'))
    .reduce((sum,item)=>sum+(Number(item.amount)||0),0);
  const bonusAmount=Number(x.bonus_amount)||earnings
    .filter(item=>String(item.name||'').includes('ボーナス'))
    .reduce((sum,item)=>sum+(Number(item.amount)||0),0);

  return {
    dbId:x.id,
    slipNo:x.slip_number,
    employee:x.employee_name,
    role:x.employee_role,
    employeeId:x.employee_id,
    employeeUid:x.employee_uid,
    issueDate:x.issue_date,
    periodStart:x.period_start,
    periodEnd:x.period_end,
    salesAmount:Number(x.sales_amount)||0,
    salesRate:Number(x.sales_rate)||0,
    commissionAmount,
    bonusAmount,
    earnings,
    deductions:x.deductions||[],
    note:x.note||'',
    gross:Number(x.gross_amount)||0,
    deduction:Number(x.deduction_amount)||0,
    net:Number(x.net_amount)||0,
    createdAt:x.created_at
  };
}
function mapAttendance(x){return {dbId:x.id,employeeUid:x.employee_uid,employeeId:x.employee_id,employeeName:x.employee_name,clockIn:x.clock_in,clockOut:x.clock_out,note:x.note||'',createdAt:x.created_at}}

async function loadSalesData(){
  if(!sb){salesData=[];return}
  const {data,error}=await sb.from('sales_records').select('*').order('sales_date',{ascending:false}).order('created_at',{ascending:false});
  if(error){
    console.warn('売上データを取得できませんでした:',error);
    salesData=[];
    return;
  }
  salesData=(data||[]).map(x=>({
    dbId:x.id,
    employeeUid:x.employee_uid,
    employeeId:x.employee_id,
    employeeName:x.employee_name,
    salesDate:x.sales_date,
    amount:Number(x.amount)||0,
    note:x.note||'',
    createdAt:x.created_at
  }));
}

async function loadAttendanceData(){
  const {data,error}=await sb.from('attendance_records').select('id,employee_uid,employee_id,employee_name,clock_in,clock_out,note,created_at').order('clock_in',{ascending:false}).limit(5000);
  if(error){console.error('勤務取得エラー:',error);throw error}
  attendanceData=(data||[]).map(mapAttendance);
}
async function loadMyAttendance(){
  if(!currentEmployee?.uid){
    myAttendance=[];
    return;
  }
  const {data,error}=await sb
    .from('attendance_records')
    .select('*')
    .eq('employee_uid',currentEmployee.uid)
    .order('clock_in',{ascending:false})
    .limit(100);
  if(error) throw error;
  myAttendance=(data||[]).map(mapAttendance);
}
async function loadEmployees(){
  const {data,error}=await sb.from('profiles').select('*');
  if(error){
    console.error('ランキング用プロフィール取得エラー:',error);
    throw error;
  }
  employees=(data||[])
    .filter(row=>row.is_active!==false)
    .map(mapProfile)
    .sort((a,b)=>String(a.name||a.displayName||a.id||'').localeCompare(
      String(b.name||b.displayName||b.id||''),'ja'
    ));
}
async function loadHistoryData(){const {data,error}=await sb.from('payslips').select('*').order('created_at',{ascending:false});if(error) throw error;historyData=(data||[]).map(mapSlip)}
async function loadMyHistory(){const {data,error}=await sb.from('payslips').select('*').order('created_at',{ascending:false});if(error) throw error;historyData=(data||[]).map(mapSlip)}
async function loadSettings(){const {data,error}=await sb.from('app_settings').select('*').eq('id',1).maybeSingle();if(error) throw error;if(data) settings={shop:data.shop_name,city:data.city_subtitle,logo:data.logo_text,prefix:data.slip_prefix,footer:data.footer_text}}
function stopRealtime(){
  clearTimeout(realtimeSubscribeTimeout);
  clearTimeout(realtimeReconnectTimer);
  if(realtimeChannel&&sb){
    try{sb.removeChannel(realtimeChannel)}catch(error){
      console.warn('Realtime channel remove failed',error);
    }
  }
  realtimeChannel=null;
  markRealtimeStatus(navigator.onLine?'connecting':'offline');
}

const realtimeRefreshTimers=new Map();
realtimeFallbackTimer=null;
realtimeReconnectTimer=null;
realtimeSubscribeTimeout=null;
realtimeLastSuccessAt=0;
realtimeHealthTimer=null;

function queueRealtimeRefresh(key,callback,delay=220){
  clearTimeout(realtimeRefreshTimers.get(key));
  const timer=setTimeout(async()=>{
    realtimeRefreshTimers.delete(key);
    try{await callback()}catch(error){console.error(`Realtime ${key} 更新エラー:`,error)}
  },delay);
  realtimeRefreshTimers.set(key,timer);
}

function currentInputShouldBePreserved(){
  const active=document.activeElement;
  return !!active&&['INPUT','TEXTAREA','SELECT'].includes(active.tagName);
}

async function realtimeRefreshCore(mode,table){
  if(!sb||appMode!==mode)return;

  if(table==='attendance_records'){
    if(mode==='admin'){
      await loadAttendanceData();
      renderAttendance();renderDashboard();renderRanking();renderEmployees();
    }else{
      await Promise.all([loadMyAttendance(),loadAttendanceData()]);
      renderEmployeeAttendance();renderEmployeeDashboard();renderEmployeeRanking();
    }
    return;
  }

  if(table==='sales_records'){
    await loadSalesData();
    if(mode==='admin'){
      renderSalesPage();renderRanking();renderDashboard();renderJobAccount();
    }else{
      renderEmployeeRanking();renderEmployeeDashboard();
    }
    return;
  }

  if(table==='payslips'){
    if(mode==='admin'){
      await loadHistoryData();renderHistory();renderDashboard();
    }else{
      await loadMyHistory();renderEmployeePortal();renderEmployeeDashboard();
    }
    return;
  }

  if(table==='profiles'){
    await loadEmployees();
    if(mode==='employee'&&currentProfile?.id){
      const refreshed=employees.find(item=>item.uid===currentProfile.id);
      if(refreshed){
        currentEmployee=refreshed;
        currentProfile.permissions=refreshed.permissions||{};
        applyDelegatedPermissionUI();
      }
    }
    if(mode==='admin'){
      refreshEmployeeSelect();refreshSalesEmployeeSelect();
      renderEmployees();renderRanking();renderDashboard();
    }else{
      renderEmployeeRanking();renderEmployeeDashboard();
    }
    await loadCommunityProfiles(false);
    applyProfileEverywhere?.();
    applyAdminProfileEverywhere?.();
    return;
  }

  if(table==='app_settings'){
    await loadSettings();applySettings();loadSettingsUI?.();
    return;
  }

  if(table==='sales_goals'){
    await loadSalesGoals();
    renderDashboard?.();renderEmployeeDashboard?.();
    return;
  }

  if(table==='online_presence'){
    await loadOnlinePresence(false);
    renderOnlinePresence?.();
    return;
  }

  if(table==='notifications'||table==='notification_reads'){
    await loadNotifications(false);
    return;
  }

  if(table==='audit_logs'){
    if(mode==='admin')await loadAuditLogs(false);
    return;
  }

  if(table==='job_account_transactions'||table==='job_account_settings'){
    if(mode==='admin')await loadJobAccountData(false);
    return;
  }

  if(table==='expense_requests'){
    await loadExpenseRequests(false);
    return;
  }

  if(table==='inventory_items'){
    // 入力中の在庫確認はlocalStorage下書きから復元されるため安全に更新できます。
    await loadInventorySnapshot(false);
    renderInventorySpreadsheet?.();
    renderEmployeeInventoryCountSheet?.();
    return;
  }

  if(table==='inventory_count_requests'){
    await loadInventoryRequests(false);
    return;
  }

  if(['farm_periods','farm_items','farm_entries','farm_staff_totals'].includes(table)){
    if(farmManageDirty)captureFarmManageDraft();
    await loadFarmData(false);
    renderRanking?.();renderEmployeeRanking?.();
    return;
  }

  if(table==='farm_submission_requests'){
    await loadFarmRequests(false);
    return;
  }

  if(table==='store_campaigns'){
    await loadCampaigns(false);
    return;
  }

  if(table==='achievement_catalog'||table==='profile_achievements'){
    await loadCommunityProfiles(false);
    return;
  }
}

function subscribeRealtime(mode){
  stopRealtime();
  if(!sb||appMode==='login')return;

  markRealtimeStatus(navigator.onLine?'connecting':'offline');

  const tables=[
    'profiles',
    'app_settings',
    'attendance_records',
    'payslips',
    'sales_records',
    'sales_goals',
    'online_presence',
    'notifications',
    'notification_reads',
    'audit_logs',
    'job_account_settings',
    'job_account_transactions',
    'expense_requests',
    'inventory_items',
    'inventory_count_requests',
    'farm_periods',
    'farm_items',
    'farm_entries',
    'farm_staff_totals',
    'farm_submission_requests',
    'store_campaigns',
    'achievement_catalog',
    'profile_achievements'
  ];

  let channel=sb.channel(`ld-live-${mode}-${Date.now()}`,{
    config:{
      broadcast:{self:false},
      presence:{key:currentProfile?.id||mode}
    }
  });

  tables.forEach(table=>{
    channel=channel.on(
      'postgres_changes',
      {event:'*',schema:'public',table},
      payload=>{
        realtimeLastSuccessAt=Date.now();
        markRealtimeStatus('live');
        queueRealtimeRefresh(table,()=>realtimeRefreshCore(mode,table));
      }
    );
  });

  realtimeChannel=channel.subscribe(status=>{
    console.log('Realtime status:',status);

    if(status==='SUBSCRIBED'){
      clearTimeout(realtimeSubscribeTimeout);
      clearTimeout(realtimeReconnectTimer);
      realtimeLastSuccessAt=Date.now();
      markRealtimeStatus('live');
      return;
    }

    if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED'){
      clearTimeout(realtimeSubscribeTimeout);
      markRealtimeStatus(navigator.onLine?'reconnecting':'offline');

      clearTimeout(realtimeReconnectTimer);
      realtimeReconnectTimer=setTimeout(()=>{
        if(appMode===mode&&navigator.onLine)subscribeRealtime(mode);
      },3500);
    }
  });

  // Realtimeの応答が遅い場合でも、15秒補助同期へ切り替えて止まって見えないようにする
  realtimeSubscribeTimeout=setTimeout(async()=>{
    if(appMode!==mode||realtimeHealthy)return;
    const success=await refreshVisibleSiteData(false);
    if(success){
      realtimeLastSuccessAt=Date.now();
      markRealtimeStatus('fallback');
    }else{
      markRealtimeStatus(navigator.onLine?'reconnecting':'offline');
    }
  },8000);
}

function startRealtimeHealthCheck(){
  clearInterval(realtimeHealthTimer);
  realtimeHealthTimer=setInterval(async()=>{
    if(appMode==='login'||document.visibilityState!=='visible')return;

    if(!navigator.onLine){
      markRealtimeStatus('offline');
      return;
    }

    // 45秒以上Realtimeイベントがなくても、DB疎通が成功していれば自動同期中として扱う
    if(!realtimeHealthy||Date.now()-realtimeLastSuccessAt>45000){
      const success=await probeRealtimeDatabase();
      if(success){
        if(!realtimeHealthy)markRealtimeStatus('fallback');
      }else{
        markRealtimeStatus('reconnecting');
        if(appMode==='admin')subscribeRealtime('admin');
        if(appMode==='employee')subscribeRealtime('employee');
      }
    }
  },20000);
}

async function probeRealtimeDatabase(){
  if(!sb||!currentProfile?.id)return false;
  try{
    const {error}=await sb
      .from('profiles')
      .select('id')
      .eq('id',currentProfile.id)
      .limit(1);
    return !error;
  }catch(error){
    console.warn('Realtime health probe failed',error);
    return false;
  }
}
async function refreshVisibleSiteData(showToast=false){
  if(!sb||appMode==='login'||!currentProfile?.id)return;
  try{
    if(appMode==='admin'){
      await Promise.allSettled([
        loadSettings(),
        loadEmployees(),
        loadAttendanceData(),
        loadHistoryData(),
        loadSalesData(),
        loadSalesGoals(),
        loadOnlinePresence(false),
        loadNotifications(false),
        loadAuditLogs(false),
        loadJobAccountData(false),
        loadExpenseRequests(false),
        loadInventorySnapshot(false),
        loadInventoryRequests(false),
        loadFarmData(false),
        loadFarmRequests(false),
        loadCampaigns(false),
        loadCommunityProfiles(false)
      ]);
      applySettings();
      renderDashboard();renderAttendance();renderEmployees();renderHistory();
      renderSalesPage();renderRanking();renderOnlinePresence();
      renderInventorySpreadsheet?.();renderFarmItemSettings?.();
    }else{
      await Promise.allSettled([
        loadSettings(),
        loadEmployees(),
        loadMyHistory(),
        loadMyAttendance(),
        loadAttendanceData(),
        loadSalesData(),
        loadSalesGoals(),
        loadOnlinePresence(false),
        loadNotifications(false),
        loadExpenseRequests(false),
        loadInventorySnapshot(false),
        loadInventoryRequests(false),
        loadFarmData(false),
        loadFarmRequests(false),
        loadCampaigns(false),
        loadCommunityProfiles(false)
      ]);
      applySettings();
      renderEmployeePortal();renderEmployeeAttendance();renderEmployeeDashboard();
      renderEmployeeRanking();renderOnlinePresence();
      renderEmployeeInventoryCountSheet?.();renderFarmEntrySheet?.();
    }
    realtimeLastSuccessAt=Date.now();
    if(showToast)toast('サイト全体を最新状態へ更新しました');
    return true;
  }catch(error){
    console.error('サイト全体更新エラー:',error);
    return false;
  }
}

function startRealtimeFallback(){
  clearInterval(realtimeFallbackTimer);
  realtimeFallbackTimer=setInterval(async()=>{
    if(document.visibilityState!=='visible'||appMode==='login')return;

    if(!navigator.onLine){
      markRealtimeStatus('offline');
      return;
    }

    const success=await refreshVisibleSiteData(false);
    if(success&&!realtimeHealthy){
      markRealtimeStatus('fallback');
    }
  },15000);

  startRealtimeHealthCheck();
}

function toggleEmployeeSidebar(){if(window.matchMedia('(max-width:760px)').matches){openMobileMenu('employee');return}document.getElementById('employeeSidebar')?.classList.toggle('open')}
function employeeGoPage(page){closeMobileMenu();
  document.querySelectorAll('#employeeApp .employee-page').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('#employeeApp [data-employee-page]').forEach(x=>x.classList.toggle('active',x.dataset.employeePage===page));document.querySelectorAll('[data-mobile-employee]').forEach(x=>x.classList.toggle('active',x.dataset.mobileEmployee===page));
  document.getElementById(`employee-page-${page}`)?.classList.add('active');
  document.getElementById('employeeSidebar')?.classList.remove('open');
  if(page==='approvals'){if(!anyDelegatedPermission())return employeeGoPage('home');loadDelegatedApprovals(false)}
  if(page==='home')renderEmployeeDashboard();
  if(page==='attendance')renderEmployeeAttendance();
  if(page==='ranking')loadRankingData(false);
  if(page==='inventory')loadEmployeeInventory();if(page==='farm')loadFarmData();
  if(page==='payslips')renderEmployeePortal();
  if(page==='profile')loadMyProfileForm();
  if(page==='online')loadOnlinePresence(true);
  if(page==='community')loadCommunityProfiles(false);
  if(page==='notifications')loadNotifications(false);if(page==='expenses')loadExpenseRequests(false);if(page==='inventory'){loadInventoryRequests(false);setEmployeeInventoryTab('view')}if(page==='farm')loadFarmRequests(false);if(page==='campaigns')loadCampaigns(false);
  window.scrollTo({top:0,behavior:'smooth'});
}
function employeeRankingRows(){
  const month=$('employeeRankingMonth')?.value||monthKeyLocal(new Date()),grouped=new Map();
  attendanceData.filter(a=>monthKeyLocal(a.clockIn)===month).forEach(a=>{
    const key=a.employeeUid||a.employeeId,c=grouped.get(key)||{uid:a.employeeUid,id:a.employeeId,name:a.employeeName,ms:0,shifts:0};
    c.ms+=attendanceDuration(a);c.shifts++;grouped.set(key,c);
  });
  return [...grouped.values()].sort((a,b)=>b.ms-a.ms||b.shifts-a.shifts||a.name.localeCompare(b.name,'ja'));
}

function startOfWeekDate(d=new Date()){const x=new Date(d);const day=(x.getDay()+6)%7;x.setHours(0,0,0,0);x.setDate(x.getDate()-day);return x}
function addDaysDate(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x}
function dashboardSalesRows(){
  // 新しい売上入力データがある場合は sales_records を優先。
  // まだ売上入力へ移行していない環境では、従来の給与明細の売上金を利用する。
  const recorded=(salesData||[]).filter(x=>Number(x.amount)>0);
  if(recorded.length)return recorded;
  return (historyData||[]).filter(x=>Number(x.salesAmount)>0).map(x=>({
    dbId:x.dbId,
    employeeUid:x.employeeUid,
    employeeId:x.employeeId,
    employeeName:x.employee,
    salesDate:x.issueDate,
    amount:Number(x.salesAmount)||0,
    note:'給与明細から集計',
    createdAt:x.createdAt
  }));
}
function sumSalesRange(start,end){return dashboardSalesRows().filter(x=>{const d=new Date((x.salesDate||'')+'T00:00:00');return d>=start&&d<end}).reduce((s,x)=>s+(Number(x.amount)||0),0)}
function sumPayrollRange(start,end){return historyData.filter(x=>{const d=new Date((x.issueDate||'')+'T00:00:00');return d>=start&&d<end}).reduce((s,x)=>s+(Number(x.net)||0),0)}
function compareLabel(current,previous,label){if(!previous)return `${label} --`;const pct=Math.round((current-previous)/previous*100);return `${label} ${pct>=0?'+':''}${pct}%`}
function setCompareEl(id,current,previous,label){const el=$(id);if(!el)return;el.textContent=compareLabel(current,previous,label);el.classList.remove('up','down');if(previous)el.classList.add(current>=previous?'up':'down')}
function businessAvatar(r){const employee=rankingEmployee(r);const name=employee?.name||r?.name||'Staff';const url=employee?.avatarUrl||r?.avatarUrl||'';return `<div class="mini-avatar">${url?`<img src="${esc(url)}" alt="${esc(name)}" loading="lazy">`:esc(name.slice(0,1))}</div>`}
function renderBusinessDashboard(prefix='biz'){
  const now=new Date(),todayStart=new Date(now.getFullYear(),now.getMonth(),now.getDate()),tomorrow=addDaysDate(todayStart,1),yesterday=addDaysDate(todayStart,-1);
  const weekStart=startOfWeekDate(now),nextWeek=addDaysDate(weekStart,7),prevWeek=addDaysDate(weekStart,-7);
  const monthStart=new Date(now.getFullYear(),now.getMonth(),1),nextMonth=new Date(now.getFullYear(),now.getMonth()+1,1),prevMonth=new Date(now.getFullYear(),now.getMonth()-1,1);
  const vals={Today:sumSalesRange(todayStart,tomorrow),Week:sumSalesRange(weekStart,nextWeek),Month:sumSalesRange(monthStart,nextMonth)};
  const pays={Today:sumPayrollRange(todayStart,tomorrow),Week:sumPayrollRange(weekStart,nextWeek),Month:sumPayrollRange(monthStart,nextMonth)};
  const prev={Today:sumSalesRange(yesterday,todayStart),Week:sumSalesRange(prevWeek,weekStart),Month:sumSalesRange(prevMonth,monthStart)};
  ['Today','Week','Month'].forEach(k=>{const a=$(prefix+k+'Sales'),b=$(prefix+k+'Profit');if(a)a.textContent=yen.format(vals[k]);if(b)b.textContent=yen.format(vals[k]-pays[k])});
  setCompareEl(prefix+'TodayCompare',vals.Today,prev.Today,'前日比');setCompareEl(prefix+'WeekCompare',vals.Week,prev.Week,'前週比');setCompareEl(prefix+'MonthCompare',vals.Month,prev.Month,'前月比');
  const chart=$(prefix+'SalesChart');if(chart){const days=[...Array(14)].map((_,i)=>addDaysDate(todayStart,i-13));const amounts=days.map(d=>sumSalesRange(d,addDaysDate(d,1)));const max=Math.max(1,...amounts);chart.innerHTML=days.map((d,i)=>`<div class="sales-trend-col"><div class="sales-trend-bar" style="height:${Math.max(3,Math.round(amounts[i]/max*100))}%" data-value="${yen.format(amounts[i])}"></div><small>${d.getMonth()+1}/${d.getDate()}</small></div>`).join('')}
  const list=$(prefix+'StaffSales');if(list){const rows=salesRankingRows(monthKeyLocal(now)).slice(0,5);list.innerHTML=rows.length?rows.map((r,i)=>`<div class="staff-sales-mini-row"><div class="rank">${i+1}</div>${businessAvatar(r)}<div class="who"><strong>${esc(rankingDisplayName(r))}</strong><small>${esc(r.id||'-')} ・ ${r.entries}件</small></div><div class="amount">${yen.format(r.amount)}</div></div>`).join(''):'<div class="empty">今月の売上記録はありません。</div>'}
}

// Latest inventory data loaded from Supabase/Google Sheets.
// Define it before the dashboard renders so early refreshes never crash.
inventorySnapshot=[];

function renderEmployeeDashboard(){
  if(!$('employeeDashWorking')||!currentEmployee)return;
  const today=iso(new Date()),active=attendanceData.filter(a=>!a.clockOut),todayList=attendanceData.filter(a=>dateKey(a.clockIn)===today);
  const unique=new Set(todayList.map(a=>a.employeeUid||a.employeeId)).size;
  const total=todayList.reduce((s,a)=>s+attendanceDuration(a),0);
  const month=monthKeyLocal(new Date()),myPay=historyData.filter(x=>monthKeyLocal(x.issueDate)===month).reduce((s,x)=>s+x.net,0);
  $('employeeDashWorking').textContent=`${active.length}名`;
  $('employeeDashTodayStaff').textContent=`${unique}名`;
  $('employeeDashTodayHours').textContent=formatDuration(total);
  $('employeeDashMonthlyPay').textContent=yen.format(myPay);
  $('employeeTopWorking').textContent=`${active.length}名`;
  $('employeeTopName').textContent=currentEmployee.name;
  $('employeeTopRole').textContent=currentEmployee.role;
  setAvatarElement($('employeeProfileAvatar'),cleanAvatarUrl(currentEmployee.avatarUrl)||cleanAvatarUrl(currentProfile?.avatar_url)||'',(currentEmployee.name||'従').slice(0,1));
  const open=active.length>0;
  $('employeeOpenStatus').textContent=open?'● OPEN':'● CLOSED';
  $('employeeOpenStatus').style.color=open?'#238642':'#b84242';
  const h=new Date().getHours();$('employeeGreeting').textContent=h<11?'おはようございます':h<18?'こんにちは':'こんばんは';
  $('employeeWorkingList').innerHTML=active.length?active.map(a=>{
    const emp=employees.find(e=>(a.employeeUid&&e.uid===a.employeeUid)||(a.employeeId&&String(e.id).toLowerCase()===String(a.employeeId).toLowerCase()));
    const displayName=emp?.name||a.employeeName||'スタッフ';
    const avatar=emp?.avatarUrl?`<div class="person-avatar"><img src="${esc(emp.avatarUrl)}" alt="${esc(displayName)}" loading="lazy"></div>`:`<div class="person-avatar">${esc(displayName.slice(0,1))}</div>`;
    return `<div class="working-person">${avatar}<div><strong>${esc(displayName)}</strong><span>${esc(a.employeeId)} ・ ${new Date(a.clockIn).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'})}から</span></div><div class="duration">${formatDuration(attendanceDuration(a))}</div></div>`;
  }).join(''):'<div class="empty">現在勤務中のスタッフはいません。</div>';
  const items=(inventorySnapshot&&inventorySnapshot.length?inventorySnapshot:inventoryFallback).slice(0,6);
  $('employeeInventoryPreview').innerHTML=items.map(x=>inventoryPreviewMarkup(x)).join('');
  renderBusinessDashboard('empBiz');renderSalesGoals();
  const mine=myAttendance.find(a=>!a.clockOut),state=$('employeeStatusPillHome');
  state.textContent=mine?'● 勤務中':'退勤中';state.classList.toggle('working',!!mine);
}


async function loadRankingData(showError=false){
  const errors=[];
  const tasks=[
    loadEmployees().catch(error=>errors.push(`プロフィール：${error.message}`)),
    loadAttendanceData().catch(error=>errors.push(`勤務記録：${error.message}`)),
    loadSalesData().catch(error=>errors.push(`売上記録：${error.message}`)),
    loadFarmData(false).catch(error=>errors.push(`Farm記録：${error.message}`))
  ];
  await Promise.allSettled(tasks);
  renderRanking?.();
  renderEmployeeRanking?.();

  if(errors.length){
    console.warn('ランキングデータの一部を取得できませんでした',errors);
    if(showError)alert(
      'ランキングの一部を取得できませんでした。\n'+
      errors.join('\n')+
      '\n\nVer.18.2.2の修復SQLを実行してください。'
    );
  }
}

function setEmployeeRankingMode(mode){
  employeeRankingMode=mode;
  $('employeeRankingModeHours').classList.toggle('active',mode==='hours');
  $('employeeRankingModeSales').classList.toggle('active',mode==='sales');
  $('employeeRankingModeFarm').classList.toggle('active',mode==='farm');
  $('employeeRankingMonthPicker')?.classList.toggle('hidden',mode==='farm');
  $('employeeRankingFarmPeriodPicker')?.classList.toggle('hidden',mode!=='farm');
  if(mode==='farm'){
    renderEmployeeRankingFarmPeriodOptions();
  }
  loadRankingData(false);
}

function renderEmployeeRanking(){
  if(!$('employeeRankingList'))return;
  const viewer=currentEmployee||mapProfile(currentProfile||{});
  if(!viewer?.uid&&currentProfile?.id)viewer.uid=currentProfile.id;
  if(!$('employeeRankingMonth').value)$('employeeRankingMonth').value=monthKeyLocal(new Date());
  const month=$('employeeRankingMonth').value;
  if(employeeRankingMode==='farm'){
    const rows=integratedFarmRankingRows();
    const total=rows.reduce((s,r)=>s+farmN(r.total),0);
    const ranking=farmRankingListHtml(rows,viewer.uid,viewer.id,viewer.name);
    const mine=ranking.mineIndex>=0?rows[ranking.mineIndex]:null;
    if($('employeeRankingPageTitle'))$('employeeRankingPageTitle').textContent='Farmランキング';
    if($('employeeRankingPageDescription'))$('employeeRankingPageDescription').textContent='選択期間の承認済みFarm採取数・査定・仕入れ金額です。';
    $('employeeRankTotalHours').textContent=`${total.toLocaleString('ja-JP')}個`;
    $('employeeMyRank').textContent=ranking.mineIndex>=0?`${ranking.mineIndex+1}位`:'-';
    $('employeeMyHours').textContent=mine?`${farmN(mine.total).toLocaleString('ja-JP')}個`:'0個';
    $('employeeRankingPodium').innerHTML=farmRankingPodiumHtml(rows,'この期間のFarm記録はありません。');
    $('employeeRankingList').innerHTML=ranking.html;
  }else if(employeeRankingMode==='sales'){
    if($('employeeRankingPageTitle'))$('employeeRankingPageTitle').textContent='売上ランキング';
    if($('employeeRankingPageDescription'))$('employeeRankingPageDescription').textContent='スタッフ全体の月間売上ランキングです。';
    const rows=salesRankingRows(month),total=rows.reduce((s,r)=>s+r.amount,0),mineIndex=rows.findIndex(r=>(r.uid&&r.uid===viewer.uid)||String(r.id).toLowerCase()===String(viewer.id).toLowerCase()),mine=mineIndex>=0?rows[mineIndex]:null;
    $('employeeRankTotalHours').textContent=yen.format(total);
    $('employeeMyRank').textContent=mineIndex>=0?`${mineIndex+1}位`:'-';
    $('employeeMyHours').textContent=mine?yen.format(mine.amount):'¥0';
    const top=rows.slice(0,3),order=[top[1],top[0],top[2]],classes=['second','first','third'],places=[2,1,3];
    $('employeeRankingPodium').innerHTML=order.map((r,i)=>r?`<div class="podium-item ${classes[i]}">${rankingAvatar(r,'podium-avatar')}<div class="podium-name">${esc(rankingDisplayName(r))}</div><div class="podium-hours">${yen.format(r.amount)}</div><div class="podium-block">${places[i]}位</div></div>`:'').join('')||'<div class="empty">この月の売上記録はありません。</div>';
    $('employeeRankingList').innerHTML=rows.length?rows.map((r,i)=>`<div class="ranking-row ${mineIndex===i?'my-ranking-row':''}"><div class="ranking-position">${i+1}</div>${rankingAvatar(r)}<div class="ranking-person"><strong>${esc(rankingDisplayName(r))}${mineIndex===i?'（あなた）':''}</strong><span>${esc(r.id||'-')}</span></div><div class="ranking-hours">${yen.format(r.amount)}</div><div class="ranking-shifts">${r.entries}件</div></div>`).join(''):'<div class="empty">売上記録はありません。</div>';
  }else{
    if($('employeeRankingPageTitle'))$('employeeRankingPageTitle').textContent='勤務時間ランキング';
    if($('employeeRankingPageDescription'))$('employeeRankingPageDescription').textContent='スタッフ全体の月間勤務時間と出勤回数です。';
    const rows=employeeRankingRows(),total=rows.reduce((s,r)=>s+r.ms,0),mineIndex=rows.findIndex(r=>(r.uid&&r.uid===viewer.uid)||String(r.id).toLowerCase()===String(viewer.id).toLowerCase()),mine=mineIndex>=0?rows[mineIndex]:null;
    $('employeeRankTotalHours').textContent=formatDuration(total);
    $('employeeMyRank').textContent=mineIndex>=0?`${mineIndex+1}位`:'-';
    $('employeeMyHours').textContent=mine?formatDuration(mine.ms):'0時間00分';
    const top=rows.slice(0,3),order=[top[1],top[0],top[2]],classes=['second','first','third'],places=[2,1,3];
    $('employeeRankingPodium').innerHTML=order.map((r,i)=>r?`<div class="podium-item ${classes[i]}">${rankingAvatar(r,'podium-avatar')}<div class="podium-name">${esc(rankingDisplayName(r))}</div><div class="podium-hours">${formatDuration(r.ms)}</div><div class="podium-block">${places[i]}位</div></div>`:'').join('')||'<div class="empty">この月の勤務記録はありません。</div>';
    $('employeeRankingList').innerHTML=rows.length?rows.map((r,i)=>`<div class="ranking-row ${mineIndex===i?'my-ranking-row':''}"><div class="ranking-position">${i+1}</div>${rankingAvatar(r)}<div class="ranking-person"><strong>${esc(rankingDisplayName(r))}${mineIndex===i?'（あなた）':''}</strong><span>${esc(r.id||'-')}</span></div><div class="ranking-hours">${formatDuration(r.ms)}</div><div class="ranking-shifts">${r.shifts}回</div></div>`).join(''):'<div class="empty">勤務記録はありません。</div>';
  }
}
function renderEmployeeInventory(items){
  const low=items.filter(x=>x.stock<x.min||x.status).length;
  $('employeeInventoryItems').textContent=items.length;
  $('employeeInventoryLow').textContent=low;
  $('employeeInventoryUpdated').textContent=new Date().toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'});
  $('employeeInventoryGrid').innerHTML=items.map(x=>inventoryGridCardMarkup(x)).join('');
}
async function loadEmployeeInventory(){await loadInventorySnapshot()}

function goPage(n){closeMobileMenu();document.querySelectorAll('#adminApp .page').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.nav button').forEach(x=>x.classList.toggle('active',x.dataset.page===n));document.querySelectorAll('[data-mobile-admin]').forEach(x=>x.classList.toggle('active',x.dataset.mobileAdmin===n));$('page-'+n).classList.add('active');if(n==='dashboard')renderDashboard();if(n==='sales')renderSalesPage();if(n==='job-account')loadJobAccountData(false);if(n==='expenses')loadExpenseRequests(false);if(n==='approvals')loadAdminApprovalCenter(false);if(n==='inventory')loadInventoryRequests(false);if(n==='farm')loadFarmRequests(false);if(n==='ranking')loadRankingData(false);if(n==='inventory')loadInventorySnapshot(false);if(n==='farm')loadFarmData();if(n==='employees')renderEmployees();if(n==='online')loadOnlinePresence(true);if(n==='community')loadCommunityProfiles(false);if(n==='notifications')loadNotifications(false);if(n==='campaigns')loadCampaigns(false);if(n==='audit')loadAuditLogs(false);if(n==='discord-report')renderDiscordReportPreview();if(n==='attendance')renderAttendance();if(n==='history')renderHistory();window.scrollTo({top:0,behavior:'smooth'})}

function startOfMonthISO(){
  const d=new Date();return iso(new Date(d.getFullYear(),d.getMonth(),1));
}
function renderDashboard(){
  if(!$('dashWorking'))return;
  const now=new Date(),today=iso(now),monthStart=startOfMonthISO();
  const active=attendanceData.filter(a=>!a.clockOut);
  const todayList=attendanceData.filter(a=>dateKey(a.clockIn)===today);
  const todayUnique=new Set(todayList.map(a=>a.employeeUid)).size;
  const todayMinutes=todayList.reduce((s,a)=>s+attendanceDuration(a),0);
  const monthPayroll=historyData.filter(x=>(x.issueDate||'')>=monthStart).reduce((s,x)=>s+x.net,0);
  $('dashWorking').textContent=`${active.length}名`;
  $('dashTodayStaff').textContent=`${todayUnique}名`;
  $('dashTodayHours').textContent=formatDuration(todayMinutes);
  $('dashMonthlyPayroll').textContent=yen.format(monthPayroll);
  renderBusinessDashboard('biz');renderSalesGoals();
  $('dashWorkingList').innerHTML=active.length?active.map(a=>{
    const emp=employees.find(e=>(a.employeeUid&&e.uid===a.employeeUid)||(a.employeeId&&String(e.id).toLowerCase()===String(a.employeeId).toLowerCase()));
    const role=emp?.role||'Cast',displayName=emp?.name||a.employeeName||'スタッフ';
    const avatar=emp?.avatarUrl?`<div class="person-avatar"><img src="${esc(emp.avatarUrl)}" alt="${esc(displayName)}" loading="lazy"></div>`:`<div class="person-avatar">${esc(displayName.slice(0,1))}</div>`;
    return `<div class="working-person">${avatar}<div><strong>${esc(displayName)}</strong><span>${esc(role)} ・ ${esc(a.employeeId)}<br>Since ${new Date(a.clockIn).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'})}</span></div><div class="duration">${formatDuration(attendanceDuration(a))}</div></div>`;
  }).join(''):'<div class="empty">現在勤務中のスタッフはいません。</div>';
  const days=[...Array(14)].map((_,i)=>{const d=new Date();d.setDate(d.getDate()-(13-i));return d});
  const vals=days.map(d=>attendanceData.filter(a=>dateKey(a.clockIn)===iso(d)).reduce((s,a)=>s+attendanceDuration(a),0));
  const max=Math.max(1,...vals);
  $('dashMonthChart').innerHTML=days.map((d,i)=>`<div class="chart-bar" style="height:${Math.max(5,Math.round(vals[i]/max*100))}%" data-label="${d.getMonth()+1}/${d.getDate()} ${formatDuration(vals[i])}"></div>`).join('');
  renderV4Extras();
  $('dashLatestPayslips').innerHTML=historyData.length?historyData.slice(0,5).map(x=>`<div class="working-person"><div class="person-avatar">¥</div><div><strong>${esc(x.employee)}</strong><span>${jp(x.periodStart)}〜${jp(x.periodEnd)}</span></div><div class="duration">${yen.format(x.net)}</div></div>`).join(''):'<div class="empty">明細履歴はありません。</div>';
}
async function importAttendancePayroll(){
  const id=$('employeeId').value.trim(),start=$('periodStart').value,end=$('periodEnd').value,rate=Number($('hourlyRate').value)||0;
  if(!id||!start||!end||!rate){alert('従業員・期間・時給を入力してください。');return}
  const records=attendanceData.filter(a=>a.employeeId.toLowerCase()===id.toLowerCase()&&dateKey(a.clockIn)>=start&&dateKey(a.clockIn)<=end&&a.clockOut);
  let minutes=records.reduce((s,a)=>s+attendanceDuration(a,new Date(a.clockOut)),0);
  const rounding=$('payRounding').value;
  if(rounding==='30')minutes=Math.floor(minutes/30)*30;
  if(rounding==='60')minutes=Math.floor(minutes/60)*60;
  const salary=Math.round(rate*(minutes/60));
  $('importHours').textContent=formatDuration(minutes);$('importShifts').textContent=`${records.length}回`;$('importSalary').textContent=yen.format(salary);
  const existing=[...$('earnings').querySelectorAll('.money-row')].find(r=>r.querySelector('.item-name').value==='勤務基本給');
  if(existing){existing.querySelector('.item-amount').value=salary}else addMoneyRow('earnings','勤務基本給',salary);
  update();toast('勤務時間から基本給与を反映しました');
}
function exportEmployeesCsv(){
  const rows=[['名前','役職','従業員番号'],...employees.map(e=>[e.name,e.role,e.id])];
  const csv='\ufeff'+rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\r\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`LaitDivin_Employees_${iso(new Date())}.csv`;a.click();URL.revokeObjectURL(a.href);
}

function setThisMonth(){
  const start=$('periodStart'),end=$('periodEnd');
  if(!start||!end)return;
  const d=new Date();
  start.value=iso(new Date(d.getFullYear(),d.getMonth(),1));
  end.value=iso(new Date(d.getFullYear(),d.getMonth()+1,0));
  update();
}
function setLastMonth(){
  const start=$('periodStart'),end=$('periodEnd');
  if(!start||!end)return;
  const d=new Date();
  start.value=iso(new Date(d.getFullYear(),d.getMonth()-1,1));
  end.value=iso(new Date(d.getFullYear(),d.getMonth(),0));
  update();
}
function addMoneyRow(c,n='',a=0){const r=document.createElement('div');r.className='money-row';r.innerHTML=`<input class="item-name" placeholder="項目名" value="${esc(n)}"><input class="item-amount" type="number" min="0" value="${Number(a)||0}" placeholder="金額"><button class="remove">×</button>`;r.querySelectorAll('input').forEach(x=>x.addEventListener('input',update));r.querySelector('button').onclick=()=>{r.remove();update()};$(c).appendChild(r);update()}
function quickAdd(c,n){addMoneyRow(c,n,0)}
function rows(id){return [...$(id).querySelectorAll('.money-row')].map(r=>({name:r.querySelector('.item-name').value.trim()||'未設定',amount:Number(r.querySelector('.item-amount').value)||0}))}
function commission(){return Math.round((Number($('salesAmount').value)||0)*(Number($('salesRate').value)||0)/100)}
function allEarnings(){
  const a=rows('earnings');
  const c=commission();
  if(c>0)a.unshift({name:`売上歩合（${$('salesRate').value}%）`,amount:c});
  return a;
}
function bonusAmountFromEarnings(earnings=allEarnings()){
  return earnings
    .filter(item=>String(item.name||'').includes('ボーナス'))
    .reduce((sum,item)=>sum+(Number(item.amount)||0),0);
}
function otherEarningsAmount(earnings=allEarnings()){
  const commissionAmount=earnings
    .filter(item=>String(item.name||'').startsWith('売上歩合'))
    .reduce((sum,item)=>sum+(Number(item.amount)||0),0);
  const bonusAmount=bonusAmountFromEarnings(earnings);
  const gross=earnings.reduce((sum,item)=>sum+(Number(item.amount)||0),0);
  return Math.max(0,gross-commissionAmount-bonusAmount);
}
function renderRows(t,d){$(t).innerHTML='';const v=d.filter(x=>x.name!=='未設定'||x.amount);if(!v.length){$(t).innerHTML='<tr><td colspan="2" style="text-align:center;color:#aaa;font-size:11px">項目はありません</td></tr>';return}v.forEach(x=>{const tr=document.createElement('tr');tr.innerHTML=`<td>${esc(x.name)}</td><td>${yen.format(x.amount)}</td>`;$(t).appendChild(tr)})}
function slipNo(){if(!currentSlipNo) currentSlipNo=newSlipNo();return currentSlipNo}
function update(){
  if(!$('vEmployee'))return;

  const employeeInput=$('employee');
  const roleInput=$('role');
  const employeeIdInput=$('employeeId');
  const issueDateInput=$('issueDate');
  const periodStartInput=$('periodStart');
  const periodEndInput=$('periodEnd');
  const noteInput=$('note');

  if($('vEmployee'))$('vEmployee').textContent=employeeInput?.value.trim()||'未入力';
  if($('vRole'))$('vRole').textContent=roleInput?.value||'-';
  if($('vEmployeeId'))$('vEmployeeId').textContent=employeeIdInput?.value.trim()||'-';
  if($('vIssue'))$('vIssue').textContent=jp(issueDateInput?.value||'');
  if($('vPeriod')){
    $('vPeriod').textContent=periodStartInput?.value&&periodEndInput?.value
      ?`${jp(periodStartInput.value)} ～ ${jp(periodEndInput.value)}`
      :'-';
  }
  if($('vSlipNo'))$('vSlipNo').textContent=slipNo();

  const earnings=allEarnings();
  const deductions=rows('deductions');
  const gross=earnings.reduce((sum,item)=>sum+item.amount,0);
  const deductionTotal=deductions.reduce((sum,item)=>sum+item.amount,0);
  const commissionAmount=commission();
  const bonusAmount=bonusAmountFromEarnings(earnings);
  const otherAmount=Math.max(0,gross-commissionAmount-bonusAmount);
  const net=gross-deductionTotal;

  if($('salesCommissionPreview'))$('salesCommissionPreview').textContent=yen.format(commissionAmount);
  if($('vCommission'))$('vCommission').textContent=yen.format(commissionAmount);
  if($('vBonus'))$('vBonus').textContent=yen.format(bonusAmount);
  if($('vOtherEarnings'))$('vOtherEarnings').textContent=yen.format(otherAmount);
  if($('vGross'))$('vGross').textContent=yen.format(gross);
  if($('vDeduction'))$('vDeduction').textContent=yen.format(deductionTotal);
  if($('vNet'))$('vNet').textContent=yen.format(net);
  if($('miniGross'))$('miniGross').textContent=yen.format(gross);
  if($('miniNet'))$('miniNet').textContent=yen.format(net);

  if($('vEarnings'))renderRows('vEarnings',earnings);
  if($('vDeductions'))renderRows('vDeductions',deductions);
  if($('vNote'))$('vNote').textContent=noteInput?.value.trim()||'備考なし';

  applySettings();
  saveDraft();
}
function applySettings(){if(!$('sheetShop'))return;$('sheetShop').textContent=settings.shop;$('sheetCity').textContent=settings.city;$('sheetLogo').innerHTML='<img src="assets/lait-divin-logo.png" alt="Lait Divin logo">';$('sheetFooter').textContent=settings.footer;$('sheetStamp').innerHTML=esc(settings.shop).replace(/\s+/g,'<br>')}
function formData(){
  const e=allEarnings();
  const d=rows('deductions');
  const g=e.reduce((s,x)=>s+x.amount,0);
  const dd=d.reduce((s,x)=>s+x.amount,0);
  return {
    slipNo:slipNo(),
    employee:$('employee').value.trim(),
    role:$('role').value,
    employeeId:$('employeeId').value.trim(),
    issueDate:$('issueDate').value,
    periodStart:$('periodStart').value,
    periodEnd:$('periodEnd').value,
    salesAmount:Number($('salesAmount').value)||0,
    salesRate:Number($('salesRate').value)||0,
    commissionAmount:commission(),
    bonusAmount:bonusAmountFromEarnings(e),
    otherEarnings:otherEarningsAmount(e),
    earnings:e,
    deductions:d,
    note:$('note').value,
    gross:g,
    deduction:dd,
    net:g-dd
  };
}
function saveDraft(){if($('employee'))localStorage.setItem(DRAFT_KEY,JSON.stringify(formData()))}
function loadDraft(){try{const d=JSON.parse(localStorage.getItem(DRAFT_KEY));if(!d)return false;$('employee').value=d.employee||'';$('role').value=d.role||'Cast';$('employeeId').value=d.employeeId||'';$('issueDate').value=d.issueDate||iso(new Date());$('periodStart').value=d.periodStart||'';$('periodEnd').value=d.periodEnd||'';$('salesAmount').value=d.salesAmount||0;$('salesRate').value=String(d.salesRate||0);$('note').value=d.note||'';$('earnings').innerHTML='';$('deductions').innerHTML='';(d.earnings||[]).filter(x=>!x.name.startsWith('売上歩合')).forEach(x=>addMoneyRow('earnings',x.name,x.amount));(d.deductions||[]).forEach(x=>addMoneyRow('deductions',x.name,x.amount));return true}catch{return false}}
function clearForm(){if(!confirm('入力内容をリセットしますか？'))return;localStorage.removeItem(DRAFT_KEY);$('employeeSelect').value='';$('employee').value='';$('employeeId').value='';$('role').value='Cast';$('issueDate').value=iso(new Date());setThisMonth();$('salesAmount').value=0;$('salesRate').value='0';$('earnings').innerHTML='';$('deductions').innerHTML='';addMoneyRow('deductions','その他控除',0);$('note').value='今月もお疲れさまでした。\nご不明な点は店舗管理者までお問い合わせください。';currentSlipNo=newSlipNo();update()}
async function savePayslip(){
  const d=formData();
  if(!d.employee||!d.employeeId){alert('登録済み従業員を選択してください。');return}
  const emp=employees.find(x=>x.id===d.employeeId);if(!emp){alert('従業員管理に登録されていません。');return}
  if(!d.periodStart||!d.periodEnd){alert('支給対象期間を選択してください。');return}
  const payload={
    employee_uid:emp.uid,
    employee_id:d.employeeId,
    employee_name:d.employee,
    employee_role:d.role,
    slip_number:d.slipNo,
    issue_date:d.issueDate,
    period_start:d.periodStart,
    period_end:d.periodEnd,
    sales_amount:d.salesAmount,
    sales_rate:d.salesRate,
    commission_amount:d.commissionAmount,
    bonus_amount:d.bonusAmount,
    earnings:d.earnings,
    deductions:d.deductions,
    gross_amount:d.gross,
    deduction_amount:d.deduction,
    net_amount:d.net,
    note:d.note
  };
  const {error}=await sb.from('payslips').insert(payload);if(error){console.error(error);alert('サーバー保存に失敗しました：'+error.message);return}
  currentSlipNo=newSlipNo();localStorage.removeItem(DRAFT_KEY);await loadHistoryData();update();toast('サーバーへ保存しました')
}
async function saveImage(){const c=await html2canvas($('sheet'),{scale:2.2,backgroundColor:'#171210',useCORS:true});const a=document.createElement('a');a.download=`${settings.shop}_${slipNo()}_${($('employee').value||'従業員').replace(/[\\/:*?"<>|]/g,'_')}.png`;a.href=c.toDataURL('image/png');a.click()}
function refreshEmployeeSelect(){const s=$('employeeSelect');s.innerHTML='<option value="">直接入力する</option>';employees.forEach((e,i)=>{const o=document.createElement('option');o.value=i;o.textContent=`${e.name}（${e.role}）`;s.appendChild(o)})}
function applyEmployee(){const i=$('employeeSelect').value;if(i==='')return;const e=employees[Number(i)];$('employee').value=e.name;$('role').value=e.role;$('employeeId').value=e.id;update()}
function openEmployeeModal(i=''){
  $('employeeModal').classList.remove('hidden');
  $('editEmployeeIndex').value=i;
  const setPermissions=permissions=>{
    $('permissionExpenseApproval').checked=permissions?.expense_approval===true;
    $('permissionInventoryApproval').checked=permissions?.inventory_approval===true;
    $('permissionFarmApproval').checked=permissions?.farm_approval===true;
  };
  if(i===''){
    $('employeeModalTitle').textContent='従業員を登録';
    $('modalName').value='';
    $('modalRole').value='Cast';
    $('modalId').value='';
    $('modalPassword').value='';
    setPermissions({});
  }else{
    const e=employees[Number(i)];
    $('employeeModalTitle').textContent='従業員を編集';
    $('modalName').value=e.name;
    $('modalRole').value=e.role;
    $('modalId').value=e.id;
    $('modalPassword').value='';
    setPermissions(e.permissions||{});
  }
}
function closeEmployeeModal(){$('employeeModal').classList.add('hidden')}
async function callEmployeeFunction(body){
  const {data:{session},error:sessionError}=await sb.auth.getSession();
  if(sessionError)throw new Error('ログイン確認に失敗しました：'+sessionError.message);
  if(!session)throw new Error('ログインが切れています。再ログインしてください。');

  const res=await fetch(`${cfg.SUPABASE_URL}/functions/v1/manage-employee`,{
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'Authorization':`Bearer ${session.access_token}`,
      'apikey':cfg.SUPABASE_ANON_KEY
    },
    body:JSON.stringify(body)
  });

  const raw=await res.text();
  let result={};
  try{result=raw?JSON.parse(raw):{}}catch{result={error:raw||'不明な応答'}}

  if(!res.ok||result.ok===false){
    const message=result.error||result.details||`従業員処理に失敗しました（HTTP ${res.status}）`;
    console.error('manage-employee error',{status:res.status,result});
    throw new Error(message);
  }
  return result;
}
async function saveEmployee(){
  const name=$('modalName').value.trim();
  const id=$('modalId').value.trim();
  const role=$('modalRole').value;
  const password=$('modalPassword').value;
  const index=$('editEmployeeIndex').value;
  const permissions=permissionPayloadFromModal();

  if(!name||!id){alert('名前と従業員番号を入力してください。');return}
  if(!/^[A-Za-z0-9._-]+$/.test(id)){
    alert('従業員番号は半角英数字・ドット・ハイフン・アンダーバーで入力してください。');
    return;
  }
  if(index===''&&password.length<6){
    alert('新規登録時のパスワードは6文字以上にしてください。');
    return;
  }
  if(password&&password.length<6){
    alert('パスワードを変更する場合は6文字以上にしてください。');
    return;
  }

  const saveButton=document.querySelector('#employeeModal .btn.primary');
  if(saveButton)saveButton.disabled=true;

  try{
    if(index===''){
      await callEmployeeFunction({
        action:'create',
        name,
        employeeId:id,
        role,
        password
      });
    }else{
      const old=employees[Number(index)];
      await callEmployeeFunction({
        action:'update',
        userId:old.uid,
        name,
        employeeId:id,
        role,
        password:password||null
      });
    }

    await loadEmployees();
    const savedEmployee=employees.find(employee=>String(employee.id).toLowerCase()===String(id).toLowerCase());
    if(!savedEmployee?.uid)throw new Error('保存した従業員プロフィールを確認できませんでした。');

    const {error:permissionError}=await sb
      .from('profiles')
      .update({permissions})
      .eq('id',savedEmployee.uid);

    if(permissionError)throw new Error('権限を保存できませんでした：'+permissionError.message);

    await loadEmployees();
    closeEmployeeModal();
    refreshEmployeeSelect();
    renderEmployees();
    toast(index===''?'新規従業員を登録しました':'従業員情報を更新しました');
  }catch(error){
    alert('従業員を保存できませんでした。\n\n'+(error.message||error));
  }finally{
    if(saveButton)saveButton.disabled=false;
  }
}
function renderEmployees(){const c=$('employeeCards');c.innerHTML='';const q=($('employeeSearch')?.value||'').toLowerCase(),rf=$('employeeRoleFilter')?.value||'';const filtered=employees.filter(e=>`${e.name} ${e.id}`.toLowerCase().includes(q)&&(!rf||e.role===rf));if(!filtered.length){c.innerHTML='<div class="empty">条件に一致する従業員はいません。</div>';return}filtered.forEach(e=>{const i=employees.indexOf(e);const d=document.createElement('div');d.className='card';const records=attendanceData.filter(a=>(a.employeeUid&&a.employeeUid===e.uid)||String(a.employeeId).toLowerCase()===String(e.id).toLowerCase());const days=new Set(records.map(a=>dateKey(a.clockIn))).size;
d.classList.add('admin-profile-card');
const avatar=e.avatarUrl?`<div class="admin-profile-avatar has-image" style="background-image:url('${esc(e.avatarUrl)}')"></div>`:`<div class="admin-profile-avatar">${esc((e.name||'従').slice(0,1))}</div>`;
d.innerHTML=`<div class="admin-profile-head">${avatar}<div><h3>${esc(e.name)}</h3><p>${esc(e.role)} ・ ${esc(e.id)}</p></div></div><div class="admin-profile-bio">${esc(e.bio||'自己紹介はまだ設定されていません。')}</div><div class="admin-profile-meta"><span>Discord</span><strong>${esc(e.discordName||'未設定')}</strong><span>ひとこと</span><strong>${esc(e.statusMessage||'未設定')}</strong><span>出勤日数</span><strong>${days}日</strong><span>勤務記録</span><strong>${records.length}件</strong></div><button class="btn employee-attendance-button" onclick="openAttendanceDetail(${i})">出勤した日を確認</button><div class="card-actions"><button class="btn primary" onclick="useEmployee(${i})">明細作成</button><button class="btn" onclick="openEmployeeModal(${i})">編集</button><button class="btn danger" onclick="deleteEmployee(${i})">削除</button></div>`;c.appendChild(d)})}
function useEmployee(i){goPage('create');$('employeeSelect').value=i;applyEmployee()}
async function deleteEmployee(i){if(!confirm(`${employees[i].name} を削除しますか？`))return;try{await callEmployeeFunction({action:'delete',userId:employees[i].uid});await loadEmployees();refreshEmployeeSelect();renderEmployees()}catch(e){alert(e.message)}}
function renderHistory(){const q=($('historySearch').value||'').toLowerCase(),b=$('historyList');b.innerHTML='';const list=historyData.filter(x=>`${x.employee} ${x.role} ${x.employeeId} ${x.periodStart} ${x.periodEnd}`.toLowerCase().includes(q));if(!list.length){b.innerHTML='<div class="empty">該当する履歴はありません。</div>';return}list.forEach(x=>{const i=historyData.indexOf(x),d=document.createElement('div');d.className='list-item';d.innerHTML=`<div class="list-main"><strong>${esc(x.employee)}</strong><span>${esc(x.slipNo)} ・ ${esc(x.employeeId)}</span></div><div>${jp(x.periodStart)}<br>〜 ${jp(x.periodEnd)}</div><div><strong style="font-size:14px;color:var(--ink)">${yen.format(x.net)}</strong><br>差引支給額</div><div class="list-actions"><button class="btn primary" onclick="loadHistory(${i})">開く</button><button class="btn danger" onclick="deleteHistory(${i})">削除</button></div>`;b.appendChild(d)})}
function loadHistory(i){const d=historyData[i];goPage('create');$('employee').value=d.employee;$('role').value=d.role;$('employeeId').value=d.employeeId;$('issueDate').value=d.issueDate;$('periodStart').value=d.periodStart;$('periodEnd').value=d.periodEnd;$('salesAmount').value=d.salesAmount||0;$('salesRate').value=String(d.salesRate||0);$('note').value=d.note;$('earnings').innerHTML='';$('deductions').innerHTML='';(d.earnings||[]).filter(x=>!x.name.startsWith('売上歩合')).forEach(x=>addMoneyRow('earnings',x.name,x.amount));(d.deductions||[]).forEach(x=>addMoneyRow('deductions',x.name,x.amount));currentSlipNo=d.slipNo;update()}
async function deleteHistory(i){if(!confirm('この履歴を削除しますか？'))return;const {error}=await sb.from('payslips').delete().eq('id',historyData[i].dbId);if(error){alert(error.message);return}await loadHistoryData();renderHistory()}
async function clearHistory(){if(!confirm('履歴をすべて削除しますか？'))return;const {error}=await sb.from('payslips').delete().neq('id',0);if(error){alert(error.message);return}await loadHistoryData();renderHistory()}
function loadSettingsUI(){$('settingShop').value=settings.shop;$('settingCity').value=settings.city;$('settingLogo').value=settings.logo;$('settingPrefix').value=settings.prefix;$('settingFooter').value=settings.footer}
async function saveSettings(){const payload={id:1,shop_name:$('settingShop').value.trim()||'Lait Divin',city_subtitle:$('settingCity').value.trim(),logo_text:$('settingLogo').value.trim()||'🐄',slip_prefix:$('settingPrefix').value.trim()||'LD',footer_text:$('settingFooter').value};const {error}=await sb.from('app_settings').upsert(payload);if(error){alert(error.message);return}await loadSettings();applySettings();currentSlipNo=newSlipNo();update();await writeAudit('settings','店舗設定を更新',payload.shop_name);toast('サーバーへ設定を保存しました')}
function exportBackup(){const data={version:3,employees,history:historyData,settings};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`LaitDivin_Backup_${iso(new Date())}.json`;a.click()}
function importBackup(){alert('オンライン版では誤上書きを防ぐため、復元はSupabase管理画面またはSQLで行います。')}
function renderEmployeePortal(){$('portalEmployeeName').textContent=`${currentEmployee.name}さん`;$('portalEmployeeMeta').textContent=`${currentEmployee.role} ・ ${currentEmployee.id}`;
  const ms=startOfMonthISO(),month=myAttendance.filter(a=>dateKey(a.clockIn)>=ms),mins=month.reduce((s,a)=>s+attendanceDuration(a),0);
  if($('portalMonthHours')){$('portalMonthHours').textContent=formatDuration(mins);$('portalMonthShifts').textContent=`${month.length}回`;$('portalLatestPay').textContent=historyData.length?yen.format(historyData[0].net):'¥0'}
  const g=$('employeeSlipGrid');g.innerHTML='';if(!historyData.length){g.innerHTML='<div class="empty">まだ給料明細はありません。</div>';return}historyData.forEach(x=>{const i=historyData.indexOf(x),c=document.createElement('div');c.className='card';c.innerHTML=`<h3>${jp(x.periodStart)}〜${jp(x.periodEnd)}</h3><p>${esc(x.slipNo)}<br>差引支給額：${yen.format(x.net)}</p><div class="card-actions"><button class="btn primary" onclick="openEmployeeSlip(${i})">明細を見る</button></div>`;g.appendChild(c)})}
function slipHTML(x){
  const earnings=x.earnings||[];
  const commissionAmount=Number(x.commissionAmount)||earnings
    .filter(item=>String(item.name||'').startsWith('売上歩合'))
    .reduce((sum,item)=>sum+(Number(item.amount)||0),0);
  const bonusAmount=Number(x.bonusAmount)||earnings
    .filter(item=>String(item.name||'').includes('ボーナス'))
    .reduce((sum,item)=>sum+(Number(item.amount)||0),0);
  const otherEarnings=Math.max(0,(Number(x.gross)||0)-commissionAmount-bonusAmount);

  const er=earnings.map(item=>`<tr><td>${esc(item.name)}</td><td>${yen.format(item.amount)}</td></tr>`).join('')
    ||'<tr><td colspan="2">項目なし</td></tr>';
  const dr=(x.deductions||[]).map(item=>`<tr><td>${esc(item.name)}</td><td>${yen.format(item.amount)}</td></tr>`).join('')
    ||'<tr><td colspan="2">項目なし</td></tr>';

  return `<section class="sheet" id="viewedSheet" style="width:100%;min-height:auto">
    <div class="sheet-head">
      <div class="sheet-brand">
        <div>
          <div class="sheet-name">${esc(settings.shop)}</div>
          <div class="sheet-city">${esc(settings.city)}</div>
        </div>
        <div class="sheet-logo"><img src="assets/lait-divin-logo.png" alt="Lait Divin logo"></div>
      </div>
      <div class="sheet-title">
        <strong>給料明細書</strong>
        <div class="issue">明細番号<br>${esc(x.slipNo)}<br><br>発行日<br>${jp(x.issueDate)}</div>
      </div>
    </div>
    <div class="sheet-body">
      <div class="person">
        <div><div class="meta-k">従業員名</div><div class="meta-v">${esc(x.employee)}</div></div>
        <div><div class="meta-k">役職</div><div class="meta-v">${esc(x.role)}</div></div>
        <div><div class="meta-k">従業員番号</div><div class="meta-v">${esc(x.employeeId)}</div></div>
        <div class="all"><div class="meta-k">支給対象期間</div><div class="meta-v">${jp(x.periodStart)} ～ ${jp(x.periodEnd)}</div></div>
      </div>

      <div class="summary payslip-breakdown-summary">
        <div class="sum commission"><div class="k">売上歩合支給額</div><div class="v">${yen.format(commissionAmount)}</div></div>
        <div class="sum bonus"><div class="k">ボーナス支給額</div><div class="v">${yen.format(bonusAmount)}</div></div>
        <div class="sum"><div class="k">その他支給額</div><div class="v">${yen.format(otherEarnings)}</div></div>
        <div class="sum"><div class="k">控除合計</div><div class="v">${yen.format(x.deduction)}</div></div>
        <div class="sum net"><div class="k">差引支給額</div><div class="v">${yen.format(x.net)}</div></div>
      </div>

      <div class="table-title">支給内訳</div>
      <table><tbody>${er}</tbody></table>
      <div class="table-title">控除内訳</div>
      <table><tbody>${dr}</tbody></table>
      <div class="note">${esc(x.note)}</div>
    </div>
  </section>`;
}
function openEmployeeSlip(i){const x=historyData[i];if(!currentEmployee||x.employeeId.toLowerCase()!==currentEmployee.id.toLowerCase())return;currentViewedSlip=x;$('viewedSlipContainer').innerHTML=slipHTML(x);$('slipModal').classList.remove('hidden')}
function closeSlipModal(){$('slipModal').classList.add('hidden')}
function attendanceDuration(a,endDate=new Date()){
  const start=new Date(a.clockIn), end=a.clockOut?new Date(a.clockOut):endDate;
  return Math.max(0,end-start);
}
function formatDuration(ms){const mins=Math.floor(ms/60000),h=Math.floor(mins/60),m=mins%60;return `${h}時間${String(m).padStart(2,'0')}分`}
function dateKey(v){
  if(!v)return'';
  return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(v));
}
function fmtDateTime(v){return v?new Date(v).toLocaleString('ja-JP',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):'-'}
function setAttendanceToday(){$('attendanceDate').value=iso(new Date());renderAttendance()}

function salesMonthKey(value){return String(value||'').slice(0,7)}
function salesRowsForMonth(month){
  return dashboardSalesRows().filter(x=>salesMonthKey(x.salesDate)===month)
}

function salesRankingRows(month){
  const grouped=new Map();
  salesRowsForMonth(month).forEach(x=>{
    const key=x.employeeUid||x.employeeId;
    const current=grouped.get(key)||{uid:x.employeeUid,id:x.employeeId,name:x.employeeName,amount:0,entries:0};
    current.amount+=Number(x.amount)||0;
    current.entries++;
    grouped.set(key,current);
  });
  employees.forEach(e=>{
    if(!grouped.has(e.uid))grouped.set(e.uid,{uid:e.uid,id:e.id,name:e.name,amount:0,entries:0})
  });
  return [...grouped.values()].sort((a,b)=>b.amount-a.amount||b.entries-a.entries||a.name.localeCompare(b.name,'ja'));
}
function refreshSalesEmployeeSelect(){
  const select=$('salesEmployee');
  if(!select)return;
  select.innerHTML=employees.map(e=>`<option value="${esc(e.uid)}">${esc(e.name)}（${esc(e.id)}）</option>`).join('');
}
function openSalesModal(id=''){
  refreshSalesEmployeeSelect();
  $('salesEditId').value=id||'';
  $('salesModalTitle').textContent=id?'売上を編集':'売上を入力';
  if(id){
    const entry=salesData.find(x=>String(x.dbId)===String(id));
    if(!entry)return;
    $('salesEmployee').value=entry.employeeUid;
    $('salesDate').value=entry.salesDate;
    $('salesAmountInput').value=entry.amount;
    $('salesNote').value=entry.note||'';
  }else{
    $('salesDate').value=iso(new Date());
    $('salesAmountInput').value='';
    $('salesNote').value='';
    if(employees[0])$('salesEmployee').value=employees[0].uid;
  }
  $('salesModal').classList.remove('hidden');
}
function closeSalesModal(){$('salesModal').classList.add('hidden')}
async function saveSalesEntry(){
  const employee=employees.find(e=>e.uid===$('salesEmployee').value);
  const salesDate=$('salesDate').value;
  const amount=Number($('salesAmountInput').value);
  const note=$('salesNote').value.trim();
  const id=$('salesEditId').value;
  if(!employee){alert('スタッフを選択してください。');return}
  if(!salesDate){alert('売上日を入力してください。');return}
  if(!Number.isFinite(amount)||amount<0){alert('正しい売上金額を入力してください。');return}
  const payload={
    employee_uid:employee.uid,
    employee_id:employee.id,
    employee_name:employee.name,
    sales_date:salesDate,
    amount:Math.round(amount),
    note,
    updated_at:new Date().toISOString()
  };
  const result=id
    ?await sb.from('sales_records').update(payload).eq('id',id)
    :await sb.from('sales_records').insert(payload);
  if(result.error){alert('売上を保存できませんでした：'+result.error.message);return}
  closeSalesModal();
  await loadSalesData();
  renderSalesPage();renderRanking();renderDashboard();
  await writeAudit('sales',id?'売上を更新':'売上を登録',`${employee.name} / ${salesDate} / ${yen.format(Math.round(amount))}`,employee.name);toast(id?'売上を更新しました':'売上を登録しました');
}
async function deleteSalesEntry(id){
  if(!confirm('この売上記録を削除しますか？'))return;
  const {error}=await sb.from('sales_records').delete().eq('id',id);
  if(error){alert('削除できませんでした：'+error.message);return}
  await loadSalesData();
  renderSalesPage();renderRanking();renderDashboard();
  await writeAudit('sales','売上を削除',`記録ID: ${id}`);toast('売上記録を削除しました');
}
function filteredSalesRows(){
  const month=$('salesFilterMonth')?.value||monthKeyLocal(new Date());
  const q=($('salesSearch')?.value||'').toLowerCase();
  return salesRowsForMonth(month).filter(x=>`${x.employeeName} ${x.employeeId} ${x.note}`.toLowerCase().includes(q));
}
function renderSalesPage(){
  if(!$('salesHistoryTable'))return;
  if(!$('salesFilterMonth').value)$('salesFilterMonth').value=monthKeyLocal(new Date());
  const month=$('salesFilterMonth').value,list=filteredSalesRows(),ranking=salesRankingRows(month);
  const total=salesRowsForMonth(month).reduce((s,x)=>s+x.amount,0);
  $('salesMonthTotal').textContent=yen.format(total);
  $('salesMonthEntries').textContent=`${salesRowsForMonth(month).length}件`;
  $('salesTopStaff').textContent=ranking[0]?.amount?ranking[0].name:'-';
  $('salesHistoryTable').innerHTML=list.length?`<table><thead><tr><th>売上日</th><th>スタッフ</th><th>売上金額</th><th>メモ</th><th>操作</th></tr></thead><tbody>${list.map(x=>`<tr><td>${new Date(x.salesDate+'T00:00:00').toLocaleDateString('ja-JP',{year:'numeric',month:'2-digit',day:'2-digit'})}</td><td><strong>${esc(x.employeeName)}</strong><br><span style="font-size:9px;color:var(--muted)">${esc(x.employeeId)}</span></td><td class="sales-amount">${yen.format(x.amount)}</td><td class="sales-note-cell">${esc(x.note||'-')}</td><td><div class="sales-actions"><button class="btn" onclick="openSalesModal('${esc(x.dbId)}')">編集</button><button class="btn danger" onclick="deleteSalesEntry('${esc(x.dbId)}')">削除</button></div></td></tr>`).join('')}</tbody></table>`:'<div class="empty">この月の売上記録はありません。</div>';
}
function exportSalesCsv(){
  const rows=filteredSalesRows();
  const table=[['売上日','従業員名','従業員番号','売上金額','メモ'],...rows.map(x=>[x.salesDate,x.employeeName,x.employeeId,x.amount,x.note])];
  const csv='\ufeff'+table.map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\r\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download=`売上履歴_${$('salesFilterMonth').value}.csv`;a.click();URL.revokeObjectURL(a.href);
}
function setRankingMode(mode){
  rankingMode=mode;
  $('rankingModeHours').classList.toggle('active',mode==='hours');
  $('rankingModeSales').classList.toggle('active',mode==='sales');
  $('rankingModeFarm').classList.toggle('active',mode==='farm');
  $('rankingMonthPicker')?.classList.toggle('hidden',mode==='farm');
  $('rankingFarmPeriodPicker')?.classList.toggle('hidden',mode!=='farm');
  if(mode==='farm'){
    renderRankingFarmPeriodOptions();
  }
  loadRankingData(false);
}

function attendanceFilteredList(){
  const selected=$('attendanceDate').value||iso(new Date());
  const q=($('attendanceSearch').value||'').toLowerCase();
  return attendanceData.filter(a=>dateKey(a.clockIn)===selected&&`${a.employeeName} ${a.employeeId}`.toLowerCase().includes(q));
}
function clearAttendanceSelection(){
  selectedAttendanceIds.clear();
  updateAttendanceDeleteButton();
}
function updateAttendanceDeleteButton(){
  const button=$('deleteSelectedAttendanceBtn');
  if(!button)return;
  button.disabled=selectedAttendanceIds.size===0;
  button.textContent=`選択した勤務を削除（${selectedAttendanceIds.size}件）`;
}
function toggleAttendanceSelection(id,checked){
  if(checked)selectedAttendanceIds.add(String(id));
  else selectedAttendanceIds.delete(String(id));
  updateAttendanceDeleteButton();
  document.querySelector(`[data-attendance-row="${CSS.escape(String(id))}"]`)?.classList.toggle('attendance-row-selected',checked);
}
function toggleAllAttendanceSelection(checked){
  attendanceFilteredList().forEach(a=>{
    if(checked)selectedAttendanceIds.add(String(a.dbId));
    else selectedAttendanceIds.delete(String(a.dbId));
  });
  renderAttendance();
}
function renderAttendance(){
  renderAttendanceControl();
  if(!$('attendanceTable'))return;
  const list=attendanceFilteredList();
  const unique=new Set(list.map(a=>a.employeeUid||a.employeeId)).size;
  const working=attendanceData.filter(a=>!a.clockOut).length;
  const total=list.reduce((s,a)=>s+attendanceDuration(a),0);
  $('todayAttendanceCount').textContent=`${unique}名`;
  $('workingAttendanceCount').textContent=`${working}名`;
  $('todayAttendanceHours').textContent=formatDuration(total);
  $('workingCountPill').textContent=`勤務中 ${working}名`;
  $('workingCountPill').className=`status-pill ${working?'working':'off'}`;
  updateAttendanceDeleteButton();

  if(!list.length){
    $('attendanceTable').innerHTML='<div class="empty">この日の出退勤記録はありません。</div>';
    return;
  }

  const allChecked=list.every(a=>selectedAttendanceIds.has(String(a.dbId)));
  $('attendanceTable').innerHTML=`<table><thead><tr>
    <th><input class="attendance-check" type="checkbox" ${allChecked?'checked':''} onchange="toggleAllAttendanceSelection(this.checked)" aria-label="すべて選択"></th>
    <th>従業員</th><th>出勤</th><th>退勤</th><th>勤務時間</th><th>状態</th><th>操作</th>
  </tr></thead><tbody>${list.map(a=>{
    const checked=selectedAttendanceIds.has(String(a.dbId));
    return `<tr data-attendance-row="${esc(a.dbId)}" class="${checked?'attendance-row-selected':''}">
      <td><input class="attendance-check" type="checkbox" ${checked?'checked':''} onchange="toggleAttendanceSelection('${esc(a.dbId)}',this.checked)"></td>
      <td><strong>${esc(a.employeeName)}</strong><br><span style="font-size:10px;color:var(--muted)">${esc(a.employeeId)}</span><br><button class="btn" style="margin-top:6px;padding:5px 8px;font-size:9px" onclick="openAttendanceDetailByUid('${esc(a.employeeUid||'')}','${esc(a.employeeId)}')">勤務日一覧</button></td>
      <td>${fmtDateTime(a.clockIn)}</td>
      <td>${fmtDateTime(a.clockOut)}</td>
      <td>${formatDuration(attendanceDuration(a))}</td>
      <td><span class="status-pill ${a.clockOut?'off':'working'}">${a.clockOut?'退勤済み':'勤務中'}</span></td>
      <td><button class="btn danger" onclick="deleteOneAttendance('${esc(a.dbId)}')">削除</button></td>
    </tr>`}).join('')}</tbody></table>`;
}
async function deleteAttendanceIds(ids,message){
  const clean=[...new Set(ids.map(String).filter(Boolean))];
  if(!clean.length)return;
  if(!confirm(message))return;
  const {error}=await sb.from('attendance_records').delete().in('id',clean);
  if(error){alert('勤務記録を削除できませんでした：'+error.message);return}
  clean.forEach(id=>selectedAttendanceIds.delete(id));
  await loadAttendanceData();
  renderAttendance();renderDashboard();renderRanking();renderEmployees();
  if(attendanceDetailEmployee)renderAttendanceDetail();
  await refreshDiscordStatusBoard(false);
  toast(`${clean.length}件の勤務記録を削除しました`);
}
async function deleteSelectedAttendance(){
  await deleteAttendanceIds([...selectedAttendanceIds],`選択した${selectedAttendanceIds.size}件の勤務記録を削除しますか？
この操作は元に戻せません。`);
}
async function deleteFilteredAttendance(){
  const list=attendanceFilteredList();
  await deleteAttendanceIds(list.map(a=>a.dbId),`現在表示中の${list.length}件を一括削除しますか？
対象日：${$('attendanceDate').value}
この操作は元に戻せません。`);
}
async function deleteOneAttendance(id){
  await deleteAttendanceIds([id],'この勤務記録を削除しますか？');
}
function openAttendanceDetail(index){
  attendanceDetailEmployee=employees[Number(index)]||null;
  if(!attendanceDetailEmployee)return;
  $('attendanceDetailMonth').value=monthKeyLocal(new Date());
  $('attendanceDetailModal').classList.remove('hidden');
  renderAttendanceDetail();
}
function openAttendanceDetailByUid(uid,employeeId){
  attendanceDetailEmployee=employees.find(e=>(uid&&e.uid===uid)||String(e.id).toLowerCase()===String(employeeId).toLowerCase())||{
    uid,name:attendanceData.find(a=>(uid&&a.employeeUid===uid)||String(a.employeeId).toLowerCase()===String(employeeId).toLowerCase())?.employeeName||employeeId,
    id:employeeId,role:''
  };
  $('attendanceDetailMonth').value=monthKeyLocal(new Date());
  $('attendanceDetailModal').classList.remove('hidden');
  renderAttendanceDetail();
}
function closeAttendanceDetail(){
  $('attendanceDetailModal').classList.add('hidden');
  attendanceDetailEmployee=null;
}
function attendanceDetailRecords(){
  if(!attendanceDetailEmployee)return[];
  const month=$('attendanceDetailMonth').value;
  return attendanceData.filter(a=>{
    const same=(attendanceDetailEmployee.uid&&a.employeeUid===attendanceDetailEmployee.uid)||String(a.employeeId).toLowerCase()===String(attendanceDetailEmployee.id).toLowerCase();
    return same&&(!month||monthKeyLocal(a.clockIn)===month);
  }).sort((a,b)=>new Date(b.clockIn)-new Date(a.clockIn));
}
function renderAttendanceDetail(){
  if(!attendanceDetailEmployee)return;
  const records=attendanceDetailRecords();
  const grouped=new Map();
  records.forEach(a=>{
    const key=dateKey(a.clockIn);
    if(!grouped.has(key))grouped.set(key,[]);
    grouped.get(key).push(a);
  });
  const total=records.reduce((s,a)=>s+attendanceDuration(a),0);
  $('attendanceDetailTitle').textContent=`${attendanceDetailEmployee.name}さんの出勤日`;
  $('attendanceDetailMeta').textContent=`${attendanceDetailEmployee.role||''} ・ ${attendanceDetailEmployee.id||'-'}`;
  $('attendanceDetailDays').textContent=`${grouped.size}日`;
  $('attendanceDetailShifts').textContent=`${records.length}回`;
  $('attendanceDetailHours').textContent=formatDuration(total);
  $('attendanceDetailList').innerHTML=grouped.size?[...grouped.entries()].map(([date,shifts])=>{
    const dayTotal=shifts.reduce((s,a)=>s+attendanceDuration(a),0);
    return `<div class="attendance-day-card"><div class="attendance-day-head"><strong>${new Date(date+'T00:00:00').toLocaleDateString('ja-JP',{year:'numeric',month:'long',day:'numeric',weekday:'short'})}</strong><span>${shifts.length}回 ・ ${formatDuration(dayTotal)}</span></div>${shifts.map(a=>`<div class="attendance-day-shift"><div><span>出勤</span><strong>${new Date(a.clockIn).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'})}</strong></div><div><span>退勤</span><strong>${a.clockOut?new Date(a.clockOut).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'}):'勤務中'}</strong></div><div><span>勤務時間</span><strong>${formatDuration(attendanceDuration(a))}</strong></div><button class="btn danger" onclick="deleteOneAttendance('${esc(a.dbId)}')">削除</button></div>`).join('')}</div>`
  }).join(''):'<div class="empty">この月の勤務記録はありません。</div>';
}
async function deleteEmployeeMonthAttendance(){
  const records=attendanceDetailRecords();
  if(!records.length){alert('削除できる勤務記録がありません。');return}
  await deleteAttendanceIds(records.map(a=>a.dbId),`${attendanceDetailEmployee.name}さんの${$('attendanceDetailMonth').value}の勤務記録 ${records.length}件を一括削除しますか？
この操作は元に戻せません。`);
}

async function refreshDiscordStatusBoard(showSuccess=false){
  try{
    const {data:{session}}=await sb.auth.getSession();
    const headers={'Content-Type':'application/json','apikey':cfg.SUPABASE_ANON_KEY};
    if(session?.access_token) headers['Authorization']=`Bearer ${session.access_token}`;
    const res=await fetch(`${cfg.SUPABASE_URL}/functions/v1/discord-staff-status`,{
      method:'POST',
      headers,
      body:'{}'
    });
    const result=await res.json().catch(()=>({}));
    if(!res.ok) throw new Error(result.error||`HTTP ${res.status}`);
    if(showSuccess) toast(`Discord更新完了：${result.staff_online??0}名勤務中`);
    return true;
  }catch(e){
    console.error('Discord Staff Status Board update failed:',e);
    if(showSuccess) alert('出退勤データは保存されていますが、Discordボード更新に失敗しました。\n'+(e.message||e));
    return false;
  }
}
async function manualDiscordSync(){
  await refreshDiscordStatusBoard(true);
}


attendanceControlMode='working';

function localDateTimeValue(date=new Date()){
  const shifted=new Date(date.getTime()-date.getTimezoneOffset()*60000);
  return shifted.toISOString().slice(0,16);
}
function activeAttendanceForEmployee(employee){
  return attendanceData.find(a=>
    !a.clockOut&&(
      (employee.uid&&a.employeeUid===employee.uid)||
      String(a.employeeId).toLowerCase()===String(employee.id).toLowerCase()
    )
  )||null;
}
function setAttendanceControlMode(mode){
  attendanceControlMode=mode;
  $('attendanceControlWorkingTab')?.classList.toggle('active',mode==='working');
  $('attendanceControlOffTab')?.classList.toggle('active',mode==='off');
  renderAttendanceControl();
}
function renderAttendanceControl(){
  const container=$('attendanceControlList');
  if(!container)return;

  const working=employees.filter(e=>activeAttendanceForEmployee(e));
  const off=employees.filter(e=>!activeAttendanceForEmployee(e));
  if($('attendanceControlWorkingCount'))$('attendanceControlWorkingCount').textContent=working.length;
  if($('attendanceControlOffCount'))$('attendanceControlOffCount').textContent=off.length;

  const list=attendanceControlMode==='working'?working:off;
  if(!list.length){
    container.innerHTML=`<div class="empty">${attendanceControlMode==='working'?'現在勤務中の従業員はいません。':'退勤中の従業員はいません。'}</div>`;
    return;
  }

  container.innerHTML=list.map(e=>{
    const active=activeAttendanceForEmployee(e);
    const stateText=active
      ?`${new Date(active.clockIn).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'})}から勤務中・${formatDuration(attendanceDuration(active))}`
      :'現在は退勤中';
    return `<article class="attendance-control-card">
      <div class="person-avatar">${esc((e.name||'?').slice(0,1))}</div>
      <div>
        <strong>${esc(e.name)}</strong>
        <small>${esc(e.role)} ・ ${esc(e.id)}<br>${esc(stateText)}</small>
      </div>
      <div class="attendance-control-actions">
        <button class="btn ${active?'danger':'primary'}" onclick="${active?`adminQuickClockOut('${esc(e.uid)}')`:`adminQuickClockIn('${esc(e.uid)}')`}">
          ${active?'今すぐ退勤':'今すぐ出勤'}
        </button>
        <button class="btn" onclick="openAdminAttendanceModal('${esc(e.uid)}','${active?'clock_out':'clock_in'}')">時刻指定</button>
      </div>
    </article>`;
  }).join('');
}
function populateAdminAttendanceEmployees(selectedUid=''){
  const select=$('adminAttendanceEmployee');
  if(!select)return;
  select.innerHTML=employees.map(e=>`<option value="${esc(e.uid)}">${esc(e.name)}（${esc(e.id)}）</option>`).join('');
  if(selectedUid)select.value=selectedUid;
}
function openAdminAttendanceModal(uid='',action=''){
  populateAdminAttendanceEmployees(uid);
  $('adminAttendanceTime').value=localDateTimeValue();
  $('adminAttendanceReason').value='';
  if(action)$('adminAttendanceAction').value=action;
  else{
    const e=employees.find(x=>x.uid===$('adminAttendanceEmployee').value);
    $('adminAttendanceAction').value=e&&activeAttendanceForEmployee(e)?'clock_out':'clock_in';
  }
  $('adminAttendanceEmployee').onchange=updateAdminAttendanceModalState;
  updateAdminAttendanceModalState();
  $('adminAttendanceModal').classList.remove('hidden');
}
function closeAdminAttendanceModal(){
  $('adminAttendanceModal').classList.add('hidden');
}
function updateAdminAttendanceModalState(){
  const employee=employees.find(e=>e.uid===$('adminAttendanceEmployee')?.value);
  if(!employee)return;
  const active=activeAttendanceForEmployee(employee);
  const action=$('adminAttendanceAction').value;
  const info=$('adminAttendanceModalInfo');

  if(action==='clock_in'){
    info.textContent=active
      ?`${employee.name}さんはすでに出勤中です。重複出勤はできません。`
      :`${employee.name}さんを指定時刻から出勤状態にします。`;
    $('adminAttendanceExecuteBtn').disabled=!!active;
  }else{
    info.textContent=active
      ?`${employee.name}さんの勤務記録を指定時刻で退勤処理します。`
      :`${employee.name}さんは現在退勤中のため、退勤処理できません。`;
    $('adminAttendanceExecuteBtn').disabled=!active;
  }
}
async function callManageAttendance(payload){
  const {data:{session},error:sessionError}=await sb.auth.getSession();
  if(sessionError)throw new Error(sessionError.message);
  if(!session)throw new Error('ログインが切れています。再ログインしてください。');

  const res=await fetch(`${cfg.SUPABASE_URL}/functions/v1/manage-attendance`,{
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'Authorization':`Bearer ${session.access_token}`,
      'apikey':cfg.SUPABASE_ANON_KEY
    },
    body:JSON.stringify(payload)
  });
  const raw=await res.text();
  let result={};
  try{result=raw?JSON.parse(raw):{}}catch{result={error:raw||'不明な応答'}}
  if(!res.ok||result.ok===false){
    throw new Error(result.error||result.details||`出退勤操作に失敗しました（HTTP ${res.status}）`);
  }
  return result;
}
async function refreshAfterAdminAttendance(message){
  await Promise.all([loadAttendanceData(),loadEmployees()]);
  renderAttendance();
  renderAttendanceControl();
  renderDashboard();
  renderRanking();
  renderEmployees();
  await refreshDiscordStatusBoard(false);
  toast(message);
}
async function adminQuickClockIn(uid){
  const employee=employees.find(e=>e.uid===uid);
  if(!employee)return;
  if(!confirm(`${employee.name}さんを今すぐ出勤させますか？`))return;
  try{
    await callManageAttendance({
      action:'clock_in',
      employee_uid:employee.uid,
      occurred_at:new Date().toISOString(),
      reason:'管理者によるクイック出勤'
    });
    await refreshAfterAdminAttendance(`${employee.name}さんを出勤させました`);
  }catch(error){
    alert('出勤操作に失敗しました。\n'+(error.message||error));
  }
}
async function adminQuickClockOut(uid){
  const employee=employees.find(e=>e.uid===uid);
  if(!employee)return;
  if(!confirm(`${employee.name}さんを今すぐ退勤させますか？`))return;
  try{
    await callManageAttendance({
      action:'clock_out',
      employee_uid:employee.uid,
      occurred_at:new Date().toISOString(),
      reason:'管理者によるクイック退勤'
    });
    await refreshAfterAdminAttendance(`${employee.name}さんを退勤させました`);
  }catch(error){
    alert('退勤操作に失敗しました。\n'+(error.message||error));
  }
}
async function executeAdminAttendanceModal(){
  const uid=$('adminAttendanceEmployee').value;
  const employee=employees.find(e=>e.uid===uid);
  const action=$('adminAttendanceAction').value;
  const rawTime=$('adminAttendanceTime').value;
  const reason=$('adminAttendanceReason').value.trim();
  if(!employee)return alert('従業員を選択してください。');
  if(!rawTime)return alert('操作時刻を入力してください。');

  const occurred=new Date(rawTime);
  if(Number.isNaN(occurred.getTime()))return alert('正しい日時を入力してください。');
  if(occurred.getTime()>Date.now()+60000)return alert('未来の時刻では操作できません。');

  const label=action==='clock_in'?'出勤':'退勤';
  if(!confirm(`${employee.name}さんを\n${occurred.toLocaleString('ja-JP')}\nで${label}処理しますか？`))return;

  const btn=$('adminAttendanceExecuteBtn');
  btn.disabled=true;
  try{
    await callManageAttendance({
      action,
      employee_uid:employee.uid,
      occurred_at:occurred.toISOString(),
      reason:reason||`管理者による時刻指定${label}`
    });
    closeAdminAttendanceModal();
    await refreshAfterAdminAttendance(`${employee.name}さんを${label}処理しました`);
  }catch(error){
    alert(`${label}操作に失敗しました。\n`+(error.message||error));
  }finally{
    btn.disabled=false;
  }
}

async function clockIn(){
  if(!currentEmployee?.uid)return;
  try{
    await loadMyAttendance();
    const active=myAttendance.find(a=>!a.clockOut);
    if(active){alert('すでに出勤中です。');renderEmployeeAttendance();return}

    const payload={
      employee_uid:currentEmployee.uid,
      employee_id:currentEmployee.id,
      employee_name:currentEmployee.name,
      clock_in:new Date().toISOString()
    };

    const {error}=await sb.from('attendance_records').insert(payload);
    if(error) throw error;

    await Promise.all([loadMyAttendance(),loadAttendanceData()]);
    renderEmployeeAttendance();
    renderEmployeeDashboard();
    renderEmployeeRanking();
    toast('出勤しました');
    await refreshDiscordStatusBoard(false);
  }catch(error){
    console.error('出勤登録エラー:',error,JSON.stringify(error));
    alert('出勤登録に失敗しました：'+(error.message||error));
  }
}
async function clockOut(){
  if(!currentEmployee?.uid)return;
  try{
    await loadMyAttendance();
    const active=myAttendance.find(a=>!a.clockOut);
    if(!active){alert('出勤中の記録がありません。');renderEmployeeAttendance();return}
    if(!confirm('退勤しますか？'))return;

    const {data,error}=await sb
      .from('attendance_records')
      .update({clock_out:new Date().toISOString()})
      .eq('id',active.dbId)
      .eq('employee_uid',currentEmployee.uid)
      .is('clock_out',null)
      .select('id');

    if(error) throw error;
    if(!data?.length) throw new Error('対象の勤務記録を更新できませんでした。画面を更新して再度お試しください。');

    await Promise.all([loadMyAttendance(),loadAttendanceData()]);
    renderEmployeeAttendance();
    renderEmployeeDashboard();
    renderEmployeeRanking();
    toast('退勤しました');
    await refreshDiscordStatusBoard(false);
  }catch(error){
    console.error('退勤登録エラー:',error,JSON.stringify(error));
    alert('退勤登録に失敗しました：'+(error.message||error));
  }
}
function renderEmployeeAttendance(){
  if(!$('employeeAttendanceHistory'))return;
  const active=myAttendance.find(a=>!a.clockOut),pill=$('employeeStatusPill');
  pill.textContent=active?'勤務中':'退勤中';pill.className=`status-pill ${active?'working':'off'}`;
  $('clockInBtn').disabled=!!active;$('clockOutBtn').disabled=!active;
  if($('employeeStatusPill2')){$('employeeStatusPill2').textContent=active?'勤務中':'退勤中';$('employeeStatusPill2').className=`status-pill ${active?'working':'off'}`}
  if($('clockInBtn2'))$('clockInBtn2').disabled=!!active;if($('clockOutBtn2'))$('clockOutBtn2').disabled=!active;
  $('employeeAttendanceMessage').textContent=active?`${fmtDateTime(active.clockIn)}から勤務中です`:'出勤すると勤務時間の記録が始まります';
  if($('employeeAttendanceMessage2'))$('employeeAttendanceMessage2').textContent=$('employeeAttendanceMessage').textContent;
  renderEmployeeDashboard();
  const list=myAttendance.slice(0,12);$('employeeAttendanceHistory').innerHTML=list.length?list.map(a=>`<div class="employee-history-row"><div><strong>${new Date(a.clockIn).toLocaleDateString('ja-JP')} ・ ${a.clockOut?'退勤済み':'勤務中'}</strong><span>${new Date(a.clockIn).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'})} ～ ${a.clockOut?new Date(a.clockOut).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'}):'現在'}</span></div><div class="duration">${formatDuration(attendanceDuration(a))}</div></div>`).join(''):'<div class="empty">勤務履歴はまだありません。</div>';
}
function exportAttendanceCsv(){
  const selected=$('attendanceDate').value||iso(new Date()),list=attendanceData.filter(a=>dateKey(a.clockIn)===selected),rows=[['従業員名','従業員番号','出勤','退勤','勤務時間'],...list.map(a=>[a.employeeName,a.employeeId,fmtDateTime(a.clockIn),fmtDateTime(a.clockOut),formatDuration(attendanceDuration(a))])];
  const csv='\ufeff'+rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\r\n'),blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`attendance_${selected}.csv`;a.click();URL.revokeObjectURL(a.href)
}
function updateClocks(){const now=new Date().toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit',second:'2-digit'});if($('adminNowClock'))$('adminNowClock').textContent=now;if($('employeeNowClock'))$('employeeNowClock').textContent=now;if($('employeeNowClock2'))$('employeeNowClock2').textContent=now;if(!$('employeeApp').classList.contains('hidden')&&myAttendance.some(a=>!a.clockOut))renderEmployeeAttendance()}

async function downloadViewedSlip(){const c=await html2canvas($('viewedSheet'),{scale:2,backgroundColor:'#171210'}),a=document.createElement('a');a.download=`${settings.shop}_${currentViewedSlip.slipNo}.png`;a.href=c.toDataURL('image/png');a.click()}



function toggleV4Sidebar(){if(window.matchMedia('(max-width:760px)').matches){openMobileMenu('admin');return}document.getElementById('v4Sidebar')?.classList.toggle('open')}
function v4MonthlyRanking(){
  const now=new Date(),key=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const grouped=new Map();
  attendanceData.filter(a=>monthKeyLocal(a.clockIn)===key).forEach(a=>{
    const id=a.employeeUid||a.employeeId,c=grouped.get(id)||{name:a.employeeName,ms:0,shifts:0};
    c.ms+=attendanceDuration(a);c.shifts++;grouped.set(id,c)
  });
  return [...grouped.values()].sort((a,b)=>b.ms-a.ms).slice(0,3)
}
function renderV4Extras(){
  const active=attendanceData.filter(a=>!a.clockOut),ranking=v4MonthlyRanking();
  if($('v4TopWorking'))$('v4TopWorking').textContent=`${active.length}名`;
  if($('v4AttendanceRate'))$('v4AttendanceRate').textContent=`登録スタッフ ${employees.length}名`;
  const open=active.length>0;
  ['v4OpenStatus','v4FooterStatus'].forEach(id=>{if($(id)){$(id).textContent=open?'● OPEN':'● CLOSED';$(id).style.color=open?'#238642':'#b84242'}});
  if($('v4Greeting')){const h=new Date().getHours();$('v4Greeting').textContent=h<11?'おはようございます':h<18?'こんにちは':'こんばんは'}
  if($('v4LastUpdated'))$('v4LastUpdated').textContent=new Date().toLocaleString('ja-JP',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
  if($('v4RankingPreview')){
    const ordered=[ranking[1],ranking[0],ranking[2]],cls=['second','first','third'],place=[2,1,3];
    $('v4RankingPreview').innerHTML=ordered.map((r,i)=>r?`<div class="v4-rank-card ${cls[i]}">${rankingAvatar(r,'v4-rank-avatar')}<strong>${esc(rankingDisplayName(r))}</strong><span>${place[i]}位</span><span class="v4-rank-hours">${formatDuration(r.ms)}</span></div>`:'<div></div>').join('')||'<div class="empty">勤務記録はありません。</div>'
  }
  
  if($('v43SalesPreview')){
    const month=monthKeyLocal(new Date()),rows=salesRankingRows(month).filter(r=>r.amount>0).slice(0,5);
    $('v43SalesPreview').innerHTML=rows.length?rows.map((r,i)=>`<div class="working-person">${rankingAvatar(r,'person-avatar')}<div><strong>${i+1}位・${esc(rankingDisplayName(r))}</strong><span>${r.entries}件の売上入力</span></div><div class="duration">${yen.format(r.amount)}</div></div>`).join(''):'<div class="empty">今月の売上記録はありません。</div>';
  }

  if($('v4InventoryPreview')){
    const liveItems=(typeof inventorySnapshot!=='undefined'&&Array.isArray(inventorySnapshot)&&inventorySnapshot.length)?inventorySnapshot:inventoryFallback;
    const data=(liveItems||[]).slice(0,6);
    $('v4InventoryPreview').innerHTML=data.length?data.map(x=>inventoryPreviewMarkup(x)).join(''):'<div class="empty">在庫データがありません。</div>'
  }
}

const INVENTORY_SHEET_URL='https://docs.google.com/spreadsheets/d/1hPPZUUYLy9PnZRhjNXEMbDWB9x2M8549u1TtO_IG6ls/edit?gid=0#gid=0';
const inventoryFallback=[
{name:'牛乳',min:4000,stock:4103,status:'最低数量間近'},
{name:'小麦粉',min:2000,stock:2963,status:''},
{name:'いちご',min:3000,stock:3180,status:'最低数量間近'},
{name:'桃',min:2000,stock:3205,status:''},
{name:'ブルーベリー',min:3000,stock:268,status:'在庫注意'},
{name:'オレンジ',min:2000,stock:1325,status:'在庫注意'},
{name:'マンゴー',min:2000,stock:997,status:'在庫注意'},
{name:'チェリー',min:2000,stock:922,status:'在庫注意'},
{name:'アルコール',min:1000,stock:5081,status:''}
];

function toggleTheme(){
  const dark=!document.body.classList.contains('dark');
  document.body.classList.toggle('dark',dark);
  localStorage.setItem('ld_theme',dark?'dark':'light');
  document.querySelectorAll('.theme-toggle').forEach(b=>b.textContent=dark?'☀️':'🌙');
  updateMobileThemeButtons();
}
function initTheme(){
  const saved=localStorage.getItem('ld_theme');
  const dark=saved==='dark'||(!saved&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.body.classList.toggle('dark',dark);
  document.querySelectorAll('.theme-toggle').forEach(b=>b.textContent=dark?'☀️':'🌙');
  updateMobileThemeButtons();
}
function monthKeyLocal(v){const d=new Date(v);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}
function rankingEmployee(row){
  return employees.find(e=>(row?.uid&&e.uid===row.uid)||(row?.id&&String(e.id).toLowerCase()===String(row.id).toLowerCase())||(row?.name&&e.name===row.name))||null;
}
function rankingAvatar(row,className='ranking-avatar'){
  const employee=rankingEmployee(row),url=employee?.avatarUrl||row?.avatarUrl||'',name=employee?.name||row?.name||'従';
  return url?`<div class="${className}"><img src="${esc(url)}" alt="${esc(name)}" loading="lazy"></div>`:`<div class="${className}">${esc(name.slice(0,1))}</div>`;
}
function rankingDisplayName(row){const employee=rankingEmployee(row);return employee?.name||row?.name||'スタッフ'}
function rankingRows(){
  const month=$('rankingMonth')?.value||monthKeyLocal(new Date());
  const grouped=new Map();
  attendanceData.filter(a=>monthKeyLocal(a.clockIn)===month).forEach(a=>{
    const key=a.employeeUid||a.employeeId;
    const current=grouped.get(key)||{uid:a.employeeUid,id:a.employeeId,name:a.employeeName,ms:0,shifts:0};
    current.ms+=attendanceDuration(a);current.shifts+=1;grouped.set(key,current);
  });
  employees.forEach(e=>{if(!grouped.has(e.uid))grouped.set(e.uid,{uid:e.uid,id:e.id,name:e.name,ms:0,shifts:0})});
  return [...grouped.values()].sort((a,b)=>b.ms-a.ms||b.shifts-a.shifts||a.name.localeCompare(b.name,'ja'));
}

function renderRankingFarmPeriodOptions(){
  const select=$('rankingFarmPeriod');if(!select)return;
  select.innerHTML=(farmPeriods||[]).map(p=>`<option value="${p.id}" ${String(p.id)===String(currentFarmPeriod)?'selected':''}>${esc(p.label)}</option>`).join('')||'<option value="">期間なし</option>';
}
function renderEmployeeRankingFarmPeriodOptions(){
  const select=$('employeeRankingFarmPeriod');if(!select)return;
  select.innerHTML=(farmPeriods||[]).map(p=>`<option value="${p.id}" ${String(p.id)===String(currentFarmPeriod)?'selected':''}>${esc(p.label)}</option>`).join('')||'<option value="">期間なし</option>';
}
async function changeRankingFarmPeriod(value){
  currentFarmPeriod=value||null;
  await loadFarmData(false);
  renderRankingFarmPeriodOptions();
  renderEmployeeRankingFarmPeriodOptions();
  renderRanking();
}
async function changeEmployeeRankingFarmPeriod(value){
  currentFarmPeriod=value||null;
  await loadFarmData(false);
  renderRankingFarmPeriodOptions();
  renderEmployeeRankingFarmPeriodOptions();
  renderEmployeeRanking();
}
function integratedFarmRankingRows(){
  return [...(farmData?.staff||[])].sort((a,b)=>farmN(b.total)-farmN(a.total)||farmN(b.assessment)-farmN(a.assessment)||String(a.name).localeCompare(String(b.name),'ja'));
}
function farmRankingPodiumHtml(rows,emptyText){
  const top=rows.slice(0,3),order=[top[1],top[0],top[2]],classes=['second','first','third'],places=[2,1,3];
  return order.map((r,i)=>r?`<div class="podium-item ${classes[i]}">${rankingAvatar(r,'podium-avatar')}<div class="podium-name">${esc(rankingDisplayName(r))}</div><div class="podium-hours">${farmN(r.total).toLocaleString('ja-JP')}個</div><div class="podium-block">${places[i]}位</div></div>`:'').join('')||`<div class="empty">${emptyText}</div>`;
}
function farmRankingListHtml(rows,currentUid='',currentId='',currentName=''){
  const mineIndex=rows.findIndex(r=>
    (r.uid&&r.uid===currentUid)||
    (r.id&&String(r.id).toLowerCase()===String(currentId).toLowerCase())||
    (!r.uid&&!r.id&&currentName&&r.name===currentName)
  );
  return {
    mineIndex,
    html:rows.length?rows.map((r,i)=>`<div class="ranking-row ${mineIndex===i?'my-ranking-row':''}"><div class="ranking-position">${i+1}</div>${rankingAvatar(r)}<div class="ranking-person"><strong>${esc(rankingDisplayName(r))}${mineIndex===i?'（あなた）':''}</strong><span>査定 ${farmN(r.assessment).toLocaleString('ja-JP',{maximumFractionDigits:4})}</span></div><div class="ranking-hours">${farmN(r.total).toLocaleString('ja-JP')}個</div><div class="ranking-shifts">${yen.format(farmN(r.payment))}</div></div>`).join(''):'<div class="empty">Farmランキングデータがありません。</div>'
  };
}

function renderRanking(){
  if(!$('rankingList'))return;
  if(!$('rankingMonth').value)$('rankingMonth').value=monthKeyLocal(new Date());
  const month=$('rankingMonth').value;
  if(rankingMode==='farm'){
    const rows=integratedFarmRankingRows();
    const total=rows.reduce((s,r)=>s+farmN(r.total),0);
    const assessment=rows.reduce((s,r)=>s+farmN(r.assessment),0);
    $('rankingPageTitle').textContent='Farmランキング';
    $('rankingPageDescription').textContent='選択期間の承認済みFarm採取数・査定・仕入れ金額を集計します。';
    $('rankTotalHours').textContent=`${total.toLocaleString('ja-JP')}個`;
    $('rankTotalShifts').textContent=assessment.toLocaleString('ja-JP',{maximumFractionDigits:4});
    $('rankTopStaff').textContent=rows[0]?rankingDisplayName(rows[0]):'-';
    document.querySelector('#rankTotalHours')?.previousElementSibling&&(document.querySelector('#rankTotalHours').previousElementSibling.textContent='TOTAL FARM');
    document.querySelector('#rankTotalShifts')?.previousElementSibling&&(document.querySelector('#rankTotalShifts').previousElementSibling.textContent='TOTAL ASSESSMENT');
    $('rankingPodium').innerHTML=farmRankingPodiumHtml(rows,'この期間のFarm記録はありません。');
    $('rankingList').innerHTML=farmRankingListHtml(rows).html;
  }else if(rankingMode==='sales'){
    const rows=salesRankingRows(month),total=rows.reduce((s,r)=>s+r.amount,0),entries=rows.reduce((s,r)=>s+r.entries,0);
    $('rankingPageTitle').textContent='売上ランキング';
    $('rankingPageDescription').textContent='月ごとのスタッフ別売上を自動集計します。';
    $('rankTotalHours').textContent=yen.format(total);
    $('rankTotalShifts').textContent=`${entries}件`;
    $('rankTopStaff').textContent=rows[0]?.amount?rankingDisplayName(rows[0]):'-';
    document.querySelector('#rankTotalHours')?.previousElementSibling&&(document.querySelector('#rankTotalHours').previousElementSibling.textContent='TOTAL SALES');
    document.querySelector('#rankTotalShifts')?.previousElementSibling&&(document.querySelector('#rankTotalShifts').previousElementSibling.textContent='SALES ENTRIES');
    const top=rows.slice(0,3),order=[top[1],top[0],top[2]],classes=['second','first','third'],places=[2,1,3];
    $('rankingPodium').innerHTML=order.map((r,i)=>r?`<div class="podium-item ${classes[i]}">${rankingAvatar(r,'podium-avatar')}<div class="podium-name">${esc(rankingDisplayName(r))}</div><div class="podium-hours">${yen.format(r.amount)}</div><div class="podium-block">${places[i]}位</div></div>`:'').join('')||'<div class="empty">この月の売上記録はありません。</div>';
    $('rankingList').innerHTML=rows.length?rows.map((r,i)=>`<div class="ranking-row"><div class="ranking-position">${i+1}</div>${rankingAvatar(r)}<div class="ranking-person"><strong>${esc(rankingDisplayName(r))}</strong><span>${esc(r.id||'-')}</span></div><div class="ranking-hours">${yen.format(r.amount)}</div><div class="ranking-shifts">${r.entries}件</div></div>`).join(''):'<div class="empty">売上記録はありません。</div>';
  }else{
    const rows=rankingRows(),total=rows.reduce((s,r)=>s+r.ms,0),shifts=rows.reduce((s,r)=>s+r.shifts,0);
    $('rankingPageTitle').textContent='勤務時間ランキング';
    $('rankingPageDescription').textContent='月ごとの勤務時間と出勤回数を自動集計します。';
    $('rankTotalHours').textContent=formatDuration(total);$('rankTotalShifts').textContent=`${shifts}回`;$('rankTopStaff').textContent=rows[0]?.ms?rankingDisplayName(rows[0]):'-';
    document.querySelector('#rankTotalHours')?.previousElementSibling&&(document.querySelector('#rankTotalHours').previousElementSibling.textContent='TOTAL HOURS');
    document.querySelector('#rankTotalShifts')?.previousElementSibling&&(document.querySelector('#rankTotalShifts').previousElementSibling.textContent='TOTAL SHIFTS');
    const top=rows.slice(0,3),order=[top[1],top[0],top[2]],classes=['second','first','third'],places=[2,1,3];
    $('rankingPodium').innerHTML=order.map((r,i)=>r?`<div class="podium-item ${classes[i]}">${rankingAvatar(r,'podium-avatar')}<div class="podium-name">${esc(rankingDisplayName(r))}</div><div class="podium-hours">${formatDuration(r.ms)}</div><div class="podium-block">${places[i]}位</div></div>`:'').join('')||'<div class="empty">この月の勤務記録はありません。</div>';
    $('rankingList').innerHTML=rows.length?rows.map((r,i)=>`<div class="ranking-row"><div class="ranking-position">${i+1}</div>${rankingAvatar(r)}<div class="ranking-person"><strong>${esc(rankingDisplayName(r))}</strong><span>${esc(r.id||'-')}</span></div><div class="ranking-hours">${formatDuration(r.ms)}</div><div class="ranking-shifts">${r.shifts}回</div></div>`).join(''):'<div class="empty">勤務記録はありません。</div>';
  }
}
function exportRankingCsv(){
  let rows,table,filename;
  if(rankingMode==='farm'){
    rows=integratedFarmRankingRows();
    const label=farmPeriods.find(p=>String(p.id)===String(currentFarmPeriod))?.label||'Farm';
    table=[['順位','従業員名','採取数','査定','仕入れ金額'],...rows.map((r,i)=>[i+1,rankingDisplayName(r),farmN(r.total),farmN(r.assessment),farmN(r.payment)])];
    filename=`Farmランキング_${label}.csv`;
  }else if(rankingMode==='sales'){
    const month=$('rankingMonth').value;
    rows=salesRankingRows(month);
    table=[['順位','従業員名','従業員番号','売上金額','件数'],...rows.map((r,i)=>[i+1,rankingDisplayName(r),r.id,r.amount,r.entries])];
    filename=`売上ランキング_${month}.csv`;
  }else{
    const month=$('rankingMonth').value;
    rows=rankingRows();
    table=[['順位','従業員名','従業員番号','勤務時間(分)','出勤回数'],...rows.map((r,i)=>[i+1,r.name,r.id,Math.floor(r.ms/60000),r.shifts])];
    filename=`勤務時間ランキング_${month}.csv`;
  }
  const csv='\ufeff'+table.map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\r\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename;a.click();URL.revokeObjectURL(a.href)
}
function parseCsv(text){
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){const c=text[i],n=text[i+1];if(c==='"'&&quoted&&n==='"'){cell+='"';i++}else if(c==='"'){quoted=!quoted}else if(c===','&&!quoted){row.push(cell);cell=''}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&n==='\n')i++;row.push(cell);if(row.some(x=>x!==''))rows.push(row);row=[];cell=''}else cell+=c}
  row.push(cell);if(row.some(x=>x!==''))rows.push(row);return rows
}

function renderInventoryAlerts(items){
  const panel=$('inventoryAlertPanel'),list=$('inventoryAlertList'),count=$('inventoryAlertCount');
  if(!panel||!list||!count)return;
  const low=(items||[]).filter(x=>{
    const stock=Number(x.stock||0),min=Number(x.min||0);
    return stock<min||Boolean(x.status);
  }).sort((a,b)=>{
    const ar=Number(a.min||0)?Number(a.stock||0)/Number(a.min):999;
    const br=Number(b.min||0)?Number(b.stock||0)/Number(b.min):999;
    return ar-br;
  });
  count.textContent=String(low.length);
  panel.classList.toggle('ok',low.length===0);
  if(!low.length){
    list.className='inventory-alert-empty';
    list.innerHTML='現在、最低在庫を下回っている材料はありません。';
    return;
  }
  list.className='inventory-alert-list';
  list.innerHTML=low.map(x=>{
    const stock=Number(x.stock||0),min=Number(x.min||0);
    const shortage=Math.max(0,min-stock);
    return `<div class="inventory-alert-item">
      <div class="inventory-alert-main"><i></i><div><strong>${esc(x.name)}</strong><span>現在 ${stock.toLocaleString('ja-JP')} / 最低 ${min.toLocaleString('ja-JP')}</span></div></div>
      <span class="inventory-shortage-badge">不足 ${shortage.toLocaleString('ja-JP')}</span>
    </div>`;
  }).join('');
}



const INVENTORY_IMAGE_DATA={
  'alcohol':'data:image/webp;base64,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',
  'blueberry':'data:image/webp;base64,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',
  'butter':'data:image/webp;base64,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',
  'cherry':'data:image/webp;base64,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',
  'coffee':'data:image/webp;base64,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',
  'cream':'data:image/webp;base64,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',
  'default':'data:image/webp;base64,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',
  'egg':'data:image/webp;base64,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',
  'flour':'data:image/webp;base64,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',
  'mango':'data:image/webp;base64,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',
  'milk':'data:image/webp;base64,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',
  'orange':'data:image/webp;base64,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',
  'peach':'data:image/webp;base64,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',
  'strawberry':'data:image/webp;base64,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'
};
function inventoryKind(name){
  const n=String(name||'');
  if(/牛乳|ミルク/.test(n))return 'milk';
  if(/小麦|粉|砂糖/.test(n))return 'flour';
  if(/いちご|苺/.test(n))return 'strawberry';
  if(/ブルーベリー/.test(n))return 'blueberry';
  if(/桃|ピーチ/.test(n))return 'peach';
  if(/オレンジ|みかん/.test(n))return 'orange';
  if(/マンゴー/.test(n))return 'mango';
  if(/コーヒー|豆/.test(n))return 'coffee';
  if(/卵|たまご/.test(n))return 'egg';
  if(/バター/.test(n))return 'butter';
  if(/クリーム/.test(n))return 'cream';
  if(/チェリー|さくらんぼ/.test(n))return 'cherry';
  if(/アルコール|酒|お酒/.test(n))return 'alcohol';
  return 'default';
}
function inventoryVisual(name){
  const n=String(name||'');
  const kind=inventoryKind(n);
  const units={milk:'個',flour:'個',strawberry:'個',blueberry:'個',peach:'個',orange:'個',mango:'個',coffee:'個',egg:'個',butter:'個',cream:'個',cherry:'個',alcohol:'個',default:'個'};
  return {image:INVENTORY_IMAGE_DATA[kind]||INVENTORY_IMAGE_DATA.default,unit:units[kind]||''};
}
function inventoryPreviewMarkup(x){


  const visual=inventoryVisual(x.name);
  const isLow=Number(x.stock)<Number(x.min)||x.status;
  return `<div class="v4-stock ${isLow?'low':''}">
    <div class="v4-stock-head">
      <div class="v4-stock-thumb"><img src="${visual.image}" alt="${esc(x.name)}" loading="lazy" onerror="this.onerror=null;this.src=INVENTORY_IMAGE_DATA.default"></div>
      <div class="v4-stock-copy"><strong>${esc(x.name)}</strong><span>最低 ${Number(x.min||0).toLocaleString('ja-JP')} 個</span><b>${Number(x.stock||0).toLocaleString('ja-JP')} ${visual.unit||''}</b></div>
    </div>
  </div>`;
}
function inventoryGridCardMarkup(x){
  const ratio=x.min?Math.round(x.stock/x.min*100):100;
  const isLow=x.stock<x.min||x.status;
  const isCritical=x.min&&Number(x.stock)<Number(x.min)*0.5;
  const visual=inventoryVisual(x.name);
  const safeRatio=Math.min(100,Math.max(3,ratio));
  return `<div class="inventory-card ${isLow?'low':''} ${isCritical?'critical':''}">
      <div class="inventory-product-visual"><img src="${visual.image}" alt="${esc(x.name)}" loading="lazy" onerror="this.onerror=null;this.src=INVENTORY_IMAGE_DATA.default"></div>
      <div class="inventory-card-content">
        <div class="inventory-card-head"><h3>${esc(x.name)}</h3><span class="stock-pill ${isLow?'low':''} ${isCritical?'critical':''}">${isCritical?'緊急補充':esc(x.status||'在庫OK')}</span></div>
        <div class="stock-value">${Number(x.stock).toLocaleString('ja-JP')} <small>${visual.unit}</small></div>
        <div class="stock-meta"><span>最低 ${Number(x.min).toLocaleString('ja-JP')} 個</span><strong>${ratio}%</strong></div>
        <div class="stock-bar"><span style="width:${safeRatio}%"></span></div>
      </div>
    </div>`;
}
function renderInventory(items){
  const low=items.filter(x=>x.stock<x.min||x.status).length;
  $('inventoryItems').textContent=items.length;
  $('inventoryLow').textContent=low;
  $('inventoryUpdated').textContent=new Date().toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'});
  renderInventoryAlerts(items);
  $('inventoryGrid').innerHTML=items.map(x=>inventoryGridCardMarkup(x)).join('');
}


function setEmployeeInventorySyncStatus(state,text){
  const dot=$('employeeInventorySyncDot');
  const label=$('employeeInventorySyncStatus');
  const button=$('employeeInventorySyncButton');

  if(dot)dot.className=state||'';
  if(label)label.textContent=text;
  if(button)button.disabled=state==='syncing';
}

async function syncEmployeeInventoryFromGoogleSheet(show=true){
  await Promise.all([loadInventorySnapshot(show),loadInventoryRequests(false)]);
  setEmployeeInventorySyncStatus('ok','サイト内データベース更新済み');
}

function setInventorySyncStatus(state,text){
  const dot=$('inventorySyncDot'),label=$('inventorySyncStatus'),button=$('inventorySyncButton');
  if(dot)dot.className=state||'';
  if(label)label.textContent=text;
  if(button)button.disabled=state==='syncing';
}
async function syncInventoryFromGoogleSheet(show=true){
  await Promise.all([loadInventorySnapshot(show),loadInventoryRequests(false)]);
  setInventorySyncStatus('ok','サイト内データベース更新済み');
}

async function loadInventorySnapshot(show=false){
  try{
    const {data,error}=await sb.from('inventory_items')
      .select('id,name,min_stock,stock,status,sort_order,updated_at')
      .order('sort_order')
      .order('name');
    if(error)throw error;
    inventorySnapshot=(data||[]).map(x=>({
      id:x.id,
      name:x.name,
      min:Number(x.min_stock)||0,
      stock:Number(x.stock)||0,
      status:x.status||'',
      sort_order:Number(x.sort_order)||0
    }));
    if(!inventorySnapshot.length)inventorySnapshot=inventoryFallback.map(x=>({...x}));
    renderInventory(inventorySnapshot);
    renderEmployeeInventory(inventorySnapshot);
    renderDashboard();
    const last=data?.[0]?.updated_at?new Date(data[0].updated_at):new Date();
    const label=last.toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'});
    if($('inventoryUpdated'))$('inventoryUpdated').textContent=label;
    if($('employeeInventoryUpdated'))$('employeeInventoryUpdated').textContent=label;
    if(show)toast('在庫表示を更新しました');
  }catch(err){
    console.error('Inventory load error',err);
    inventorySnapshot=inventoryFallback.map(x=>({...x}));
    renderInventory(inventorySnapshot);
    renderEmployeeInventory(inventorySnapshot);
    renderDashboard();
    if(show)alert('在庫を読み込めませんでした。\nVer.13.7のSQLを実行してください。\n'+(err.message||err));
  }
}

const INVENTORY_DISCORD_MESSAGE_KEY='lait_divin_inventory_discord_message';
const INVENTORY_SITE_NOTICE_KEY='lait_divin_inventory_site_notice';
inventoryDiscordMessageId=localStorage.getItem(INVENTORY_DISCORD_MESSAGE_KEY)||'';
inventorySiteNoticeId=localStorage.getItem(INVENTORY_SITE_NOTICE_KEY)||'';

function getInventoryDiscordLowItems(){
  return (inventorySnapshot||[]).filter(x=>{
    const stock=Number(x.stock||0),min=Number(x.min||0);
    return stock<min||Boolean(x.status);
  }).sort((a,b)=>{
    const ar=Number(a.min||0)?Number(a.stock||0)/Number(a.min):999;
    const br=Number(b.min||0)?Number(b.stock||0)/Number(b.min):999;
    return ar-br;
  });
}

function inventoryDiscordPayload(action,messageId=''){
  const low=getInventoryDiscordLowItems();
  const comment=$('inventoryDiscordComment')?.value.trim()||'';
  return {
    action,
    message_id:messageId,
    sent_at:new Date().toISOString(),
    sent_by:currentEmployee?.name||currentProfile?.display_name||currentProfile?.employee_name||'管理者',
    admin_comment:comment,
    item_count:low.length,
    items:low.map(x=>({
      name:String(x.name||'材料'),
      stock:Number(x.stock||0),
      min:Number(x.min||0),
      shortage:Math.max(0,Number(x.min||0)-Number(x.stock||0)),
      critical:Number(x.min||0)>0&&Number(x.stock||0)<Number(x.min||0)*0.5
    }))
  };
}

function buildInventorySiteNoticeBody(){
  const low=getInventoryDiscordLowItems();
  const comment=$('inventoryDiscordComment')?.value.trim()||'';
  const lines=[];
  if(comment)lines.push(comment);
  if(low.length){
    if(comment)lines.push('');
    lines.push('【在庫状況】');
    low.forEach(x=>lines.push(`・${x.name}：現在 ${Number(x.stock).toLocaleString('ja-JP')} / 最低 ${Number(x.min).toLocaleString('ja-JP')}`));
  }else{
    if(comment)lines.push('');
    lines.push('現在、最低在庫を下回っている材料はありません。');
  }
  return lines.join('\n');
}

function renderInventorySiteNoticePreview(body=''){
  const box=$('inventorySiteNoticePreview'),textEl=$('inventorySiteNoticeText');
  if(!box||!textEl)return;
  box.classList.toggle('hidden',!body);
  textEl.textContent=body;
}

function updateInventoryDiscordManager(){
  const hasMessage=Boolean(inventoryDiscordMessageId);
  const state=$('inventoryDiscordMessageState');
  if(state){
    state.textContent=hasMessage?'Discord＋サイト掲載中':'未送信';
    state.classList.toggle('sent',hasMessage);
  }
  if($('inventoryDiscordEditButton'))$('inventoryDiscordEditButton').disabled=!hasMessage;
  if($('inventoryDiscordDeleteButton'))$('inventoryDiscordDeleteButton').disabled=!hasMessage;
}

function clearInventoryDiscordComment(){
  if($('inventoryDiscordComment'))$('inventoryDiscordComment').value='';
  $('inventoryDiscordComment')?.focus();
}

async function callInventoryDiscordFunction(payload){
  const url=`${cfg.SUPABASE_URL}/functions/v1/inventory-alert-discord`;
  let lastError=null;
  for(let attempt=1;attempt<=3;attempt++){
    try{
      const response=await fetch(url,{
        method:'POST',
        headers:{'Content-Type':'text/plain;charset=UTF-8'},
        body:JSON.stringify(payload)
      });
      const data=await response.json().catch(()=>({}));
      if(response.ok&&data?.ok)return data;
      const message=data?.error||data?.message||`HTTP ${response.status}`;
      if(![502,503,504].includes(response.status))throw new Error(message);
      lastError=new Error(`Discord送信サーバーが一時的に応答していません（HTTP ${response.status}）`);
    }catch(error){
      lastError=error;
      if(attempt===3)break;
    }
    await new Promise(resolve=>setTimeout(resolve,attempt*1200));
  }
  throw lastError||new Error('Discord送信に失敗しました。');
}

async function createInventorySiteNotice(discordMessageId=""){
  const body=buildInventorySiteNoticeBody();
  const payload={
    title:'在庫管理からのお知らせ',body,type:'general',is_pinned:true,
    created_by:currentProfile?.id||null,
    created_by_name:currentProfile?.display_name||currentProfile?.employee_name||currentEmployee?.name||'管理者',
    discord_message_id:discordMessageId||null,
    discord_kind:'inventory'
  };
  const {data,error}=await sb.from('notifications').insert(payload).select().single();
  if(error)throw error;
  inventorySiteNoticeId=String(data.id||'');
  if(inventorySiteNoticeId)localStorage.setItem(INVENTORY_SITE_NOTICE_KEY,inventorySiteNoticeId);
  renderInventorySiteNoticePreview(body);
  await loadNotifications(false).catch(()=>{});
  return data;
}

async function updateInventorySiteNotice(){
  const body=buildInventorySiteNoticeBody();
  if(!inventorySiteNoticeId)return createInventorySiteNotice();
  const {error}=await sb.from('notifications').update({body,is_pinned:true}).eq('id',inventorySiteNoticeId);
  if(error)throw error;
  renderInventorySiteNoticePreview(body);
  await loadNotifications(false).catch(()=>{});
}

async function deleteInventorySiteNotice(){
  if(inventorySiteNoticeId){
    const {error}=await sb.from('notifications').delete().eq('id',inventorySiteNoticeId);
    if(error)throw error;
  }
  inventorySiteNoticeId='';
  localStorage.removeItem(INVENTORY_SITE_NOTICE_KEY);
  renderInventorySiteNoticePreview('');
  await loadNotifications(false).catch(()=>{});
}

async function sendInventoryAlertToDiscord(){
  if(appMode!=='admin'){alert('管理者画面から送信してください。');return}
  const low=getInventoryDiscordLowItems();
  const comment=$('inventoryDiscordComment')?.value.trim()||'';
  const preview=low.length?low.map(x=>`・${x.name}：現在 ${Number(x.stock).toLocaleString('ja-JP')} / 最低 ${Number(x.min).toLocaleString('ja-JP')}`).join('\n'):'現在、最低在庫を下回っている材料はありません。';
  if(!confirm(`Discordとサイト内通知へ新規送信しますか？\n\n${comment?`【管理者コメント】\n${comment}\n\n`:''}${preview}`))return;
  const button=$('inventoryDiscordButton'),resultBox=$('inventoryDiscordResult');
  button.disabled=true;button.textContent='同時送信中…';
  if(resultBox){resultBox.className='inventory-discord-result';resultBox.textContent='Discordとサイトへ送信しています…'}
  try{
    const data=await callInventoryDiscordFunction(inventoryDiscordPayload('send'));
    inventoryDiscordMessageId=String(data.message_id||'');
    if(inventoryDiscordMessageId)localStorage.setItem(INVENTORY_DISCORD_MESSAGE_KEY,inventoryDiscordMessageId);
    await createInventorySiteNotice(inventoryDiscordMessageId);
    updateInventoryDiscordManager();
    const now=new Date().toLocaleString('ja-JP');
    if(resultBox){resultBox.className='inventory-discord-result success';resultBox.textContent=`Discord＋サイト最終送信：${now}（在庫注意 ${low.length}品目）`}
    toast('Discordとサイト内通知へ反映しました');
  }catch(error){
    console.error('Inventory notice send error',error);
    if(resultBox){resultBox.className='inventory-discord-result error';resultBox.textContent=`送信失敗：${error.message||error}`}
    alert(`送信に失敗しました。\n${error.message||error}`);
  }finally{button.disabled=false;button.textContent='⚠ 新規送信'}
}

async function editInventoryDiscordMessage(){
  if(appMode!=='admin'){alert('管理者画面から編集してください。');return}
  if(!inventoryDiscordMessageId){alert('編集できる送信済みメッセージがありません。');return}
  const low=getInventoryDiscordLowItems();
  const comment=$('inventoryDiscordComment')?.value.trim()||'';
  if(!confirm('Discordメッセージとサイト内通知を、現在の内容で同時に更新しますか？'))return;
  const button=$('inventoryDiscordEditButton'),resultBox=$('inventoryDiscordResult');
  button.disabled=true;button.textContent='同時編集中…';
  try{
    await callInventoryDiscordFunction(inventoryDiscordPayload('edit',inventoryDiscordMessageId));
    await updateInventorySiteNotice();
    if(resultBox){resultBox.className='inventory-discord-result success';resultBox.textContent=`Discord＋サイト最終編集：${new Date().toLocaleString('ja-JP')}`}
    toast('Discordとサイト内通知を編集しました');
  }catch(error){
    if(resultBox){resultBox.className='inventory-discord-result error';resultBox.textContent=`編集失敗：${error.message||error}`}
    alert(`編集に失敗しました。\n${error.message||error}`);
  }finally{button.disabled=false;button.textContent='✎ 送信内容を編集'}
}

async function deleteInventoryDiscordMessage(){
  if(appMode!=='admin'){alert('管理者画面から消去してください。');return}
  if(!inventoryDiscordMessageId&&!inventorySiteNoticeId){alert('消去できる掲載内容がありません。');return}
  if(!confirm('在庫通知を消去しますか？\nDiscord側が既に削除済みでも、サイト内通知は消去されます。'))return;
  const button=$('inventoryDiscordDeleteButton'),resultBox=$('inventoryDiscordResult');
  button.disabled=true;button.textContent='消去中…';

  let discordDeleteFailed=false;
  let discordErrorMessage='';
  try{
    if(inventoryDiscordMessageId){
      try{
        await callInventoryDiscordFunction({action:'delete',message_id:inventoryDiscordMessageId});
      }catch(error){
        discordDeleteFailed=true;
        discordErrorMessage=error?.message||String(error);
        console.warn('Inventory Discord delete failed; continuing site deletion.',error);
      }
    }

    await deleteInventorySiteNotice();
    inventoryDiscordMessageId='';
    localStorage.removeItem(INVENTORY_DISCORD_MESSAGE_KEY);
    updateInventoryDiscordManager();

    const now=new Date().toLocaleString('ja-JP');
    if(discordDeleteFailed){
      if(resultBox){
        resultBox.className='inventory-discord-result success';
        resultBox.textContent=`Discord側は削除済み・未検出のため、サイト内通知だけ消去しました：${now}`;
      }
      await writeAudit('inventory','在庫通知をサイトのみ削除','Discord削除失敗',discordErrorMessage);
      toast('Discord側は見つからなかったため、サイト内通知だけ消去しました');
    }else{
      if(resultBox){
        resultBox.className='inventory-discord-result success';
        resultBox.textContent=`Discord＋サイトから消去しました：${now}`;
      }
      toast('Discordとサイト内通知から消去しました');
    }
  }catch(error){
    if(resultBox){
      resultBox.className='inventory-discord-result error';
      resultBox.textContent=`サイト内通知の消去失敗：${error.message||error}`;
    }
    alert(`サイト内通知を消去できませんでした。\n${error.message||error}`);
  }finally{
    button.disabled=false;
    button.textContent='🗑 Discordから消去';
  }
}

function openInventorySheet(){window.open(INVENTORY_SHEET_URL,'_blank','noopener')}

['employee','role','employeeId','issueDate','periodStart','periodEnd','salesAmount','salesRate','note','hourlyRate','payRounding'].forEach(id=>$(id)?.addEventListener('input',update));
initTheme();updateInventoryDiscordManager();$('issueDate').value=iso(new Date());$('attendanceDate').value=iso(new Date());if($('rankingMonth'))$('rankingMonth').value=monthKeyLocal(new Date());if($('employeeRankingMonth'))$('employeeRankingMonth').value=monthKeyLocal(new Date());if($('salesFilterMonth'))$('salesFilterMonth').value=monthKeyLocal(new Date());currentSlipNo=newSlipNo();if(!loadDraft()){setThisMonth();addMoneyRow('deductions','その他控除',0)}loadSettingsUI();update();updateClocks();setInterval(updateClocks,1000);showLoginScreen();
window.addEventListener('focus',()=>refreshVisibleSiteData(false));
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible'){
    if(appMode==='admin')subscribeRealtime('admin');
    if(appMode==='employee')subscribeRealtime('employee');
    refreshVisibleSiteData(false);
  }
});
window.addEventListener('online',()=>{
  if(appMode==='admin')subscribeRealtime('admin');
  if(appMode==='employee')subscribeRealtime('employee');
  refreshVisibleSiteData(true);
});
window.addEventListener('offline',()=>markRealtimeStatus('offline'));
// Boot moved to js/bootstrap.js so every feature is initialized first.
/* ===== Ver.6 Supabase Farm Module ===== */
farmPeriods=[];farmItems=[];farmData={period:null,items:[],staff:[]};currentFarmPeriod=null;
inventoryCountRequests=[];
farmSubmissionRequests=[];
inventorySpreadsheetRows=[];
farmEntryDraft={};
inventoryCountDraft={};
inventoryCountNoteDraft='';
function farmN(v){return Number(v)||0} function farmNorm(v){return String(v||'').replace(/[\s　]/g,'').toLowerCase()}
async function loadFarmPeriods(){const {data,error}=await sb.from('farm_periods').select('*').order('start_date',{ascending:false});if(error)throw error;farmPeriods=data||[];if((!currentFarmPeriod||!farmPeriods.some(x=>String(x.id)===String(currentFarmPeriod)))&&farmPeriods.length)currentFarmPeriod=(farmPeriods.find(x=>x.is_active)||farmPeriods[0]).id;renderFarmPeriodOptions()}
function renderFarmPeriodOptions(){const opts=farmPeriods.length?farmPeriods.map(p=>`<option value="${p.id}">${esc(p.label)}${p.is_active?'（最新）':''}</option>`).join(''):'<option value="">期間なし</option>';[$('farmPeriodSelect'),$('employeeFarmPeriodSelect')].forEach(x=>{if(x){x.innerHTML=opts;x.value=currentFarmPeriod||''}});const p=farmPeriods.find(x=>String(x.id)===String(currentFarmPeriod));const label=p?.label||'期間を追加してください';if($('farmPeriodLabel'))$('farmPeriodLabel').textContent=label;if($('employeeFarmPeriodLabel'))$('employeeFarmPeriodLabel').textContent=label;if($('farmSheetLabel'))$('farmSheetLabel').textContent='Site Farm Database';if($('employeeFarmSheetLabel'))$('employeeFarmSheetLabel').textContent='Site Farm Database'}


function setEmployeeFarmSyncStatus(state,text){
  const dot=$('employeeFarmSyncDot');
  const label=$('employeeFarmSyncStatus');
  const button=$('employeeFarmSyncButton');
  if(dot)dot.className=state||'';
  if(label)label.textContent=text;
  if(button)button.disabled=state==='syncing';
}

async function syncEmployeeFarmFromGoogleSheet(show=true){
  await Promise.all([loadFarmData(show),loadFarmRequests(false)]);
  setEmployeeFarmSyncStatus('ok','サイト内データベース更新済み');
}

function setFarmSyncStatus(state,text){
  const dot=$('farmSyncDot'),label=$('farmSyncStatus'),button=$('farmSyncButton');
  if(dot)dot.className=state||'';
  if(label)label.textContent=text;
  if(button)button.disabled=state==='syncing';
}
async function syncFarmFromGoogleSheet(show=true){
  await Promise.all([loadFarmData(show),loadFarmRequests(false)]);
  setFarmSyncStatus('ok','サイト内データベース更新済み');
}

async function loadFarmData(show=false){
  try{
    await loadFarmPeriods();

    const {data:items,error:itemError}=await sb
      .from('farm_items')
      .select('*')
      .order('sort_order');

    if(itemError)throw itemError;
    farmItems=items||[];

    if(!currentFarmPeriod){
      farmData={
        period:null,
        items:farmItems.map(item=>({...item,total:0})),
        staff:[]
      };
      renderFarm(farmData);
      return;
    }

    const [
      {data:entries,error:entriesError},
      {data:totals,error:totalsError}
    ]=await Promise.all([
      sb.from('farm_entries').select('*').eq('period_id',currentFarmPeriod),
      sb.from('farm_staff_totals').select('*').eq('period_id',currentFarmPeriod)
    ]);

    if(entriesError)throw entriesError;
    if(totalsError)throw totalsError;

    const staffMap=new Map();

    // 手動追加された従業員も一覧に残す
    (totals||[]).forEach(row=>{
      staffMap.set(row.staff_name,{
        name:row.staff_name,
        total:0,
        assessment:0,
        payment:0,
        items:{}
      });
    });

    // 保存済みの古い査定値を使わず、
    // 現在の「査定基準」「原価」と個数から毎回再計算
    (entries||[]).forEach(row=>{
      if(!staffMap.has(row.staff_name)){
        staffMap.set(row.staff_name,{
          name:row.staff_name,
          total:0,
          assessment:0,
          payment:0,
          items:{}
        });
      }

      const staff=staffMap.get(row.staff_name);
      const item=farmItems.find(item=>String(item.id)===String(row.item_id));
      const quantity=farmN(row.quantity);

      if(!item)return;

      const assessmentRate=Number(item.assessment_rate??item.unit_value)||0;
      const costPrice=Number(item.cost_price)||0;

      staff.items[item.name]=quantity;
      staff.total+=quantity;
      staff.assessment+=quantity*assessmentRate;
      staff.payment+=quantity*costPrice;
    });

    farmData={
      period:farmPeriods.find(period=>String(period.id)===String(currentFarmPeriod)),
      items:farmItems.map(item=>({
        ...item,
        total:(entries||[])
          .filter(row=>String(row.item_id)===String(item.id))
          .reduce((sum,row)=>sum+farmN(row.quantity),0)
      })),
      staff:[...staffMap.values()]
    };

    renderFarm(farmData);

    if(appMode==='admin'&&$('farmSyncStatus')?.textContent==='同期待機中'){
      setFarmSyncStatus('ok','Supabaseデータ読込済み');
    }

    renderFarmEntrySheet?.();
    renderFarmItemSettings?.();

    if(show)toast('Farmデータを更新しました');
  }catch(error){
    console.error('Farm load error',error);
    if(show)alert('Farmを読み込めません。\n'+(error?.message||error));
  }
}
function renderFarm(d){const grand=d.items.reduce((s,x)=>s+farmN(x.total),0),rank=[...d.staff].sort((a,b)=>b.total-a.total),ass=d.staff.reduce((s,x)=>s+farmN(x.assessment),0),pay=d.staff.reduce((s,x)=>s+farmN(x.payment),0);renderFarmPeriodOptions();if($('farmGrandTotal'))$('farmGrandTotal').textContent=grand.toLocaleString('ja-JP');if($('farmTopStaff'))$('farmTopStaff').textContent=rank[0]?.name||'-';if($('farmTotalAssessment'))$('farmTotalAssessment').textContent=ass.toLocaleString('ja-JP',{maximumFractionDigits:1});if($('farmTotalPayment'))$('farmTotalPayment').textContent=yen.format(pay);if($('farmItemGrid'))$('farmItemGrid').innerHTML=d.items.map(x=>`<article class="farm-item"><h3>${esc(x.name)}</h3><div class="farm-total">${farmN(x.total).toLocaleString('ja-JP')}</div><div class="farm-average">期間合計</div></article>`).join('')||'<div class="farm-empty">品目なし</div>';if($('farmStaffGrid'))$('farmStaffGrid').innerHTML=rank.map(x=>`<article class="farm-staff-card"><div class="farm-staff-head"><strong>${esc(x.name)}</strong><b>${x.total.toLocaleString('ja-JP')}個</b></div><div class="farm-breakdown">${Object.entries(x.items).map(([k,v])=>`<span>${esc(k)}：${farmN(v).toLocaleString('ja-JP')}</span>`).join('')||'<span>記録なし</span>'}</div><div class="sheet-note">査定 ${farmN(x.assessment).toLocaleString('ja-JP',{maximumFractionDigits:4})} ／ ${yen.format(x.payment)}</div></article>`).join('')||'<div class="farm-empty">スタッフなし</div>';if($('farmRankingList'))$('farmRankingList').innerHTML=rank.map((x,i)=>`<div class="farm-ranking-row"><div class="farm-rank-no">${i+1}</div>${rankingAvatar(x)}<div><strong>${esc(rankingDisplayName(x))}</strong><small>査定 ${farmN(x.assessment).toLocaleString('ja-JP',{maximumFractionDigits:4})}</small></div><div class="farm-number">${x.total.toLocaleString('ja-JP')}個</div><div class="farm-number farm-money">${yen.format(x.payment)}</div></div>`).join('')||'<div class="farm-empty">ランキングなし</div>';renderFarmManage();renderEmployeeFarm(d)}
function renderEmployeeFarm(d){
  const grand=d.items.reduce((s,x)=>s+farmN(x.total),0);
  const rank=[...d.staff].sort((a,b)=>b.total-a.total);
  const assessment=d.staff.reduce((s,x)=>s+farmN(x.assessment),0);
  const payment=d.staff.reduce((s,x)=>s+farmN(x.payment),0);
  const me=rank.find(x=>currentEmployee&&farmNorm(x.name)===farmNorm(currentEmployee.name));
  const r=me?rank.indexOf(me)+1:0;

  if($('employeeFarmGrandTotal'))$('employeeFarmGrandTotal').textContent=grand.toLocaleString('ja-JP');
  if($('employeeFarmTopStaff'))$('employeeFarmTopStaff').textContent=rank[0]?.name||'-';
  if($('employeeFarmTotalAssessment'))$('employeeFarmTotalAssessment').textContent=assessment.toLocaleString('ja-JP',{maximumFractionDigits:1});
  if($('employeeFarmTotalPayment'))$('employeeFarmTotalPayment').textContent=yen.format(payment);
  if($('employeeMyFarm'))$('employeeMyFarm').textContent=(me?.total||0).toLocaleString('ja-JP');
  if($('employeeMyFarmRank'))$('employeeMyFarmRank').textContent=r?`${r}位`:'-';

  if($('employeeFarmItemGrid'))$('employeeFarmItemGrid').innerHTML=d.items.map(x=>`<article class="farm-item"><h3>${esc(x.name)}</h3><div class="farm-total">${farmN(x.total).toLocaleString('ja-JP')}</div><div class="farm-average">期間合計</div></article>`).join('')||'<div class="farm-empty">品目データがありません。</div>';

  if($('employeeFarmStaffGrid'))$('employeeFarmStaffGrid').innerHTML=rank.map(x=>`<article class="farm-staff-card"><div class="farm-staff-head"><strong>${esc(x.name)}${me===x?'（あなた）':''}</strong><b>${x.total.toLocaleString('ja-JP')}個</b></div><div class="farm-breakdown">${Object.entries(x.items).map(([k,v])=>`<span>${esc(k)}：${farmN(v).toLocaleString('ja-JP')}</span>`).join('')||'<span>採取記録なし</span>'}</div><div class="sheet-note">査定 ${farmN(x.assessment).toLocaleString('ja-JP',{maximumFractionDigits:1})} ／ ${yen.format(x.payment)}</div></article>`).join('')||'<div class="farm-empty">スタッフ別データがありません。</div>';

  if($('employeeFarmRankingList'))$('employeeFarmRankingList').innerHTML=rank.map((x,i)=>`<div class="farm-ranking-row"><div class="farm-rank-no">${i+1}</div>${rankingAvatar(x)}<div><strong>${esc(rankingDisplayName(x))}${me===x?'（あなた）':''}</strong><small>査定 ${farmN(x.assessment).toLocaleString('ja-JP',{maximumFractionDigits:1})}</small></div><div class="farm-number">${x.total.toLocaleString('ja-JP')}個</div><div class="farm-number farm-money">${yen.format(x.payment)}</div></div>`).join('')||'<div class="farm-empty">ランキングデータがありません。</div>';
}
function changeFarmPeriod(v){currentFarmPeriod=v;loadFarmData()} function changeEmployeeFarmPeriod(v){currentFarmPeriod=v;loadFarmData()}
function setFarmTab(tab){document.querySelectorAll('[data-farm-tab]').forEach(b=>b.classList.toggle('active',b.dataset.farmTab===tab));document.querySelectorAll('#page-farm .farm-view').forEach(v=>v.classList.remove('active'));$('farmView'+tab[0].toUpperCase()+tab.slice(1))?.classList.add('active');if(tab==='manage')renderFarmManage()}
function setEmployeeFarmTab(tab){document.querySelectorAll('[data-employee-farm-tab]').forEach(b=>b.classList.toggle('active',b.dataset.employeeFarmTab===tab));document.querySelectorAll('#employee-page-farm .farm-view').forEach(v=>v.classList.remove('active'));$('employeeFarmView'+tab[0].toUpperCase()+tab.slice(1))?.classList.add('active')}
farmManageDraft=[];
farmManageDirty=false;

function captureFarmManageDraft(){
  const cards=[...document.querySelectorAll('#farmManageRows [data-farm-row]')];
  if(!cards.length)return;
  farmManageDraft=cards.map(card=>{
    const items={};
    card.querySelectorAll('.fm-q').forEach(input=>{
      items[String(input.dataset.item)]=Math.max(0,Math.round(Number(input.value)||0));
    });
    return {
      originalName:card.dataset.originalName||'',
      name:card.querySelector('.fm-name')?.value.trim()||'',
      assessment:Math.max(0,Number(card.querySelector('.fm-ass')?.value)||0),
      payment:Math.max(0,Math.round(Number(card.querySelector('.fm-pay')?.value)||0)),
      items
    };
  });
}
function markFarmManageDirty(){
  farmManageDirty=true;
  captureFarmManageDraft();
}
function renderFarmManage(){
  const box=$('farmManageRows');if(!box)return;

  if(!farmManageDirty){
    farmManageDraft=(farmData.staff||[]).map(s=>({
      originalName:s.name,
      name:s.name,
      assessment:Number(s.assessment)||0,
      payment:Number(s.payment)||0,
      items:Object.fromEntries(
        farmItems.map(item=>[String(item.id),Number(s.items?.[item.name])||0])
      )
    }));
  }

  box.innerHTML=farmManageDraft.length
    ?farmManageDraft.map((s,idx)=>farmManageCard(s,idx)).join('')
    :'<div class="farm-empty">従業員が登録されていません。「従業員を追加」を押してください。</div>';
}
function farmManageCard(s,idx){
  return `<article class="farm-manage-card" data-farm-row="${idx}" data-original-name="${esc(s.originalName||'')}">
    <div class="farm-manage-head">
      <div class="field farm-staff-name-field">
        <label>従業員名</label>
        <input class="fm-name" value="${esc(s.name||'')}" placeholder="従業員名を入力" oninput="markFarmManageDirty()">
      </div>
      <button class="btn danger" onclick="removeFarmStaffRow(${idx})">削除</button>
    </div>
    <div class="farm-manage-grid">
      ${farmItems.filter(it=>it.is_active!==false).map(it=>`
        <label>${esc(it.name)}
          <input class="fm-q" data-item="${it.id}" type="number" min="0" step="1"
            value="${Number(s.items?.[String(it.id)])||0}" oninput="markFarmManageDirty()">
        </label>`).join('')}
    </div>
    <div class="farm-manage-money">
      <div class="field">
        <label>査定</label>
        <input class="fm-ass" type="number" min="0" step="0.01" value="${Number(s.assessment)||0}" oninput="markFarmManageDirty()">
      </div>
      <div class="field">
        <label>仕入れ金額</label>
        <input class="fm-pay" type="number" min="0" step="1" value="${Number(s.payment)||0}" oninput="markFarmManageDirty()">
      </div>
    </div>
  </article>`;
}
function addFarmStaffRow(){
  captureFarmManageDraft();
  farmManageDraft.push({
    originalName:'',
    name:'',
    assessment:0,
    payment:0,
    items:Object.fromEntries(farmItems.map(item=>[String(item.id),0]))
  });
  farmManageDirty=true;
  renderFarmManage();
  setTimeout(()=>{
    const inputs=document.querySelectorAll('#farmManageRows .fm-name');
    inputs[inputs.length-1]?.focus();
  },0);
}
async function removeFarmStaffRow(i){
  captureFarmManageDraft();
  const row=farmManageDraft[i];
  if(!row)return;
  const label=row.name||row.originalName||'この従業員';
  if(!confirm(`「${label}」をFarm従業員一覧から削除しますか？`))return;

  try{
    if(row.originalName&&currentFarmPeriod){
      const [entriesResult,totalResult]=await Promise.all([
        sb.from('farm_entries').delete().eq('period_id',currentFarmPeriod).eq('staff_name',row.originalName),
        sb.from('farm_staff_totals').delete().eq('period_id',currentFarmPeriod).eq('staff_name',row.originalName)
      ]);
      if(entriesResult.error)throw entriesResult.error;
      if(totalResult.error)throw totalResult.error;
    }
    farmManageDraft.splice(i,1);
    farmManageDirty=true;
    renderFarmManage();
    toast('Farm従業員を削除しました');
  }catch(error){
    alert('従業員を削除できませんでした：'+(error?.message||error));
  }
}
async function saveFarmManageData(){
  if(!currentFarmPeriod)return alert('最初にFarm期間を追加・選択してください。');
  captureFarmManageDraft();

  const rows=farmManageDraft.map(row=>({...row,name:String(row.name||'').trim()})).filter(row=>row.name);
  if(!rows.length)return alert('従業員名を1人以上入力してください。');

  const normalized=rows.map(row=>farmNorm(row.name));
  if(normalized.some((name,index)=>normalized.indexOf(name)!==index)){
    return alert('同じ従業員名が重複しています。');
  }

  try{
    for(const row of rows){
      const oldName=String(row.originalName||'').trim();
      const newName=row.name;

      if(oldName&&farmNorm(oldName)!==farmNorm(newName)){
        const [deleteEntries,deleteTotal]=await Promise.all([
          sb.from('farm_entries').delete().eq('period_id',currentFarmPeriod).eq('staff_name',oldName),
          sb.from('farm_staff_totals').delete().eq('period_id',currentFarmPeriod).eq('staff_name',oldName)
        ]);
        if(deleteEntries.error)throw new Error(`${oldName}の旧採取記録削除：${deleteEntries.error.message}`);
        if(deleteTotal.error)throw new Error(`${oldName}の旧集計削除：${deleteTotal.error.message}`);
      }

      const {error:totalError}=await sb.from('farm_staff_totals').upsert({
        period_id:Number(currentFarmPeriod),
        staff_name:newName,
        assessment:Number(row.assessment)||0,
        payment:Math.max(0,Math.round(Number(row.payment)||0))
      },{onConflict:'period_id,staff_name'});
      if(totalError)throw new Error(`${newName}の集計保存：${totalError.message}`);

      const entries=farmItems.filter(item=>item.is_active!==false).map(item=>({
        period_id:Number(currentFarmPeriod),
        staff_name:newName,
        item_id:Number(item.id),
        quantity:Math.max(0,Math.round(Number(row.items[String(item.id)])||0))
      }));

      if(entries.length){
        const {error:entryError}=await sb.from('farm_entries').upsert(entries,{onConflict:'period_id,staff_name,item_id'});
        if(entryError)throw new Error(`${newName}の採取数保存：${entryError.message}`);
      }
    }

    farmManageDirty=false;
    farmManageDraft=[];
    await loadFarmData(false);
    renderFarmManage();
    await writeAudit('farm','Farm従業員を編集',`${rows.length}名`,'従業員管理');
    toast('Farm従業員情報を保存しました');
  }catch(error){
    farmManageDirty=true;
    captureFarmManageDraft();
    console.error('Farm staff save error',error);
    alert('Farm従業員情報を保存できませんでした。\n'+(error?.message||error)+'\n\nVer.18.2.3の修復SQLを実行してください。');
  }
}
async function deleteFarmPeriod(){
  const period=farmPeriods.find(x=>String(x.id)===String(currentFarmPeriod));
  if(!period)return alert('削除する期間を選択してください。');
  const label=period.label||`${period.start_date}〜${period.end_date}`;
  const first=confirm(
    `「${label}」を削除しますか？\n\nこの期間の採取数・査定・支給金額・ランキングもすべて削除されます。`
  );
  if(!first)return;
  const typed=prompt(`削除確認のため「削除」と入力してください。\n対象：${label}`);
  if(typed!=='削除')return alert('削除をキャンセルしました。');
  const button=$('deleteFarmPeriodButton');
  if(button)button.disabled=true;
  try{
    const {error}=await sb.from('farm_periods').delete().eq('id',currentFarmPeriod);
    if(error)throw error;
    currentFarmPeriod=null;
    farmData={period:null,items:[],staff:[]};
    await loadFarmData(false);
    toast(`「${label}」を削除しました`);
  }catch(err){
    console.error('Farm period delete error',err);
    alert('期間を削除できませんでした。\n'+(err.message||err));
  }finally{
    if(button)button.disabled=false;
  }
}

async function createFarmPeriod(){
  const label=prompt('集計期間名を入力してください。\n例：8月3日〜8月9日');
  if(!label)return;
  const sheetName=prompt('Google Sheetsのシート名を入力してください。\n例：8.3-8.9');
  if(!sheetName)return;
  const start=prompt('開始日を入力してください。\n例：2026-08-03');
  if(!start)return;
  const end=prompt('終了日を入力してください。\n例：2026-08-09');
  if(!end)return;
  const {data,error}=await sb.from('farm_periods')
    .insert({label,sheet_name:sheetName,start_date:start,end_date:end,is_active:true})
    .select().single();
  if(error)return alert(error.message);
  currentFarmPeriod=data.id;
  await syncFarmFromGoogleSheet(false);
  await loadFarmData();
  toast('期間を追加してGoogle Sheetsを同期しました');
}


farmAutoSyncBusy=false;
window.__farmSyncEnabled=false;
setInterval(async()=>{
  try{
    const adminFarmOpen=appMode==='admin'&&$('page-farm')?.classList.contains('active');
    const employeeFarmOpen=appMode==='employee'&&$('employee-page-farm')?.classList.contains('active');
    if(adminFarmOpen&&window.__farmSyncEnabled&&!farmAutoSyncBusy){
      farmAutoSyncBusy=true;
      await syncFarmFromGoogleSheet(false);
      farmAutoSyncBusy=false;
    }else if(employeeFarmOpen){
      await loadFarmData(false);
    }
  }catch(e){
    farmAutoSyncBusy=false;
    console.error('Farm auto sync error',e);
  }
},60000);



inventoryAutoSyncBusy=false;
window.__inventorySyncEnabled=false;
setInterval(async()=>{
  try{
    const adminInventoryOpen=appMode==='admin'&&$('page-inventory')?.classList.contains('active');
    const employeeInventoryOpen=appMode==='employee'&&$('employee-page-inventory')?.classList.contains('active');
    if(adminInventoryOpen&&window.__inventorySyncEnabled&&!inventoryAutoSyncBusy){
      inventoryAutoSyncBusy=true;
      await syncInventoryFromGoogleSheet(false);
      inventoryAutoSyncBusy=false;
    }else if(employeeInventoryOpen){
      await loadInventorySnapshot(false);
    }
  }catch(e){
    inventoryAutoSyncBusy=false;
    console.error('Inventory auto sync error',e);
  }
},60000);



function applyMobileNavLabels(){
  const isMobile=window.matchMedia('(max-width:760px)').matches;
  const labels={
    dashboard:'ホーム',employees:'従業員',attendance:'出勤',sales:'売上',
    inventory:'在庫',farm:'Farm',ranking:'順位',online:'オンライン',create:'給与',
    history:'履歴',settings:'設定',notifications:'通知',home:'ホーム',payslips:'明細'
  };
  document.querySelectorAll('.v4-sidebar button[data-page],.employee-sidebar button[data-employee-page]').forEach(btn=>{
    const key=btn.dataset.page||btn.dataset.employeePage;
    const b=btn.querySelector('b');
    if(!b)return;
    if(!b.dataset.desktopLabel)b.dataset.desktopLabel=b.textContent;
    b.textContent=isMobile?(labels[key]||b.dataset.desktopLabel):b.dataset.desktopLabel;
  });
}
window.addEventListener('resize',applyMobileNavLabels);
document.addEventListener('DOMContentLoaded',applyMobileNavLabels);




// ===== Premium 1.3 Online Presence =====
function presenceState(row){
  const seen=row?.last_seen_at?new Date(row.last_seen_at).getTime():0;
  const age=Date.now()-seen;
  if(row?.status==='online'&&age<=90000)return 'online';
  if((row?.status==='online'||row?.status==='away')&&age<=10*60*1000)return 'away';
  return 'offline';
}
function presenceLabel(state){return state==='online'?'オンライン':state==='away'?'離席中':'オフライン'}
function lastSeenLabel(value){
  if(!value)return 'アクセス記録なし';
  const sec=Math.max(0,Math.floor((Date.now()-new Date(value).getTime())/1000));
  if(sec<60)return 'たった今';
  if(sec<3600)return `${Math.floor(sec/60)}分前`;
  if(sec<86400)return `${Math.floor(sec/3600)}時間前`;
  return new Date(value).toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
}
async function loadOnlinePresence(showToast=false){
  if(!sb)return;
  const {data,error}=await sb.from('online_presence').select('user_id,status,last_seen_at,updated_at');
  if(error){console.warn('オンライン状況取得エラー:',error);if(showToast)toast('オンライン状況を取得できませんでした');return}
  onlinePresenceData=data||[];renderOnlinePresence();if(showToast)toast('オンライン状況を更新しました');
}
function renderOnlinePresence(){
  const byId=new Map(onlinePresenceData.map(x=>[x.user_id,x]));
  const rows=(employees||[]).map(e=>({employee:e,presence:byId.get(e.uid)||null,state:presenceState(byId.get(e.uid))}));
  rows.sort((a,b)=>({online:0,away:1,offline:2}[a.state]-({online:0,away:1,offline:2}[b.state])||String(a.employee.name).localeCompare(String(b.employee.name),'ja')));
  const counts={online:0,away:0,offline:0};rows.forEach(r=>counts[r.state]++);
  const html=rows.length?rows.map(({employee:e,presence:p,state})=>{
    const avatar=e.avatarUrl?`style="background-image:url('${esc(e.avatarUrl)}')" class="online-avatar has-image"`:`class="online-avatar"`;
    return `<article class="online-card"><div ${avatar}>${e.avatarUrl?'':esc((e.name||'従').slice(0,1))}<i class="online-dot ${state}"></i></div><div class="online-info"><strong>${esc(e.name||e.legalName||'スタッフ')}</strong><small>${esc(e.role||'Cast')} ・ ${lastSeenLabel(p?.last_seen_at)}</small></div><span class="online-state ${state}">${presenceLabel(state)}</span></article>`;
  }).join(''):'<div class="empty">スタッフが登録されていません。</div>';
  ['adminOnlineGrid','employeeOnlineGrid'].forEach(id=>{if($(id))$(id).innerHTML=html});
  [['adminOnlineCount','employeeOnlineCount'],['adminAwayCount','employeeAwayCount'],['adminPresenceTotal','employeePresenceTotal']].forEach((ids,i)=>ids.forEach(id=>{if($(id))$(id).textContent=i===0?counts.online:i===1?counts.away:rows.length}));
  const stamp=`更新 ${new Date().toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'})}`;
  ['adminPresenceUpdated','employeePresenceUpdated'].forEach(id=>{if($(id))$(id).textContent=stamp});
}
async function sendPresenceHeartbeat(forceStatus){
  if(!sb||!currentProfile?.id||appMode==='login')return;
  const status=forceStatus||(presenceIdle?'away':'online');
  const now=new Date().toISOString();
  const payload={user_id:currentProfile.id,status,last_seen_at:now,updated_at:now};
  try{
    const {data,error}=await sb.from('online_presence')
      .update(payload)
      .eq('user_id',currentProfile.id)
      .select('user_id');
    if(error)throw error;
    if(!data?.length){
      const {error:insertError}=await sb.from('online_presence').insert(payload);
      if(insertError&&insertError.code!=='23505')throw insertError;
    }
  }catch(error){
    console.warn('オンライン状態更新エラー:',error);
  }
}
function recordPresenceActivity(){lastPresenceActivity=Date.now();if(presenceIdle){presenceIdle=false;sendPresenceHeartbeat('online')}}
function startPresenceTracking(){
  stopPresenceTracking(false);lastPresenceActivity=Date.now();presenceIdle=false;
  ['pointerdown','keydown','touchstart','scroll'].forEach(type=>window.addEventListener(type,recordPresenceActivity,{passive:true}));
  sendPresenceHeartbeat('online');loadOnlinePresence(false);
  presenceHeartbeatTimer=setInterval(()=>{presenceIdle=Date.now()-lastPresenceActivity>5*60*1000;sendPresenceHeartbeat();},30000);
  presenceRefreshTimer=setInterval(()=>loadOnlinePresence(false),30000);
}
async function stopPresenceTracking(markOffline=true){
  if(presenceHeartbeatTimer)clearInterval(presenceHeartbeatTimer);if(presenceRefreshTimer)clearInterval(presenceRefreshTimer);
  presenceHeartbeatTimer=null;presenceRefreshTimer=null;
  ['pointerdown','keydown','touchstart','scroll'].forEach(type=>window.removeEventListener(type,recordPresenceActivity));
  if(markOffline&&sb&&currentProfile?.id){
    try{
      const now=new Date().toISOString();
      await sb.from('online_presence')
        .update({status:'offline',last_seen_at:now,updated_at:now})
        .eq('user_id',currentProfile.id);
    }catch{}
  }
}
document.addEventListener('visibilitychange',()=>{if(appMode!=='login'){if(document.hidden){presenceIdle=true;sendPresenceHeartbeat('away')}else{recordPresenceActivity();loadOnlinePresence(false)}}});
window.addEventListener('beforeunload',()=>{if(appMode!=='login')sendPresenceHeartbeat('offline')});
setInterval(()=>{if(appMode!=='login')renderOnlinePresence()},60000);

// ===== Premium 1.1 Profile =====
pendingProfileAvatar='';
function cleanAvatarUrl(url){
  const value=String(url||'').trim();
  if(!value||value==='null'||value==='undefined')return '';
  return value;
}
function normalizeIdentityValue(value){
  return String(value||'').replace(/\s+/g,'').toLowerCase();
}
function scoreVisualProfile(candidate,target){
  if(!candidate)return 0;
  const targetIds=[target?.employee_id,target?.employeeId,target?.id].map(normalizeIdentityValue);
  const targetNames=[target?.employee_name,target?.display_name,target?.name,target?.legalName].map(normalizeIdentityValue);
  let score=0;
  if(cleanAvatarUrl(candidate.avatar_url||candidate.avatarUrl))score+=20;
  if(targetIds.includes(normalizeIdentityValue(candidate.employee_id||candidate.id)))score+=9;
  if(targetNames.includes(normalizeIdentityValue(candidate.employee_name||candidate.legalName)))score+=7;
  if(targetNames.includes(normalizeIdentityValue(candidate.display_name||candidate.name)))score+=6;
  if((candidate.account_type||candidate.accountType)==='employee')score+=3;
  return score;
}
async function hydrateCurrentProfileVisuals(){
  if(!sb||!currentProfile)return;
  const currentAvatar=cleanAvatarUrl(currentProfile.avatar_url);
  const clauses=[];
  const employeeId=String(currentProfile.employee_id||'').trim();
  const employeeName=String(currentProfile.employee_name||'').trim();
  const displayName=String(currentProfile.display_name||'').trim();
  if(employeeId)clauses.push(`employee_id.eq.${employeeId}`);
  if(employeeName){clauses.push(`employee_name.eq.${employeeName}`);clauses.push(`display_name.eq.${employeeName}`);}
  if(displayName){clauses.push(`display_name.eq.${displayName}`);clauses.push(`employee_name.eq.${displayName}`);}
  if(!clauses.length)return;
  try{
    const {data,error}=await sb.from('profiles').select('*').or(clauses.join(',')).limit(12);
    if(error||!(data||[]).length)return;
    const target={employee_id:employeeId,employee_name:employeeName,display_name:displayName};
    const pool=(data||[]).slice().sort((a,b)=>scoreVisualProfile(b,target)-scoreVisualProfile(a,target));
    const best=pool[0];
    if(!best)return;
    if(!currentAvatar){
      const bestAvatar=cleanAvatarUrl(best.avatar_url);
      if(bestAvatar)currentProfile.avatar_url=bestAvatar;
    }
    if((!currentProfile.display_name||currentProfile.display_name==='管理者')&&(best.display_name||best.employee_name))currentProfile.display_name=best.display_name||best.employee_name;
    if(!currentProfile.employee_name&&best.employee_name)currentProfile.employee_name=best.employee_name;
  }catch(err){console.warn('プロフィール表示補完エラー:',err)}
}
function setAvatarElement(el,url,fallback){
  if(!el)return;
  const safeUrl=cleanAvatarUrl(url);
  const fallbackText=(fallback||'従').slice(0,1);

  el.classList.remove('has-image');
  el.style.backgroundImage='';
  el.innerHTML='';

  if(!safeUrl){
    el.textContent=fallbackText;
    return;
  }

  const img=document.createElement('img');
  img.alt=fallbackText;
  img.loading='eager';
  img.decoding='async';
  img.referrerPolicy='no-referrer';
  img.src=safeUrl;

  img.onload=()=>{
    el.classList.add('has-image');
    el.textContent='';
    if(!el.contains(img))el.appendChild(img);
  };

  img.onerror=()=>{
    el.classList.remove('has-image');
    el.innerHTML='';
    el.textContent=fallbackText;
    console.warn('プロフィール画像を読み込めませんでした:',safeUrl);
  };

  el.appendChild(img);
}
function syncCurrentVisualEmployee(){
  if(!currentProfile||!(employees||[]).length)return null;
  const pid=normalizeIdentityValue(currentProfile.employee_id||'');
  const pname=normalizeIdentityValue(currentProfile.employee_name||currentProfile.display_name||'');
  const prole=normalizeIdentityValue(currentProfile.role||'');
  let found=employees.find(e=>pid&&normalizeIdentityValue(e.id)===pid)
    || employees.find(e=>pname&&normalizeIdentityValue(e.legalName)===pname)
    || employees.find(e=>pname&&normalizeIdentityValue(e.name)===pname);
  if(!found && currentProfile.account_type==='admin'){
    const ownerCandidates=employees.filter(e=>{
      const role=normalizeIdentityValue(e.role||'');
      return role==='owner'||role.includes('owner')||role.includes('オーナー');
    });
    found=ownerCandidates.find(e=>cleanAvatarUrl(e.avatarUrl))||ownerCandidates[0]||null;
  }
  if(!found && prole){
    const roleCandidates=employees.filter(e=>normalizeIdentityValue(e.role||'')===prole);
    found=roleCandidates.find(e=>cleanAvatarUrl(e.avatarUrl))||roleCandidates[0]||null;
  }
  if(found){
    if(cleanAvatarUrl(found.avatarUrl)) currentProfile.avatar_url=found.avatarUrl;
    if(currentProfile.account_type==='admin'){
      currentProfile._linked_employee_name=found.name||found.legalName||'';
      currentProfile._linked_employee_role=found.role||'';
    }
    if(!currentEmployee) currentEmployee={...found};
    else if(!cleanAvatarUrl(currentEmployee.avatarUrl)&&cleanAvatarUrl(found.avatarUrl))currentEmployee.avatarUrl=found.avatarUrl;
  }
  return found||null;
}
function updateEmployeeCacheFromProfile(profile){
  if(!profile)return;
  const mapped=mapProfile(profile);
  const index=(employees||[]).findIndex(e=>e.uid===mapped.uid||(
    normalizeIdentityValue(e.id)===normalizeIdentityValue(mapped.id)&&normalizeIdentityValue(mapped.id)
  ));
  if(index>=0)employees[index]={...employees[index],...mapped};
  else if(mapped.accountType==='employee')employees.push(mapped);
}
function syncAllCurrentAvatarElements(){
  if(!currentProfile&&!currentEmployee)return;
  const matched=syncCurrentVisualEmployee?.()||null;
  const name=currentEmployee?.name||currentProfile?.display_name||currentProfile?.employee_name||matched?.name||'スタッフ';
  const role=currentEmployee?.role||currentProfile?.role||matched?.role||'Cast';
  const avatar=cleanAvatarUrl(currentEmployee?.avatarUrl)||cleanAvatarUrl(currentProfile?.avatar_url)||cleanAvatarUrl(matched?.avatarUrl)||'';
  const initial=(name||'従').slice(0,1);
  ['employeeProfileAvatar','profileCardAvatar','profileAvatarPreview','adminProfileAvatar'].forEach(id=>setAvatarElement($(id),avatar,initial));
  if($('employeeTopName'))$('employeeTopName').textContent=name;
  if($('employeeTopRole'))$('employeeTopRole').textContent=role;
  if($('adminTopName')&&appMode==='admin')$('adminTopName').textContent=name;
  if($('adminTopRole')&&appMode==='admin')$('adminTopRole').textContent=role;
}
function applyAdminProfileEverywhere(){
  if(!currentProfile)return;
  const matched=syncCurrentVisualEmployee();
  const linkedName=currentProfile._linked_employee_name||matched?.name||matched?.legalName||'';
  const linkedRole=currentProfile._linked_employee_role||matched?.role||'';
  const name=linkedName||currentProfile.display_name||currentProfile.employee_name||'管理者';
  const role=linkedRole||currentProfile.role||'Administrator';
  const initial=(name||'管').slice(0,1);
  const avatar=cleanAvatarUrl(matched?.avatarUrl)||cleanAvatarUrl(currentProfile.avatar_url)||cleanAvatarUrl(currentEmployee?.avatarUrl)||'';
  if($('adminTopName'))$('adminTopName').textContent=name;
  if($('adminTopRole'))$('adminTopRole').textContent=role;
  setAvatarElement($('adminProfileAvatar'),avatar,initial);
  syncAllCurrentAvatarElements();
}

function applyProfileEverywhere(){
  if(!currentEmployee)return;
  syncCurrentVisualEmployee();
  const name=currentEmployee.name||currentEmployee.legalName||currentProfile?.display_name||'スタッフ';
  const initial=name.slice(0,1)||'従';
  const avatar=cleanAvatarUrl(currentEmployee.avatarUrl)||cleanAvatarUrl(currentProfile?.avatar_url)||'';
  if($('employeeTopName'))$('employeeTopName').textContent=name;
  if($('employeeTopRole'))$('employeeTopRole').textContent=currentEmployee.role||'Cast';
  setAvatarElement($('employeeProfileAvatar'),avatar,initial);
  setAvatarElement($('profileCardAvatar'),avatar,initial);
  setAvatarElement($('profileAvatarPreview'),avatar,initial);
  syncAllCurrentAvatarElements();
  if($('profileCardName'))$('profileCardName').textContent=name;
  if($('profileCardRole'))$('profileCardRole').textContent=`${currentEmployee.role||'Cast'} ・ ${currentEmployee.id||'-'}`;
  if($('profileCardBio'))$('profileCardBio').textContent=currentEmployee.bio||'自己紹介はまだ設定されていません。';
  if($('profileCardDiscord'))$('profileCardDiscord').textContent=currentEmployee.discordName||'未設定';
  if($('profileCardMessage'))$('profileCardMessage').textContent=currentEmployee.statusMessage||'今日もよろしくお願いします！';
}
function loadMyProfileForm(){
  if(!currentEmployee)return;
  pendingProfileAvatar=currentEmployee.avatarUrl||'';
  if($('profileDisplayName'))$('profileDisplayName').value=currentEmployee.name||currentEmployee.legalName||'';
  if($('profileDiscordName'))$('profileDiscordName').value=currentEmployee.discordName||'';
  if($('profileStatusMessage'))$('profileStatusMessage').value=currentEmployee.statusMessage||'';
  if($('profileBio'))$('profileBio').value=currentEmployee.bio||'';
  if($('profileSaveStatus'))$('profileSaveStatus').textContent='';
  updateProfileCharCount();previewProfileForm();
}
function updateProfileCharCount(){if($('profileBioCount'))$('profileBioCount').textContent=`${($('profileBio')?.value||'').length} / 300`}
function previewProfileForm(){
  if(!currentEmployee)return;
  const name=$('profileDisplayName')?.value.trim()||currentEmployee.legalName||'スタッフ';
  setAvatarElement($('profileCardAvatar'),pendingProfileAvatar,name.slice(0,1));
  setAvatarElement($('profileAvatarPreview'),pendingProfileAvatar,name.slice(0,1));
  if($('profileCardName'))$('profileCardName').textContent=name;
  if($('profileCardBio'))$('profileCardBio').textContent=$('profileBio')?.value.trim()||'自己紹介はまだ設定されていません。';
  if($('profileCardDiscord'))$('profileCardDiscord').textContent=$('profileDiscordName')?.value.trim()||'未設定';
  if($('profileCardMessage'))$('profileCardMessage').textContent=$('profileStatusMessage')?.value.trim()||'今日もよろしくお願いします！';
}
async function handleProfileAvatar(event){
  const file=event.target.files?.[0];if(!file)return;
  if(!file.type.startsWith('image/')){alert('画像ファイルを選択してください。');return}
  if(file.size>8*1024*1024){alert('画像は8MB以下にしてください。');return}
  try{pendingProfileAvatar=await compressProfileImage(file);previewProfileForm()}catch(e){console.error(e);alert('画像を読み込めませんでした。')}
  event.target.value='';
}
function compressProfileImage(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=reject;reader.onload=()=>{const img=new Image();img.onerror=reject;img.onload=()=>{const size=360,canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;const ctx=canvas.getContext('2d');const scale=Math.max(size/img.width,size/img.height),w=img.width*scale,h=img.height*scale;ctx.drawImage(img,(size-w)/2,(size-h)/2,w,h);resolve(canvas.toDataURL('image/jpeg',.82))};img.src=reader.result};reader.readAsDataURL(file)})}
function removeProfileAvatar(){pendingProfileAvatar='';previewProfileForm()}
async function saveMyProfile(){
  if(!currentProfile||!currentEmployee)return;
  const displayName=$('profileDisplayName').value.trim();
  if(!displayName){alert('表示名を入力してください。');return}
  const button=$('saveProfileButton'),status=$('profileSaveStatus');button.disabled=true;status.textContent='保存中…';
  const patch={display_name:displayName,avatar_url:pendingProfileAvatar||null,bio:$('profileBio').value.trim(),discord_name:$('profileDiscordName').value.trim(),status_message:$('profileStatusMessage').value.trim(),updated_at:new Date().toISOString()};
  try{
    const {data,error}=await sb.from('profiles').update(patch).eq('id',currentProfile.id).select('*').single();
    if(error)throw error;
    currentProfile=data;currentEmployee=mapProfile(data);updateEmployeeCacheFromProfile(data);applyProfileEverywhere();syncAllCurrentAvatarElements();renderEmployeePortal();renderEmployeeDashboard();renderEmployeeRanking();renderOnlinePresence();await loadCommunityProfiles(false);status.textContent='保存しました';toast('プロフィールを保存しました');
  }catch(error){console.error(error);status.textContent='保存できませんでした';alert(error.message?.includes('column')?'プロフィール追加SQLを先に実行してください。':`保存に失敗しました：${error.message}`)}
  finally{button.disabled=false;setTimeout(()=>{if(status.textContent==='保存しました')status.textContent=''},2500)}
}
['profileDisplayName','profileDiscordName','profileStatusMessage'].forEach(id=>document.addEventListener('input',e=>{if(e.target?.id===id)previewProfileForm()}));




adminEditingProfile=null;
adminEditingAvatar='';

function openAdminProfileEditor(profileId){
  if(appMode!=='admin'){alert('管理者のみ編集できます。');return}
  const employee=employees.find(e=>String(e.uid)===String(profileId));
  if(!employee){alert('プロフィールが見つかりません。');return}
  adminEditingProfile=employee;
  adminEditingAvatar=employee.avatarUrl||'';
  $('adminEditProfileId').value=employee.uid||'';
  $('adminEditDisplayName').value=employee.name||employee.legalName||'';
  $('adminEditDiscordName').value=employee.discordName||'';
  $('adminEditStatusMessage').value=employee.statusMessage||'';
  $('adminEditBio').value=employee.bio||'';
  $('adminProfileEditStatus').textContent='';
  updateAdminProfileCharCount();
  previewAdminProfileAvatar();
  $('adminProfileEditModal').classList.remove('hidden');
  setTimeout(()=>$('adminEditDisplayName')?.focus(),80);
}
function closeAdminProfileEditor(){
  $('adminProfileEditModal')?.classList.add('hidden');
  adminEditingProfile=null;adminEditingAvatar='';
}
function updateAdminProfileCharCount(){
  if($('adminEditBioCount'))$('adminEditBioCount').textContent=`${($('adminEditBio')?.value||'').length} / 300`;
}
function previewAdminProfileAvatar(){
  const name=$('adminEditDisplayName')?.value.trim()||adminEditingProfile?.legalName||'従';
  setAvatarElement($('adminEditAvatarPreview'),adminEditingAvatar,(name||'従').slice(0,1));
}
async function handleAdminProfileAvatar(event){
  const file=event.target.files?.[0];if(!file)return;
  if(!file.type.startsWith('image/')){alert('画像ファイルを選択してください。');return}
  if(file.size>8*1024*1024){alert('画像は8MB以下にしてください。');return}
  try{adminEditingAvatar=await compressProfileImage(file);previewAdminProfileAvatar()}
  catch(error){console.error(error);alert('画像を読み込めませんでした。')}
  event.target.value='';
}
function removeAdminProfileAvatar(){adminEditingAvatar='';previewAdminProfileAvatar()}
async function saveAdminEditedProfile(){
  if(appMode!=='admin'||!adminEditingProfile)return;
  const displayName=$('adminEditDisplayName').value.trim();
  if(!displayName){alert('表示名を入力してください。');return}
  const button=$('adminProfileSaveButton'),status=$('adminProfileEditStatus');
  button.disabled=true;status.textContent='保存中…';
  const patch={
    display_name:displayName,
    avatar_url:adminEditingAvatar||null,
    bio:$('adminEditBio').value.trim(),
    discord_name:$('adminEditDiscordName').value.trim(),
    status_message:$('adminEditStatusMessage').value.trim(),
    updated_at:new Date().toISOString()
  };
  try{
    const {data,error}=await sb.from('profiles').update(patch).eq('id',adminEditingProfile.uid).select('*').single();
    if(error)throw error;
    updateEmployeeCacheFromProfile(data);
    await Promise.all([loadEmployees(),loadCommunityProfiles(false)]);
    renderEmployees();renderCommunityProfiles();renderDashboard();renderOnlinePresence();
    status.textContent='保存しました';
    toast(`${displayName}さんのプロフィールを更新しました`);
    await writeAudit('profile','従業員プロフィールを更新',`${displayName} / ${adminEditingProfile.id||''}`,displayName);
    setTimeout(closeAdminProfileEditor,650);
  }catch(error){
    console.error('管理者プロフィール編集エラー:',error);
    status.textContent='保存できませんでした';
    alert(`プロフィールの保存に失敗しました：${error.message||error}`);
  }finally{button.disabled=false}
}
document.addEventListener('input',event=>{if(event.target?.id==='adminEditDisplayName')previewAdminProfileAvatar()});

// ===== Premium 1.5: Community profiles, achievements and Discord daily report =====
achievementCatalog=[];
profileAchievements=[];

async function loadCommunityProfiles(showToast=false){
  try{
    const [catalogResult, awardsResult]=await Promise.all([
      sb.from('achievement_catalog').select('*').order('sort_order',{ascending:true}),
      sb.from('profile_achievements').select('*').order('awarded_at',{ascending:false})
    ]);
    if(catalogResult.error)throw catalogResult.error;
    if(awardsResult.error)throw awardsResult.error;
    achievementCatalog=catalogResult.data||[];
    profileAchievements=awardsResult.data||[];
    renderCommunityProfiles();
    if(showToast)toast('プロフィール一覧を更新しました');
  }catch(error){
    console.error('プロフィール一覧取得エラー:',error);
    const message=error.message?.includes('achievement_')?'実績追加SQLを先に実行してください。':`読み込みに失敗しました：${error.message}`;
    ['adminCommunityGrid','employeeCommunityGrid'].forEach(id=>{if($(id))$(id).innerHTML=`<div class="empty">${esc(message)}</div>`});
  }
}
function achievementsForProfile(profileId){
  return profileAchievements.filter(x=>x.profile_id===profileId).map(x=>({award:x,item:achievementCatalog.find(a=>a.id===x.achievement_id)})).filter(x=>x.item);
}
function profilePresence(profileId){
  const p=(onlinePresenceData||[]).find(x=>x.user_id===profileId);
  if(!p)return {label:'オフライン',cls:'offline'};
  return presenceState(p);
}
function communityCard(profile,isAdmin){
  const person=mapProfile(profile),awards=achievementsForProfile(profile.id),presence=profilePresence(profile.id),initial=(person.name||'?').slice(0,1);
  const avatar=person.avatarUrl?`<div class="community-avatar has-image" style="background-image:url('${esc(person.avatarUrl)}')">${esc(initial)}</div>`:`<div class="community-avatar">${esc(initial)}</div>`;
  const chips=awards.length?awards.map(x=>`<span class="achievement-chip ${isAdmin?'admin-removable':''}" title="${esc(x.item.description||'')}">${esc(x.item.icon||'🏆')} ${esc(x.item.name)}${isAdmin?`<button class="achievement-remove" type="button" title="実績を解除" aria-label="${esc(x.item.name)}を解除" onclick="revokeAchievement(${Number(x.award.id)},'${esc(profile.id)}','${esc(x.item.name)}')">×</button>`:''}</span>`).join(''):'<span class="achievement-empty">実績はまだありません</span>';
  const options=achievementCatalog.filter(a=>!awards.some(x=>x.item.id===a.id)).map(a=>`<option value="${esc(a.id)}">${esc(a.icon||'🏆')} ${esc(a.name)}</option>`).join('');
  const admin=isAdmin?`<div class="community-admin-actions"><button class="btn primary" onclick="openAdminProfileEditor('${profile.id}')">✎ プロフィール編集</button></div><div class="achievement-admin"><select id="achievementSelect-${profile.id}"><option value="">付与する実績を選択</option>${options}</select><button class="btn" onclick="grantAchievement('${profile.id}')">実績を付与</button></div>`:'';
  return `<article class="community-card"><div class="community-head">${avatar}<div class="community-name"><h3>${esc(person.name||person.legalName||'スタッフ')}</h3><p>${esc(person.role||'Cast')} ・ ${esc(person.id||'-')}</p></div></div><div class="community-status">${presence.cls==='online'?'🟢':presence.cls==='away'?'🟡':'⚫'} ${esc(presence.label)}${person.statusMessage?' ・ '+esc(person.statusMessage):''}</div><div class="community-bio">${esc(person.bio||'自己紹介はまだ設定されていません。')}</div><div class="achievement-list">${chips}</div><div class="community-discord">Discord：<b>${esc(person.discordName||'未設定')}</b></div>${admin}</article>`;
}
function renderCommunityProfiles(){
  const visible=(employees||[]).filter(x=>x.accountType!=='admin'||appMode==='admin');
  const profiles=visible.map(e=>({id:e.uid,display_name:e.name,employee_name:e.legalName||e.name,role:e.role,employee_id:e.id,account_type:e.accountType,avatar_url:e.avatarUrl,bio:e.bio,discord_name:e.discordName,status_message:e.statusMessage}));
  const html=profiles.length?profiles.map(p=>communityCard(p,appMode==='admin')).join(''):'<div class="empty">スタッフが登録されていません。</div>';
  if($('adminCommunityGrid'))$('adminCommunityGrid').innerHTML=html;
  if($('employeeCommunityGrid'))$('employeeCommunityGrid').innerHTML=html;
}
function profileNameForAction(profileId){
  const employee=employees.find(e=>e.uid===profileId);
  return employee?.name||employee?.legalName||'スタッフ';
}
achievementRealtimeChannel=null;
function achievementNoticeStorageKey(){return `lait-divin-achievement-notices-${currentProfile?.id||'guest'}`}
function loadLocalAchievementNotices(){
  if(!currentProfile?.id)return [];
  try{return JSON.parse(localStorage.getItem(achievementNoticeStorageKey())||'[]').slice(0,50)}catch(_){return []}
}
function saveLocalAchievementNotices(rows){
  if(!currentProfile?.id)return;
  try{localStorage.setItem(achievementNoticeStorageKey(),JSON.stringify(rows.slice(0,50)))}catch(_){}
}
function receiveAchievementNotice(payload){
  if(!payload||payload.target_profile_id!==currentProfile?.id)return;
  const notice={id:Number(payload.id||-Date.now()),type:payload.type||'success',title:payload.title||'🏆 実績のお知らせ',body:payload.body||'',is_pinned:false,is_active:true,target_profile_id:currentProfile.id,target_name:payload.target_name||currentProfile.display_name||currentProfile.employee_name||'あなた',created_by_name:payload.created_by_name||'Lait Divin',created_at:payload.created_at||new Date().toISOString(),local_only:true};
  const locals=loadLocalAchievementNotices().filter(x=>String(x.id)!==String(notice.id));
  saveLocalAchievementNotices([notice,...locals]);
  notificationRows=[notice,...notificationRows.filter(x=>String(x.id)!==String(notice.id))];
  renderNotifications();
  toast(notice.title.replace(/^🏆\s*/,''));
}
function ensureAchievementRealtimeSubscription(){
  if(!sb||!currentProfile?.id||achievementRealtimeChannel)return;
  const channelName=`achievement-user-${currentProfile.id}`;
  achievementRealtimeChannel=sb.channel(channelName,{config:{broadcast:{ack:true}}}).on('broadcast',{event:'achievement-notification'},({payload})=>receiveAchievementNotice(payload)).subscribe();
}
async function sendAchievementRealtime(profileId,payload){
  if(!sb||!profileId)return false;
  return await new Promise(resolve=>{
    const channel=sb.channel(`achievement-user-${profileId}`,{config:{broadcast:{ack:true}}});
    const timer=setTimeout(()=>{try{sb.removeChannel(channel)}catch(_){};resolve(false)},7000);
    channel.subscribe(async status=>{
      if(status==='SUBSCRIBED'){
        try{const result=await channel.send({type:'broadcast',event:'achievement-notification',payload});clearTimeout(timer);setTimeout(()=>{try{sb.removeChannel(channel)}catch(_){}},250);resolve(result==='ok')}
        catch(_){clearTimeout(timer);try{sb.removeChannel(channel)}catch(__){};resolve(false)}
      }
    });
  });
}
async function createAchievementNotification(profileId,mode,item){
  const targetName=profileNameForAction(profileId),granted=mode==='granted';
  const payload={id:-Date.now(),type:granted?'success':'general',title:granted?'🏆 実績を獲得しました':'🏆 実績が解除されました',body:granted?`${targetName}さんに「${item?.icon||'🏆'} ${item?.name||'実績'}」が付与されました。\nプロフィールから確認できます。`:`${targetName}さんの「${item?.icon||'🏆'} ${item?.name||'実績'}」が解除されました。`,target_profile_id:profileId,target_name:targetName,created_by_name:currentProfile?.display_name||currentProfile?.employee_name||'管理者',created_at:new Date().toISOString()};
  const sent=await sendAchievementRealtime(profileId,payload);
  if(currentProfile?.id===profileId)receiveAchievementNotice(payload);
  return sent;
}
async function grantAchievement(profileId){
  if(appMode!=='admin')return;
  const select=$(`achievementSelect-${profileId}`),achievementId=select?.value;
  if(!achievementId){alert('付与する実績を選択してください。');return}
  const item=achievementCatalog.find(x=>x.id===achievementId)||{id:achievementId,name:'実績',icon:'🏆'};
  const targetName=profileNameForAction(profileId);
  const {error}=await sb.from('profile_achievements').insert({profile_id:profileId,achievement_id:achievementId,awarded_by:currentProfile?.id||null});
  if(error){alert(error.code==='23505'?'この実績はすでに付与されています。':`付与できませんでした：${error.message}`);return}
  await Promise.all([
    createAchievementNotification(profileId,'granted',item),
    writeAudit('achievement','実績を付与',`${item.icon||'🏆'} ${item.name}`,targetName)
  ]);
  await Promise.all([loadCommunityProfiles(false),loadNotifications(false),loadAuditLogs(false)]);
  toast(`${targetName}さんに実績を付与し、通知しました`);
}
async function revokeAchievement(awardId,profileId,achievementName){
  if(appMode!=='admin')return;
  if(!confirm(`「${achievementName}」を解除しますか？`))return;
  const award=profileAchievements.find(x=>Number(x.id)===Number(awardId));
  const item=achievementCatalog.find(x=>x.id===award?.achievement_id)||{name:achievementName,icon:'🏆'};
  const targetName=profileNameForAction(profileId);
  const {error}=await sb.from('profile_achievements').delete().eq('id',awardId).eq('profile_id',profileId);
  if(error){alert(`実績を解除できませんでした：${error.message}`);return}
  await Promise.all([
    createAchievementNotification(profileId,'revoked',item),
    writeAudit('achievement','実績を解除',`${item.icon||'🏆'} ${item.name}`,targetName)
  ]);
  await Promise.all([loadCommunityProfiles(false),loadNotifications(false),loadAuditLogs(false)]);
  toast(`${targetName}さんの実績を解除し、通知しました`);
}
// 通知は重要度が高いため、Realtimeに加えて軽量な補助同期を残します。
setInterval(()=>{
  if(!currentProfile?.id||document.visibilityState!=='visible'||!navigator.onLine)return;
  loadNotifications(false);
  if(appMode==='admin')loadAuditLogs(false);
},10000);

function selectedDiscordReportDate(){
  const input=$('discordReportDateInput');
  if(input&&!input.value)input.value=iso(new Date());
  return input?.value||iso(new Date());
}
function reportDataForDate(dateKeyValue){
  const start=new Date(`${dateKeyValue}T00:00:00`),end=addDaysDate(start,1);
  const rows=dashboardSalesRows().filter(x=>(x.salesDate||'')===dateKeyValue);
  const sales=rows.reduce((sum,x)=>sum+(Number(x.amount)||0),0);
  const payroll=sumPayrollRange(start,end),profit=sales-payroll;
  const attendance=attendanceData.filter(a=>dateKey(a.clockIn)===dateKeyValue);
  const staff=new Set(attendance.map(a=>a.employeeUid||a.employeeId)).size;
  return {date:dateKeyValue,sales,profit,staff,entries:rows.length};
}
function renderDiscordReportPreview(){
  const date=selectedDiscordReportDate(),d=reportDataForDate(date);
  const label=new Date(`${date}T00:00:00`).toLocaleDateString('ja-JP');
  if($('discordReportDate'))$('discordReportDate').textContent=`${label} の売上レポート`;
  if($('discordPreviewSales'))$('discordPreviewSales').textContent=yen.format(d.sales);
  if($('discordPreviewProfit'))$('discordPreviewProfit').textContent=yen.format(d.profit);
  if($('discordPreviewStaff'))$('discordPreviewStaff').textContent=`${d.staff}名`;
  if($('discordPreviewEntries'))$('discordPreviewEntries').textContent=`${d.entries}件`;
}
async function sendDiscordDailyReport(){
  if(appMode!=='admin'){alert('管理者のみ送信できます。');return}
  const date=selectedDiscordReportDate();
  const button=$('discordSendButton'),status=$('discordLastResult');button.disabled=true;button.textContent='送信中…';
  try{
    const {data:{session}}=await sb.auth.getSession();if(!session)throw new Error('ログイン情報がありません。');
    const response=await fetch(`${cfg.SUPABASE_URL}/functions/v1/daily-sales-report`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`},body:JSON.stringify({source:'manual',date})});
    const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.error||`HTTP ${response.status}`);
    status.textContent=`最終送信：${new Date().toLocaleString('ja-JP')}（${date}分・成功）`;toast(`${date}の売上レポートをDiscordへ送信しました`);
  }catch(error){console.error(error);status.textContent=`送信失敗：${error.message}`;alert(`Discord送信に失敗しました：${error.message}`)}
  finally{button.disabled=false;button.textContent='選択日のレポートを送信'}
}



// ===== Ver.13.7 Sales Goals =====
async function loadSalesGoals(){
  if(!sb)return;
  try{
    const {data,error}=await sb.from('sales_goals').select('*').eq('id',1).maybeSingle();
    if(error)throw error;
    salesGoals={weekly:Number(data?.weekly_goal)||0,monthly:Number(data?.monthly_goal)||0};
    if($('weeklyGoalInput'))$('weeklyGoalInput').value=salesGoals.weekly||'';
    if($('monthlyGoalInput'))$('monthlyGoalInput').value=salesGoals.monthly||'';
    renderSalesGoals();
  }catch(error){console.warn('Sales goals load error:',error)}
}
function setGoalCard(prefix,current,target,period){
  const pct=target>0?Math.round(current/target*100):0,displayPct=Math.max(0,Math.min(pct,100));
  const currentEl=$(prefix+'Current'),targetEl=$(prefix+'Target'),pctEl=$(prefix+'Percent'),fill=$(prefix+'Fill'),remain=$(prefix+'Remain'),periodEl=$(prefix+'Period');
  if(currentEl)currentEl.textContent=yen.format(current);if(targetEl)targetEl.textContent=yen.format(target);if(pctEl)pctEl.textContent=`${pct}%`;
  if(fill){fill.style.width=`${displayPct}%`;fill.classList.toggle('done',target>0&&current>=target)}
  if(remain)remain.textContent=target<=0?'目標未設定':current>=target?`目標達成 +${yen.format(current-target)}`:`残り ${yen.format(target-current)}`;
  if(periodEl)periodEl.textContent=period;
}
function renderSalesGoals(){
  const now=new Date(),weekStart=startOfWeekDate(now),weekEnd=addDaysDate(weekStart,7),monthStart=new Date(now.getFullYear(),now.getMonth(),1),monthEnd=new Date(now.getFullYear(),now.getMonth()+1,1);
  const week=sumSalesRange(weekStart,weekEnd),month=sumSalesRange(monthStart,monthEnd);
  const weekPeriod=`${weekStart.getMonth()+1}/${weekStart.getDate()}〜${addDaysDate(weekEnd,-1).getMonth()+1}/${addDaysDate(weekEnd,-1).getDate()}`;
  const monthPeriod=`${now.getFullYear()}年${now.getMonth()+1}月`;
  setGoalCard('weeklyGoal',week,salesGoals.weekly,weekPeriod);setGoalCard('monthlyGoal',month,salesGoals.monthly,monthPeriod);
  setGoalCard('empWeeklyGoal',week,salesGoals.weekly,weekPeriod);setGoalCard('empMonthlyGoal',month,salesGoals.monthly,monthPeriod);
}
async function saveSalesGoals(){
  if(appMode!=='admin')return alert('管理者のみ変更できます。');
  const weekly=Math.max(0,Math.round(Number($('weeklyGoalInput')?.value)||0)),monthly=Math.max(0,Math.round(Number($('monthlyGoalInput')?.value)||0));
  const payload={id:1,weekly_goal:weekly,monthly_goal:monthly,updated_by:currentProfile?.id||null,updated_by_name:currentProfile?.display_name||currentProfile?.employee_name||'管理者',updated_at:new Date().toISOString()};
  const {error}=await sb.from('sales_goals').upsert(payload);if(error)return alert('売上目標を保存できませんでした：'+error.message);
  salesGoals={weekly,monthly};renderSalesGoals();await writeAudit('goal','売上目標を更新',`今週 ${yen.format(weekly)} / 今月 ${yen.format(monthly)}`);toast('売上目標を保存しました');
}

// ===== Ver.13.7 Audit Log =====
function auditIcon(type){return type==='sales'?'¥':type==='goal'?'🎯':type==='notification'?'🔔':type==='employee'?'♟':type==='achievement'?'🏆':type==='settings'?'⚙':'▦'}
async function writeAudit(type,action,detail='',targetName=''){
  if(!sb)return null;

  const canWriteAudit=
    appMode==='admin'||
    portalPermission('expense_approval')||
    portalPermission('inventory_approval')||
    portalPermission('farm_approval');

  if(!canWriteAudit)return null;

  const actorName=
    currentProfile?.display_name||
    currentProfile?.employee_name||
    currentEmployee?.name||
    currentEmployee?.legalName||
    '名称未設定';

  const payload={
    actor_id:currentProfile?.id||currentEmployee?.uid||null,
    actor_name:actorName,
    action_type:type||'other',
    action:action||'操作',
    detail:detail||'',
    target_name:targetName||null,
    created_at:new Date().toISOString()
  };

  try{
    const {error}=await sb.from('audit_logs').insert(payload);
    if(error)throw error;

    // 管理者画面を開いている場合は即時更新。
    // 従業員が操作した履歴はRealtimeで管理者側にも反映されます。
    if(appMode==='admin')await loadAuditLogs(false);
    return true;
  }catch(error){
    console.error('Audit write error:',error);

    if(appMode==='admin'){
      const fallback={id:`local-${Date.now()}`,...payload};
      auditRows=[fallback,...auditRows];
      renderAuditLogs();
      toast(`管理履歴のDB保存に失敗：${error.message||'権限を確認してください'}`);
    }
    return false;
  }
}
async function loadAuditLogs(show=false){
  if(!sb||appMode!=='admin')return;
  try{const {data,error}=await sb.from('audit_logs').select('*').order('created_at',{ascending:false}).limit(500);if(error)throw error;auditRows=data||[];renderAuditLogs();if(show)toast('管理履歴を更新しました')}catch(error){console.error(error);if(show)alert('管理履歴を取得できませんでした：'+error.message)}
}
function auditTypeLabel(type){
  return ({
    sales:'売上',
    goal:'売上目標',
    notification:'通知',
    employee:'従業員',
    profile:'プロフィール',
    achievement:'実績',
    settings:'設定',
    inventory:'在庫',
    farm:'Farm',
    expense:'経費',
    job_account:'ジョブ口座'
  })[type]||type||'その他';
}

function renderAuditLogs(){
  const box=$('auditLogList');
  if(!box)return;

  const type=$('auditTypeFilter')?.value||'';
  const query=($('auditSearch')?.value||'').trim().toLowerCase();

  const rows=auditRows.filter(row=>
    (!type||row.action_type===type)&&
    (!query||`${row.actor_name} ${row.action} ${row.detail||''} ${row.target_name||''}`.toLowerCase().includes(query))
  );

  box.innerHTML=rows.length
    ?rows.map(row=>`
      <article class="audit-row audit-row-clickable"
        tabindex="0"
        role="button"
        onclick="openAuditDetail('${String(row.id).replace(/'/g,"\\'")}')"
        onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openAuditDetail('${String(row.id).replace(/'/g,"\\'")}')}">
        <div class="audit-icon">${auditIcon(row.action_type)}</div>
        <div>
          <h3>${esc(row.action||'操作')} <small>— ${esc(row.actor_name||'管理者')}</small></h3>
          <p>${esc(row.detail||row.target_name||'詳細を見るにはタップしてください')}</p>
        </div>
        <div class="audit-time">
          ${new Date(row.created_at).toLocaleString('ja-JP')}
          <span class="audit-detail-hint">詳細を見る ›</span>
        </div>
      </article>`).join('')
    :'<div class="audit-empty">管理履歴はありません。</div>';
}

function openAuditDetail(id){
  const row=auditRows.find(item=>String(item.id)===String(id));
  if(!row)return;

  window.currentAuditDetail=row;

  $('auditDetailIcon').textContent=auditIcon(row.action_type);
  $('auditDetailTitle').textContent='管理履歴の詳細';
  $('auditDetailAction').textContent=row.action||'操作';
  $('auditDetailDate').textContent=row.created_at
    ?new Date(row.created_at).toLocaleString('ja-JP')
    :'-';
  $('auditDetailActor').textContent=row.actor_name||'管理者';
  $('auditDetailType').textContent=auditTypeLabel(row.action_type);
  $('auditDetailTarget').textContent=row.target_name||'指定なし';
  $('auditDetailId').textContent=String(row.id??'-');
  $('auditDetailText').textContent=row.detail||'コメント・詳細は登録されていません。';

  $('auditDetailModal').classList.remove('hidden');
  document.body.style.overflow='hidden';
}

function closeAuditDetailModal(event){
  if(event&&event.target!==$('auditDetailModal'))return;
  $('auditDetailModal')?.classList.add('hidden');
  document.body.style.overflow='';
}

async function copyAuditDetail(){
  const row=window.currentAuditDetail;
  if(!row)return;

  const copyText=[
    `日時：${row.created_at?new Date(row.created_at).toLocaleString('ja-JP'):'-'}`,
    `操作した人：${row.actor_name||'管理者'}`,
    `種類：${auditTypeLabel(row.action_type)}`,
    `操作：${row.action||'操作'}`,
    `対象：${row.target_name||'指定なし'}`,
    `詳細・コメント：${row.detail||'なし'}`
  ].join('\n');

  try{
    await navigator.clipboard.writeText(copyText);
    toast('管理履歴の詳細をコピーしました');
  }catch(error){
    alert(copyText);
  }
}
function exportAuditCsv(){const rows=auditRows.map(r=>[new Date(r.created_at).toLocaleString('ja-JP'),r.actor_name,r.action_type,r.action,r.target_name||'',r.detail||'']);const table=[['日時','操作した人','種類','操作','対象','詳細'],...rows];const csv='\ufeff'+table.map(row=>row.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\r\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`Lait_Divin_管理履歴_${dateInputLocal(new Date())}.csv`;a.click();URL.revokeObjectURL(a.href)}

// ===== Ver.13.7 Notification Center =====
notificationRows=[];
notificationReadIds=new Set();
function notificationTypeLabel(type){return type==='update'?'アップデート':type==='important'?'重要':type==='success'?'完了・報告':'一般通知'}
function notificationIcon(type){return type==='update'?'📢':type==='important'?'⚠️':type==='success'?'✅':'🔔'}
function formatNotificationDate(v){return v?new Date(v).toLocaleString('ja-JP',{year:'numeric',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):'-'}
function renderNotifications(){
  const allSorted=[...notificationRows].sort((a,b)=>(Number(b.is_pinned)-Number(a.is_pinned))||new Date(b.created_at)-new Date(a.created_at));
  const unread=allSorted.filter(n=>!notificationReadIds.has(String(n.id))).length;
  ['adminNotificationBadge','adminTopNotificationBadge','adminMobileNotificationBadge','employeeNotificationBadge','employeeTopNotificationBadge','employeeMobileNotificationBadge'].forEach(id=>{const el=$(id);if(!el)return;el.textContent=unread>99?'99+':String(unread);el.classList.toggle('hidden',unread===0)});

  const q=($('notificationSearch')?.value||'').trim().toLowerCase();
  const typeFilter=$('notificationFilterType')?.value||'';
  const pinnedOnly=!!$('notificationPinnedOnly')?.checked;
  const adminRows=allSorted.filter(n=>
    (!typeFilter||String(n.type||'general')===typeFilter)&&
    (!pinnedOnly||!!n.is_pinned)&&
    (!q||`${n.title||''} ${n.body||''} ${n.created_by_name||''}`.toLowerCase().includes(q))
  );

  const makeHtml=(rows,isAdmin)=>rows.length?rows.map(n=>{
    const numericId=Number(n.id),isLocal=numericId<0,isUnread=!notificationReadIds.has(String(n.id));
    const editButton=isAdmin&&!isLocal?`<button class="btn notification-edit-btn" onclick="startNotificationEdit(${numericId}, event)">✎ 編集</button>`:'';
    const deleteButton=isAdmin&&!isLocal?`<button class="btn danger notification-delete-btn" onclick="deleteNotification(${numericId}, event)">削除</button>`:'';
    return `<article class="notification-card ${esc(n.type||'general')} ${isUnread?'unread':''}">
      <div class="notification-head"><h3>${notificationIcon(n.type)} ${esc(n.title||'お知らせ')}${n.is_pinned?' 📌':''}</h3><small>${formatNotificationDate(n.updated_at||n.created_at)}${n.updated_at?'（編集済み）':''}</small></div>
      <div class="notification-body">${esc(n.body||'')}</div>
      <div class="notification-meta"><span class="notification-type">${notificationTypeLabel(n.type)}</span><span>投稿者：${esc(n.created_by_name||'Lait Divin')}</span>${n.discord_kind?`<span>Discord：${n.discord_kind==='inventory'?'在庫チャンネル':'通知チャンネル'}</span>`:''}</div>
      <div class="notification-actions">${isUnread?`<button class="btn" onclick="markNotificationRead(${numericId})">既読にする</button>`:''}${editButton}${deleteButton}</div>
    </article>`;
  }).join(''):'<div class="notification-empty">条件に一致する通知はありません。</div>';

  const employeeQ=($('employeeNotificationSearch')?.value||'').trim().toLowerCase();
  const employeeType=$('employeeNotificationFilterType')?.value||'';
  const employeePinnedOnly=!!$('employeeNotificationPinnedOnly')?.checked;
  const employeeRows=allSorted.filter(n=>
    (!employeeType||String(n.type||'general')===employeeType)&&
    (!employeePinnedOnly||!!n.is_pinned)&&
    (!employeeQ||`${n.title||''} ${n.body||''} ${n.created_by_name||''}`.toLowerCase().includes(employeeQ))
  );

  if($('adminNotificationList'))$('adminNotificationList').innerHTML=makeHtml(adminRows,true);
  if($('adminNotificationCount'))$('adminNotificationCount').textContent=`${adminRows.length}件`;
  if($('employeeNotificationList'))$('employeeNotificationList').innerHTML=makeHtml(employeeRows,false);
  if($('employeeNotificationCount'))$('employeeNotificationCount').textContent=`${employeeRows.length}件`;
}
async function loadNotifications(show=false){
  if(!sb||!currentProfile?.id)return;
  try{
    const [{data:notices,error:ne},{data:reads,error:re}]=await Promise.all([sb.from('notifications').select('*').eq('is_active',true).order('is_pinned',{ascending:false}).order('created_at',{ascending:false}).limit(100),sb.from('notification_reads').select('notification_id').eq('profile_id',currentProfile.id)]);
    if(ne)throw ne;if(re)throw re;ensureAchievementRealtimeSubscription();const locals=loadLocalAchievementNotices();notificationRows=[...locals,...(notices||[])].filter((x,i,a)=>a.findIndex(y=>String(y.id)===String(x.id))===i);notificationReadIds=new Set((reads||[]).map(x=>String(x.notification_id)));try{JSON.parse(localStorage.getItem(`${achievementNoticeStorageKey()}-reads`)||'[]').forEach(x=>notificationReadIds.add(String(x)))}catch(_){}renderNotifications();if(show)toast('通知を更新しました');
  }catch(error){console.error('Notification load error',error);if(show)alert('通知を取得できませんでした：'+error.message)}
}
function saveLocalNotificationRead(id){
  notificationReadIds.add(String(id));
  const key=`${achievementNoticeStorageKey()}-reads`;
  try{const saved=new Set(JSON.parse(localStorage.getItem(key)||'[]'));saved.add(String(id));localStorage.setItem(key,JSON.stringify([...saved]))}catch(_){}
}
async function markNotificationRead(id){
  if(!currentProfile?.id)return;
  const numericId=Number(id);
  if(!Number.isFinite(numericId))return;
  if(numericId<0){saveLocalNotificationRead(numericId);renderNotifications();return}
  if(notificationReadIds.has(String(numericId))){renderNotifications();return}
  const row={notification_id:numericId,profile_id:currentProfile.id,read_at:new Date().toISOString()};
  const {error}=await sb.from('notification_reads').insert(row);
  // 23505 / HTTP 409 は、別タブ等ですでに既読登録済みのため成功扱いにします。
  if(error&&error.code!=='23505'){
    console.error('Notification read insert error',error);
    return alert('既読にできませんでした：'+error.message);
  }
  notificationReadIds.add(String(numericId));renderNotifications();
}
async function markAllNotificationsRead(){
  if(!currentProfile?.id||!notificationRows.length)return;
  const localRows=notificationRows.filter(n=>Number(n.id)<0&&!notificationReadIds.has(String(n.id)));
  localRows.forEach(n=>saveLocalNotificationRead(n.id));
  const dbIds=notificationRows
    .map(n=>Number(n.id))
    .filter(id=>Number.isFinite(id)&&id>0&&!notificationReadIds.has(String(id)));
  if(dbIds.length){
    const now=new Date().toISOString();
    // 一括upsertは環境によって409になるため、未読分のみinsertし、重複は成功扱いにします。
    const results=await Promise.all(dbIds.map(async notification_id=>{
      const {error}=await sb.from('notification_reads').insert({notification_id,profile_id:currentProfile.id,read_at:now});
      if(error&&error.code!=='23505')return {notification_id,error};
      return {notification_id,error:null};
    }));
    const failed=results.filter(x=>x.error);
    results.filter(x=>!x.error).forEach(x=>notificationReadIds.add(String(x.notification_id)));
    if(failed.length){
      console.error('Mark all notifications read errors',failed);
      renderNotifications();
      return alert(`一部の通知を既読にできませんでした（${failed.length}件）。`);
    }
  }
  renderNotifications();toast('すべて既読にしました');
}
async function deleteNotification(id,event){
  if(event)event.stopPropagation();
  if(appMode!=='admin')return alert('通知を削除できるのは管理者のみです。');
  const target=notificationRows.find(n=>Number(n.id)===Number(id));
  if(!target)return;
  if(!confirm(`「${target.title||'この通知'}」を削除しますか？\nDiscord側のメッセージが既に消えている場合でも、サイト内通知は削除されます。`))return;

  let discordDeleteFailed=false;
  let discordErrorMessage='';
  try{
    await syncNotificationDiscord(target,'delete');
  }catch(error){
    discordDeleteFailed=true;
    discordErrorMessage=error?.message||String(error);
    console.warn('Discord message delete skipped/failed; continuing site deletion.',error);
  }

  const {error}=await sb.from('notifications').delete().eq('id',id);
  if(error)return alert('サイト内通知を削除できませんでした：'+error.message+'\nSQLの削除権限追加が実行済みか確認してください。');

  notificationRows=notificationRows.filter(n=>Number(n.id)!==Number(id));
  notificationReadIds.delete(String(id));
  renderNotifications();
  await writeAudit(
    'notification',
    '通知を削除',
    target.title||'',
    discordDeleteFailed?`Discord削除失敗後にサイトのみ削除：${discordErrorMessage}`:(target.title||'')
  );

  if(discordDeleteFailed){
    toast('Discord側は見つからなかったため、サイト内通知だけ削除しました');
  }else{
    toast('サイト内通知とDiscordから削除しました');
  }
}

async function callNotificationDiscordFunction(payload){
  const response=await fetch(`${cfg.SUPABASE_URL}/functions/v1/notification-discord-manager`,{
    method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify(payload)
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok||!data?.ok)throw new Error(data?.error||`HTTP ${response.status}`);
  return data;
}
async function syncNotificationDiscord(target,action,values={}){
  const messageId=String(target?.discord_message_id||'').trim();
  const kind=String(target?.discord_kind||'').trim();
  if(!messageId||!kind)return {skipped:true};
  if(kind==='inventory'){
    return callInventoryDiscordFunction({
      action,message_id:messageId,
      generic_title:values.title||target.title||'在庫管理からのお知らせ',
      generic_body:values.body||target.body||'',
      sent_by:currentProfile?.display_name||currentProfile?.employee_name||currentEmployee?.name||'管理者'
    });
  }
  return callNotificationDiscordFunction({
    action,message_id:messageId,
    title:values.title||target.title||'お知らせ',
    body:values.body||target.body||'',
    type:values.type||target.type||'general',
    sent_by:currentProfile?.display_name||currentProfile?.employee_name||currentEmployee?.name||'管理者'
  });
}

function resetNotificationEditor(){
  $('notificationEditId').value='';
  $('notificationType').value='general';
  $('notificationTitle').value='';
  $('notificationBody').value='';
  $('notificationPinned').checked=false;
  $('notificationEditorEyebrow').textContent='NEW NOTICE';
  $('notificationEditorTitle').textContent='新しい通知を送信';
  $('notificationSendButton').textContent='サイト内＋Discordへ新規送信';
  $('notificationCancelEditButton').classList.add('hidden');
  $('notificationEditorNote').textContent='新規・編集・削除は、サイト内通知と送信先Discordチャンネルへ同時反映されます。';
}
function startNotificationEdit(id,event){
  if(event)event.stopPropagation();
  const target=notificationRows.find(n=>Number(n.id)===Number(id));
  if(!target||Number(target.id)<0)return alert('この通知は編集できません。');
  $('notificationEditId').value=String(target.id);
  $('notificationType').value=target.type||'general';
  $('notificationTitle').value=target.title||'';
  $('notificationBody').value=target.body||'';
  $('notificationPinned').checked=!!target.is_pinned;
  $('notificationEditorEyebrow').textContent='EDIT NOTICE';
  $('notificationEditorTitle').textContent='通知を編集';
  $('notificationSendButton').textContent='変更内容をサイトへ保存';
  $('notificationCancelEditButton').classList.remove('hidden');
  $('notificationEditorNote').textContent='編集内容はサイト内通知と、送信先のDiscordチャンネルへ同時反映されます。';
  document.querySelector('.notification-composer')?.scrollIntoView({behavior:'smooth',block:'start'});
}
function cancelNotificationEdit(){resetNotificationEditor()}
async function updateSiteNotification(){
  const id=Number($('notificationEditId').value);
  const title=$('notificationTitle').value.trim(),body=$('notificationBody').value.trim();
  const type=$('notificationType').value||'general',isPinned=!!$('notificationPinned').checked;
  if(!id||!title||!body)return alert('タイトルと本文を入力してください。');

  const btn=$('notificationSendButton');
  btn.disabled=true;
  btn.textContent='保存中…';

  try{
    const target=notificationRows.find(n=>Number(n.id)===id);
    if(!target)throw new Error('編集対象の通知が見つかりません。');

    // updated_at列が存在しない環境でも保存できるよう、
    // 通知テーブルに確実に存在する項目だけを更新します。
    const updatePayload={
      title,
      body,
      type,
      is_pinned:isPinned
    };

    const {error}=await sb
      .from('notifications')
      .update(updatePayload)
      .eq('id',id);

    if(error)throw error;

    // 保存直後に管理者側・従業員側の両方へ同じ内容を描画します。
    const clientUpdatedAt=new Date().toISOString();
    notificationRows=notificationRows.map(n=>
      Number(n.id)===id
        ?{...n,...updatePayload,updated_at:clientUpdatedAt}
        :n
    );
    renderNotifications();

    // Discord側の編集に失敗しても、サイト内の保存は取り消しません。
    let discordUpdated=true;
    let discordErrorMessage='';
    try{
      await syncNotificationDiscord(target,'edit',{title,body,type});
    }catch(discordError){
      discordUpdated=false;
      discordErrorMessage=discordError?.message||String(discordError);
      console.warn('Discord notification edit failed; site update was kept.',discordError);
    }

    // DBの最新状態を再取得。Realtimeでも他の管理者・従業員へ反映されます。
    await loadNotifications(false);

    await writeAudit(
      'notification',
      '通知を編集',
      `${title} / 固定：${isPinned?'ON':'OFF'}`,
      discordUpdated?title:`サイト保存済み・Discord編集失敗：${discordErrorMessage}`
    );

    resetNotificationEditor();

    if(discordUpdated){
      toast(isPinned
        ?'通知を保存し、固定しました'
        :'通知を保存し、固定を解除しました'
      );
    }else{
      toast(isPinned
        ?'サイト内通知を保存・固定しました（Discord編集は失敗）'
        :'サイト内通知を保存・固定解除しました（Discord編集は失敗）'
      );
    }
  }catch(error){
    console.error('Notification update error',error);
    alert('通知を保存できませんでした：'+(error?.message||error));
  }finally{
    btn.disabled=false;
    if(!$('notificationEditId').value){
      btn.textContent='サイト内＋Discordへ新規送信';
    }else{
      btn.textContent='変更内容をサイトへ保存';
    }
  }
}
async function saveNotificationFromEditor(){
  if(Number($('notificationEditId').value)>0)return updateSiteNotification();
  return sendSiteAndDiscordNotification();
}

async function sendSiteAndDiscordNotification(){
  if(appMode!=='admin')return alert('管理者のみ送信できます。');
  const title=$('notificationTitle')?.value.trim(),body=$('notificationBody')?.value.trim(),type=$('notificationType')?.value||'general',isPinned=!!$('notificationPinned')?.checked;
  if(!title||!body)return alert('タイトルと本文を入力してください。');
  const btn=$('notificationSendButton');btn.disabled=true;btn.textContent='送信中…';
  try{
    const discord=await callNotificationDiscordFunction({action:'send',title,body,type,sent_by:currentProfile?.display_name||currentProfile?.employee_name||'管理者'});
    const payload={title,body,type,is_pinned:isPinned,created_by:currentProfile?.id||null,created_by_name:currentProfile?.display_name||currentProfile?.employee_name||'管理者',discord_message_id:discord.message_id||null,discord_kind:'notification'};
    const {data:notice,error}=await sb.from('notifications').insert(payload).select().single();if(error)throw error;
    resetNotificationEditor();await loadNotifications(false);await writeAudit('notification','通知を送信',`${notificationTypeLabel(type)} / ${title}`,title);toast('サイト内＋Discordへ送信しました');
  }catch(error){console.error(error);alert(`送信に失敗しました：${error.message}\nサイト内だけ保存されている可能性があります。`);await loadNotifications(false)}finally{btn.disabled=false;if(!$('notificationEditId')?.value)btn.textContent='サイト内＋Discordへ新規送信'}
}


/* =========================================================
   SOURCE: ui-enhancements.js
========================================================= */
(function(){
  function syncMobileNotificationBadges(){
    const pairs=[
      ['adminNotificationBadge','adminMobileNotificationBadge'],
      ['adminTopNotificationBadge','adminMobileNotificationBadge'],
      ['employeeNotificationBadge','employeeMobileNotificationBadge'],
      ['employeeTopNotificationBadge','employeeMobileNotificationBadge']
    ];
    pairs.forEach(([sourceId,targetId])=>{
      const source=document.getElementById(sourceId);
      const target=document.getElementById(targetId);
      if(!source||!target)return;
      target.textContent=source.textContent||'0';
      target.classList.toggle('hidden',source.classList.contains('hidden')||Number(source.textContent||0)<=0);
    });
  }
  const observer=new MutationObserver(syncMobileNotificationBadges);
  window.addEventListener('DOMContentLoaded',()=>{
    ['adminNotificationBadge','adminTopNotificationBadge','adminMobileNotificationBadge','employeeNotificationBadge','employeeTopNotificationBadge','employeeMobileNotificationBadge'].forEach(id=>{
      const el=document.getElementById(id);
      if(el)observer.observe(el,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class']});
    });
    setTimeout(syncMobileNotificationBadges,300);
    setInterval(syncMobileNotificationBadges,1500);
  });
})();


/* =========================================================
   SOURCE: features.js
========================================================= */
(function(){
  function forceDarkMode(){
    if(!document.body) return;
    document.body.classList.add('dark');
    try{ localStorage.setItem('ld_theme','dark'); }catch(e){}
    document.documentElement.setAttribute('data-theme','dark');
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta) meta.setAttribute('content','#121418');
    document.querySelectorAll('.theme-toggle,.mobile-theme-button,.v41-login-theme').forEach(el=>el.remove());
    document.querySelectorAll('button').forEach(btn=>{
      const txt=(btn.textContent||'').replace(/\s+/g,'');
      if(txt.includes('テーマ切替')||txt.includes('ライトモードに変更')||txt.includes('ダークモードに変更')){
        const wrap = btn.closest('.mobile-menu-item,.menu-item,li,.sidebar-item,.sidebar-link,.mobile-menu-card');
        if(wrap && wrap !== document.body && wrap.textContent.replace(/\s+/g,'').includes(txt)) wrap.style.display='none';
        else btn.style.display='none';
      }
    });
  }
  const oldToggle = window.toggleTheme;
  window.toggleTheme = function(){ forceDarkMode(); if(typeof toast==='function') toast('ダークモード固定です'); };
  const oldInit = window.initTheme;
  window.initTheme = function(){ if(typeof oldInit==='function'){ try{ oldInit(); }catch(e){} } forceDarkMode(); };
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', function(){ forceDarkMode(); setTimeout(forceDarkMode,100); setTimeout(forceDarkMode,800); });
  }else{ forceDarkMode(); setTimeout(forceDarkMode,100); }
})();


/* ===== Ver.17.2 Campaign Manager ===== */
campaignData=[];
function campaignStatus(item){
  const today=new Date();today.setHours(0,0,0,0);
  const start=item.start_date?new Date(item.start_date+'T00:00:00'):null;
  const end=item.end_date?new Date(item.end_date+'T23:59:59'):null;
  if(start&&today<start)return {key:'upcoming',label:'開催予定'};
  if(end&&today>end)return {key:'ended',label:'終了'};
  return {key:'active',label:'開催中'};
}
function campaignPercent(item){const goal=Number(item.goal_sales)||0,current=Number(item.current_sales)||0;return goal>0?Math.max(0,Math.min(100,Math.round(current/goal*100))):0}
function campaignDateRange(item){const s=item.start_date?jp(item.start_date):'未設定',e=item.end_date?jp(item.end_date):'未設定';return `${s} ～ ${e}`}
async function loadCampaigns(showToast=false){
  const adminList=$('campaignAdminList'),employeeList=$('campaignEmployeeList');
  try{
    if(!sb)throw new Error('Supabaseへ接続できていません');
    const {data,error}=await sb.from('store_campaigns').select('*').order('start_date',{ascending:false}).order('created_at',{ascending:false});
    if(error)throw error;
    campaignData=data||[];renderCampaigns();if(showToast)toast('イベント情報を更新しました');
  }catch(error){
    console.warn('イベント読込エラー:',error);
    const message=`イベント機能の準備が完了していません。付属SQLを実行してください。`;
    if(adminList)adminList.innerHTML=`<div class="campaign-empty">${message}</div>`;
    if(employeeList)employeeList.innerHTML=`<div class="campaign-empty">現在、イベント情報を取得できません。</div>`;
    if(showToast)toast(message);
  }
}
function renderCampaigns(){
  const adminList=$('campaignAdminList'),employeeList=$('campaignEmployeeList');
  if(adminList){
    adminList.innerHTML=campaignData.length?campaignData.map(item=>{const s=campaignStatus(item),pct=campaignPercent(item);return `<article class="campaign-card"><div class="campaign-card-head"><div><small>${esc(item.products||'店舗イベント')}</small><h3>${esc(item.title)}</h3></div><span class="campaign-status ${s.key}">${s.label}</span></div><p>${esc(item.description||'説明はありません。')}</p><div class="campaign-meta"><span>📅 ${campaignDateRange(item)}</span><span>🎯 ${yen.format(Number(item.goal_sales)||0)}</span><span>💰 ${yen.format(Number(item.current_sales)||0)}</span><span>${item.is_published?'公開中':'非公開'}</span></div><div class="campaign-progress"><i style="width:${pct}%"></i></div><div class="campaign-meta"><span>達成率 ${pct}%</span></div><div class="campaign-actions"><button class="btn" onclick="editCampaign('${item.id}')">編集</button><button class="btn danger" onclick="deleteCampaign('${item.id}')">削除</button></div></article>`}).join(''):'<div class="campaign-empty">まだイベントは登録されていません。</div>';
  }
  if(employeeList){
    const publicItems=campaignData.filter(x=>x.is_published);
    employeeList.innerHTML=publicItems.length?publicItems.map(item=>{const s=campaignStatus(item),pct=campaignPercent(item);return `<article class="campaign-employee-card"><div class="campaign-badge-row"><small>${esc(item.products||'店舗イベント')}</small><span class="campaign-status ${s.key}">${s.label}</span></div><h3>${esc(item.title)}</h3><p>${esc(item.description||'詳細は管理者へご確認ください。')}</p><div class="campaign-meta"><span>📅 ${campaignDateRange(item)}</span><span>達成率 ${pct}%</span></div><div class="campaign-progress"><i style="width:${pct}%"></i></div></article>`}).join(''):'<div class="campaign-empty">現在公開中のイベントはありません。</div>';
  }
}
function resetCampaignForm(){['campaignId','campaignTitle','campaignStart','campaignEnd','campaignProducts','campaignGoal','campaignCurrent','campaignDescription'].forEach(id=>{const el=$(id);if(el)el.value=''});if($('campaignPublished'))$('campaignPublished').checked=true}
function editCampaign(id){const item=campaignData.find(x=>String(x.id)===String(id));if(!item)return;$('campaignId').value=item.id;$('campaignTitle').value=item.title||'';$('campaignStart').value=item.start_date||'';$('campaignEnd').value=item.end_date||'';$('campaignProducts').value=item.products||'';$('campaignGoal').value=Number(item.goal_sales)||0;$('campaignCurrent').value=Number(item.current_sales)||0;$('campaignDescription').value=item.description||'';$('campaignPublished').checked=!!item.is_published;window.scrollTo({top:0,behavior:'smooth'})}
async function saveCampaign(){
  const title=$('campaignTitle')?.value.trim();if(!title){alert('イベント名を入力してください');return}
  const start=$('campaignStart')?.value||null,end=$('campaignEnd')?.value||null;if(start&&end&&end<start){alert('終了日は開始日以降にしてください');return}
  const payload={title,start_date:start,end_date:end,products:$('campaignProducts')?.value.trim()||'',goal_sales:Number($('campaignGoal')?.value)||0,current_sales:Number($('campaignCurrent')?.value)||0,description:$('campaignDescription')?.value.trim()||'',is_published:!!$('campaignPublished')?.checked,updated_at:new Date().toISOString()};
  try{
    const id=$('campaignId')?.value;let result;
    if(id)result=await sb.from('store_campaigns').update(payload).eq('id',id);else result=await sb.from('store_campaigns').insert(payload);
    if(result.error)throw result.error;resetCampaignForm();await loadCampaigns(false);toast(id?'イベントを更新しました':'イベントを登録しました');
  }catch(error){console.error('イベント保存エラー:',error);alert('保存できませんでした。付属SQLが実行済みか確認してください。\n'+(error.message||''))}
}
async function deleteCampaign(id){if(!confirm('このイベントを削除しますか？'))return;try{const {error}=await sb.from('store_campaigns').delete().eq('id',id);if(error)throw error;await loadCampaigns(false);toast('イベントを削除しました')}catch(error){console.error('イベント削除エラー:',error);alert('削除できませんでした。'+(error.message||''))}}



function jobTransactionTypeLabel(type){
  return ({auto_sales:'売上自動反映',manual_balance:'残高調整',bonus:'ボーナス・支給',deposit:'入金',withdrawal:'出金',expense:'承認済み経費',adjustment:'その他調整'})[type]||type||'取引';
}
function jobTransactionIcon(type){
  return ({auto_sales:'📈',manual_balance:'⚖',bonus:'🎁',deposit:'＋',withdrawal:'－',expense:'🧾',adjustment:'✎'})[type]||'¥';
}
function expenseStatusLabel(status){return ({pending:'申請中',approved:'承認済み',rejected:'却下'})[status]||status}
function jobAccountBalance(){return jobAccountTransactions.reduce((sum,row)=>sum+(Number(row.amount)||0),0)}
function getJobSelectedSalesDate(){
  return $('jobAutoSourceDate')?.value||iso(new Date());
}
function todaySalesAmount(targetDate=null){
  const selectedDate=targetDate||getJobSelectedSalesDate();
  return (salesData||[])
    .filter(row=>String(row.salesDate||'')===String(selectedDate))
    .reduce((sum,row)=>sum+(Number(row.amount)||0),0);
}
function previewJobAutoTransfer(){
  const rate=Math.max(1,Math.min(10,Number($('jobAutoRate')?.value||jobAccountSettings.autoRate||10)));
  const selectedDate=getJobSelectedSalesDate();
  const sales=todaySalesAmount(selectedDate),amount=Math.round(sales*rate/10);
  if($('jobAutoRateValue'))$('jobAutoRateValue').textContent=`${rate}割（${rate*10}%）`;
  if($('jobCalcSales'))$('jobCalcSales').textContent=yen.format(sales);
  if($('jobCalcRate'))$('jobCalcRate').textContent=`${rate*10}%`;
  if($('jobCalcResult'))$('jobCalcResult').textContent=yen.format(amount);
  if($('jobTodayAutoAmount'))$('jobTodayAutoAmount').textContent=yen.format(amount);
  if($('jobAutoRateSummary'))$('jobAutoRateSummary').textContent=`${jp(selectedDate)}の売上 ${rate}割`;
  if($('jobSelectedSalesLabel'))$('jobSelectedSalesLabel').textContent=`${jp(selectedDate)} の売上履歴と連携`;
  if($('jobCalcDateLabel'))$('jobCalcDateLabel').textContent=`${jp(selectedDate)} の売上`;
  const selectedAuto=jobAccountTransactions.find(x=>x.type==='auto_sales'&&x.sourceDate===selectedDate);
  if($('jobAutoStatusBadge')){
    $('jobAutoStatusBadge').textContent=selectedAuto?`反映済み ${yen.format(selectedAuto.amount)}`:'未反映';
    $('jobAutoStatusBadge').classList.toggle('success',!!selectedAuto);
  }
}
async function loadJobAccountData(showToast=false){
  if(!sb||appMode!=='admin')return;
  try{
    const [settingsResult,transactionsResult]=await Promise.all([
      sb.from('job_account_settings').select('*').eq('id',1).maybeSingle(),
      sb.from('job_account_transactions').select('*').order('transaction_date',{ascending:false}).order('created_at',{ascending:false})
    ]);
    if(settingsResult.error)throw settingsResult.error;
    if(transactionsResult.error)throw transactionsResult.error;
    const s=settingsResult.data;
    jobAccountSettings={autoRate:Number(s?.auto_sales_rate)||10,updatedAt:s?.updated_at||null};
    jobAccountTransactions=(transactionsResult.data||[]).map(x=>({
      id:x.id,date:x.transaction_date,type:x.transaction_type,amount:Number(x.amount)||0,
      description:x.description||'',sourceDate:x.source_date||'',expenseRequestId:x.expense_request_id,
      createdBy:x.created_by_name||'管理者',createdAt:x.created_at
    }));
    renderJobAccount();
    if(showToast)toast('ジョブ口座を更新しました');
  }catch(error){
    console.error('Job account load error',error);
    if(showToast)alert('ジョブ口座を取得できませんでした。SQLの実行状況を確認してください。\n'+error.message);
  }
}
function renderJobAccount(){
  if(!$('jobAccountBalance'))return;
  if($('jobAutoSourceDate')&&!$('jobAutoSourceDate').value)$('jobAutoSourceDate').value=iso(new Date());
  const selectedDate=getJobSelectedSalesDate();
  const balance=jobAccountBalance(),sales=todaySalesAmount(selectedDate),rate=jobAccountSettings.autoRate||10;
  $('jobAccountBalance').textContent=yen.format(balance);
  $('jobTodaySales').textContent=yen.format(sales);
  $('jobAutoRate').value=String(rate);
  $('jobManualBalance').placeholder=`現在 ${yen.format(balance)}`;
  previewJobAutoTransfer();

  const pending=expenseRequests.filter(x=>x.status==='pending');
  const pendingTotal=pending.reduce((s,x)=>s+x.amount,0);
  $('jobPendingExpenseTotal').textContent=yen.format(pendingTotal);
  $('jobPendingExpenseCount').textContent=`申請 ${pending.length}件`;

  if(!$('jobHistoryMonth').value)$('jobHistoryMonth').value=monthKeyLocal(new Date());
  const month=$('jobHistoryMonth').value,type=$('jobHistoryType').value;
  const rows=jobAccountTransactions.filter(x=>(!month||String(x.date||'').startsWith(month))&&(!type||x.type===type));
  $('jobAccountHistory').innerHTML=rows.length?rows.map(x=>`<article class="job-transaction">
    <div class="job-transaction-icon">${jobTransactionIcon(x.type)}</div>
    <div class="job-transaction-main"><strong>${esc(jobTransactionTypeLabel(x.type))}</strong><span>${esc(x.description||'内容なし')} ・ 登録者：${esc(x.createdBy)}</span></div>
    <div class="job-transaction-date">${jp(x.date)}</div>
    <div class="job-transaction-amount ${x.amount>=0?'plus':'minus'}">${x.amount>=0?'+':'−'}${yen.format(Math.abs(x.amount))}</div>
  </article>`).join(''):'<div class="empty">条件に一致する履歴はありません。</div>';
}
async function saveJobAutoRate(){
  const rate=Math.max(1,Math.min(10,Number($('jobAutoRate').value||10)));
  const payload={id:1,auto_sales_rate:rate,updated_at:new Date().toISOString(),updated_by_name:currentProfile?.display_name||'管理者'};
  const {error}=await sb.from('job_account_settings').upsert(payload);
  if(error)return alert('割合を保存できませんでした：'+error.message);
  jobAccountSettings.autoRate=rate;renderJobAccount();toast(`${rate}割で保存しました`);
}
async function applyTodaySalesToJobAccount(){
  const rate=Math.max(1,Math.min(10,Number($('jobAutoRate').value||10)));
  const date=getJobSelectedSalesDate();
  const sales=todaySalesAmount(date),amount=Math.round(sales*rate/10);
  if(!confirm(`${jp(date)} の売上 ${yen.format(sales)} の${rate}割（${yen.format(amount)}）をジョブ口座へ反映しますか？`))return;
  const settingsPayload={id:1,auto_sales_rate:rate,updated_at:new Date().toISOString(),updated_by_name:currentProfile?.display_name||'管理者'};
  const transactionPayload={transaction_date:date,transaction_type:'auto_sales',amount,description:`${jp(date)} の売上 ${yen.format(sales)} × ${rate}割`,source_date:date,created_by_uid:currentProfile?.id||null,created_by_name:currentProfile?.display_name||'管理者'};
  try{
    let existing=jobAccountTransactions.find(x=>x.type==='auto_sales'&&x.sourceDate===date);
    const settingsPromise=sb.from('job_account_settings').upsert(settingsPayload);
    const transactionPromise=existing
      ?sb.from('job_account_transactions').update(transactionPayload).eq('id',existing.id)
      :sb.from('job_account_transactions').insert(transactionPayload);
    const [sr,tr]=await Promise.all([settingsPromise,transactionPromise]);
    if(sr.error)throw sr.error;if(tr.error)throw tr.error;
    await loadJobAccountData(false);await writeAudit('job_account','選択日の売上をジョブ口座へ反映',`${jp(date)} / ${rate}割 / ${yen.format(amount)}`,date);
    toast('選択日分をジョブ口座へ反映しました');
  }catch(error){alert('反映できませんでした：'+error.message)}
}
async function setJobAccountBalance(){
  const target=Number($('jobManualBalance').value),note=$('jobManualBalanceNote').value.trim();
  if(!Number.isFinite(target)||target<0)return alert('設定後の残高を入力してください。');
  if(!note)return alert('変更理由を入力してください。');
  const current=jobAccountBalance(),delta=Math.round(target-current);
  if(delta===0)return alert('現在残高と同じ金額です。');
  if(!confirm(`${yen.format(current)} から ${yen.format(target)} に変更しますか？\n調整額：${delta>=0?'+':''}${yen.format(delta)}`))return;
  const payload={transaction_date:iso(new Date()),transaction_type:'manual_balance',amount:delta,description:`残高設定：${note}`,created_by_uid:currentProfile?.id||null,created_by_name:currentProfile?.display_name||'管理者'};
  const {error}=await sb.from('job_account_transactions').insert(payload);
  if(error)return alert('残高を設定できませんでした：'+error.message);
  $('jobManualBalance').value='';$('jobManualBalanceNote').value='';
  await loadJobAccountData(false);await writeAudit('job_account','ジョブ口座残高を手動設定',`${yen.format(current)} → ${yen.format(target)}`,note);toast('残高を設定しました');
}
async function addManualJobTransaction(){
  const type=$('jobManualType').value,raw=Math.round(Number($('jobManualAmount').value)),description=$('jobManualDescription').value.trim();
  if(!raw||raw<1)return alert('金額を入力してください。');
  if(!description)return alert('内容・対象者を入力してください。');
  const negative=['withdrawal'].includes(type),amount=negative?-raw:raw;
  if(!confirm(`${jobTransactionTypeLabel(type)}として ${amount>=0?'+':'−'}${yen.format(Math.abs(amount))} を登録しますか？`))return;
  const payload={transaction_date:iso(new Date()),transaction_type:type,amount,description,created_by_uid:currentProfile?.id||null,created_by_name:currentProfile?.display_name||'管理者'};
  const {error}=await sb.from('job_account_transactions').insert(payload);
  if(error)return alert('登録できませんでした：'+error.message);
  $('jobManualAmount').value='';$('jobManualDescription').value='';
  await loadJobAccountData(false);await writeAudit('job_account',`${jobTransactionTypeLabel(type)}を登録`,yen.format(amount),description);toast('ジョブ口座履歴へ登録しました');
}

async function loadExpenseRequests(showToast=false){
  if(!sb||appMode==='login')return;
  try{
    let query=sb.from('expense_requests').select('*').order('created_at',{ascending:false});
    if(appMode==='employee'&&currentEmployee?.uid&&!portalPermission('expense_approval'))query=query.eq('employee_uid',currentEmployee.uid);
    const {data,error}=await query;if(error)throw error;
    expenseRequests=(data||[]).map(x=>({id:x.id,employeeUid:x.employee_uid,employeeId:x.employee_id,employeeName:x.employee_name,amount:Number(x.amount)||0,category:x.category||'その他',description:x.description||'',receiptUrl:x.receipt_url||'',status:x.status||'pending',reviewNote:x.review_note||'',reviewedBy:x.reviewed_by_name||'',reviewedAt:x.reviewed_at||'',createdAt:x.created_at,updatedAt:x.updated_at}));
    renderAdminExpenses();renderEmployeeExpenses();renderJobAccount();updateExpenseBadge();renderDelegatedApprovals?.();renderAdminApprovalCenter?.();
    if(showToast)toast('経費申請を更新しました');
  }catch(error){
    console.error('Expense requests load error',error);
    if(showToast)alert('経費申請を取得できませんでした。SQLの実行状況を確認してください。\n'+error.message);
  }
}
function updateExpenseBadge(){
  const count=expenseRequests.filter(x=>x.status==='pending').length;
  ['adminExpenseBadge','adminMobileExpenseBadge'].forEach(id=>{
    const el=$(id);if(!el)return;
    el.textContent=String(count);
    el.classList.toggle('hidden',count===0);
  });
}
function renderAdminExpenses(){
  if(!$('adminExpenseList'))return;
  const status=$('expenseAdminStatus')?.value||'',q=($('expenseAdminSearch')?.value||'').trim().toLowerCase();
  const rows=expenseRequests.filter(x=>(!status||x.status===status)&&(!q||`${x.employeeName} ${x.employeeId} ${x.category} ${x.description}`.toLowerCase().includes(q)));
  const pending=expenseRequests.filter(x=>x.status==='pending'),approved=expenseRequests.filter(x=>x.status==='approved'),rejected=expenseRequests.filter(x=>x.status==='rejected');
  $('expensePendingCount').textContent=`${pending.length}件`;$('expensePendingTotal').textContent=`合計 ${yen.format(pending.reduce((s,x)=>s+x.amount,0))}`;
  $('expenseApprovedCount').textContent=`${approved.length}件`;$('expenseApprovedTotal').textContent=`合計 ${yen.format(approved.reduce((s,x)=>s+x.amount,0))}`;
  $('expenseRejectedCount').textContent=`${rejected.length}件`;
  $('adminExpenseList').innerHTML=rows.length?rows.map(x=>expenseCardHtml(x,true)).join(''):'<div class="empty">条件に一致する申請はありません。</div>';
}
function renderEmployeeExpenses(){
  if(!$('employeeExpenseList'))return;
  const status=$('employeeExpenseStatus')?.value||'',rows=expenseRequests.filter(x=>!status||x.status===status);
  $('employeeExpenseList').innerHTML=rows.length?rows.map(x=>expenseCardHtml(x,false)).join(''):'<div class="empty">経費申請はまだありません。</div>';
}
function expenseCardHtml(x,isAdmin){
  const receipt=x.receiptUrl?`<a class="btn" href="${esc(x.receiptUrl)}" target="_blank" rel="noopener">証拠を開く ↗</a>`:'';
  const review=x.reviewNote?`<div class="expense-review"><strong>管理者コメント</strong><br>${esc(x.reviewNote)}${x.reviewedBy?`<br>— ${esc(x.reviewedBy)}`:''}</div>`:'';
  const adminActions=isAdmin&&x.status==='pending'?`<button class="btn success" onclick="reviewExpenseRequest(${x.id},'approved')">✓ 承認</button><button class="btn danger" onclick="reviewExpenseRequest(${x.id},'rejected')">却下</button>`:'';
  const employeeCancel=!isAdmin&&x.status==='pending'?`<button class="btn danger" onclick="cancelExpenseRequest(${x.id})">申請を取り消す</button>`:'';
  return `<article class="expense-card">
    <div class="expense-card-head"><div><h3>${esc(x.category)} ｜ ${esc(x.employeeName)} <small>${esc(x.employeeId)}</small></h3><div class="expense-meta"><span>${new Date(x.createdAt).toLocaleString('ja-JP')}</span><span class="expense-status ${x.status}">${expenseStatusLabel(x.status)}</span></div></div><div class="expense-amount">${yen.format(x.amount)}</div></div>
    <div class="expense-description">${esc(x.description)}</div>${review}
    <div class="expense-actions">${receipt}${adminActions}${employeeCancel}</div>
  </article>`;
}
async function submitExpenseRequest(){
  if(!currentEmployee?.uid)return alert('従業員情報を確認できません。');
  const amount=Math.round(Number($('expenseAmount').value)),category=$('expenseCategory').value.trim(),description=$('expenseDescription').value.trim(),receipt_url=$('expenseReceiptUrl').value.trim();
  if(!amount||amount<1)return alert('申請金額を入力してください。');
  if(!category)return alert('カテゴリーを入力してください。');
  if(!description)return alert('申請内容を入力してください。');
  if(!confirm(`${yen.format(amount)}の経費を申請しますか？`))return;
  const payload={employee_uid:currentEmployee.uid,employee_id:currentEmployee.id,employee_name:currentEmployee.name,amount,category,description,receipt_url:receipt_url||null,status:'pending',updated_at:new Date().toISOString()};
  const {error}=await sb.from('expense_requests').insert(payload);
  if(error)return alert('申請できませんでした：'+error.message);
  $('expenseAmount').value='';$('expenseCategory').value='';$('expenseDescription').value='';$('expenseReceiptUrl').value='';
  await loadExpenseRequests(false);toast('経費を申請しました');
}
async function cancelExpenseRequest(id){
  if(!confirm('この経費申請を取り消しますか？'))return;
  const {error}=await sb.from('expense_requests').delete().eq('id',id).eq('status','pending');
  if(error)return alert('取り消せませんでした：'+error.message);
  await loadExpenseRequests(false);toast('申請を取り消しました');
}
async function reviewExpenseRequest(id,status){
  if(!portalPermission('expense_approval'))return alert('経費申請を承認・却下する権限がありません。');
  const target=expenseRequests.find(x=>Number(x.id)===Number(id));if(!target)return;
  const verb=status==='approved'?'承認':'却下';
  const note=prompt(`${target.employeeName}さんの ${yen.format(target.amount)} の申請を${verb}します。\n管理者コメントを入力してください（任意）`,'') ;
  if(note===null)return;
  if(!confirm(`この申請を${verb}しますか？`))return;
  try{
    const reviewPayload={status,review_note:note.trim()||null,reviewed_by_uid:currentProfile?.id||null,reviewed_by_name:currentProfile?.display_name||'管理者',reviewed_at:new Date().toISOString(),updated_at:new Date().toISOString()};
    const {error:updateError}=await sb.from('expense_requests').update(reviewPayload).eq('id',id).eq('status','pending');
    if(updateError)throw updateError;
    if(status==='approved'){
      const transaction={transaction_date:iso(new Date()),transaction_type:'expense',amount:-Math.abs(target.amount),description:`経費承認：${target.category} / ${target.employeeName} / ${target.description}`,expense_request_id:id,created_by_uid:currentProfile?.id||null,created_by_name:currentProfile?.display_name||'管理者'};
      const {error:transactionError}=await sb.from('job_account_transactions').upsert(transaction,{onConflict:'expense_request_id'});
      if(transactionError)throw transactionError;
    }
    await Promise.all([loadExpenseRequests(false),loadJobAccountData(false)]);
    await writeAudit(
      'expense',
      `経費申請を${verb}`,
      [
        `申請者：${target.employeeName}`,
        `金額：${yen.format(target.amount)}`,
        `カテゴリー：${target.category||'未設定'}`,
        `申請内容：${target.description||'なし'}`,
        `承認者コメント：${note||'なし'}`
      ].join('\n'),
      target.employeeName
    );
    toast(`経費申請を${verb}しました`);
  }catch(error){alert(`経費申請を${verb}できませんでした：`+error.message)}
}



/* ===== Ver.18.1 Site Inventory & Farm Approval Module ===== */


adminApprovalTab='expense';

function setAdminApprovalTab(tab){
  adminApprovalTab=tab;
  document.querySelectorAll('[data-admin-approval-tab]').forEach(button=>{
    button.classList.toggle('active',button.dataset.adminApprovalTab===tab);
  });
  document.querySelectorAll('.admin-approval-view').forEach(view=>view.classList.remove('active'));
  $(`adminApproval${tab[0].toUpperCase()+tab.slice(1)}View`)?.classList.add('active');
}

async function loadAdminApprovalCenter(show=false){
  if(appMode!=='admin')return;
  await Promise.allSettled([
    loadExpenseRequests(false),
    loadInventoryRequests(false),
    loadFarmRequests(false)
  ]);
  renderAdminApprovalCenter();
  if(show)toast('承認管理を更新しました');
}

function renderAdminApprovalCenter(){
  if(appMode!=='admin')return;

  const expensePending=expenseRequests.filter(item=>item.status==='pending');
  const inventoryPending=inventoryCountRequests.filter(item=>item.status==='pending');
  const farmPending=farmSubmissionRequests.filter(item=>item.status==='pending');
  const total=expensePending.length+inventoryPending.length+farmPending.length;

  const setCount=(id,value,suffix='件')=>{
    if($(id))$(id).textContent=`${value}${suffix}`;
  };

  setCount('adminApprovalTotalCount',total);
  setCount('adminApprovalExpenseCount',expensePending.length);
  setCount('adminApprovalInventoryCount',inventoryPending.length);
  setCount('adminApprovalFarmCount',farmPending.length);

  if($('adminApprovalExpenseTabBadge'))$('adminApprovalExpenseTabBadge').textContent=expensePending.length;
  if($('adminApprovalInventoryTabBadge'))$('adminApprovalInventoryTabBadge').textContent=inventoryPending.length;
  if($('adminApprovalFarmTabBadge'))$('adminApprovalFarmTabBadge').textContent=farmPending.length;

  ['adminApprovalBadge','adminMobileApprovalBadge'].forEach(id=>{
    const badge=$(id);
    if(!badge)return;
    badge.textContent=total;
    badge.classList.toggle('hidden',total===0);
  });

  if($('adminApprovalExpenseList')){
    $('adminApprovalExpenseList').innerHTML=expensePending.length
      ?expensePending.map(item=>expenseCardHtml(item,true)).join('')
      :'<div class="empty">確認待ちの経費申請はありません。</div>';
  }

  if($('adminApprovalInventoryList')){
    $('adminApprovalInventoryList').innerHTML=inventoryPending.length
      ?inventoryPending.map(item=>inventoryRequestCard(item,true)).join('')
      :'<div class="empty">確認待ちの在庫申請はありません。</div>';
  }

  if($('adminApprovalFarmList')){
    $('adminApprovalFarmList').innerHTML=farmPending.length
      ?farmPending.map(item=>farmRequestCard(item,true)).join('')
      :'<div class="empty">確認待ちのFarm申請はありません。</div>';
  }
}

delegatedApprovalTab='expense';

function setDelegatedApprovalTab(tab){
  if(tab==='expense'&&!portalPermission('expense_approval'))return;
  if(tab==='inventory'&&!portalPermission('inventory_approval'))return;
  if(tab==='farm'&&!portalPermission('farm_approval'))return;

  delegatedApprovalTab=tab;
  document.querySelectorAll('[data-delegated-tab]').forEach(button=>{
    button.classList.toggle('active',button.dataset.delegatedTab===tab);
  });
  document.querySelectorAll('.delegated-approval-view').forEach(view=>view.classList.remove('active'));
  $(`delegated${tab[0].toUpperCase()+tab.slice(1)}View`)?.classList.add('active');
}

async function loadDelegatedApprovals(show=false){
  if(!anyDelegatedPermission())return;
  const jobs=[];
  if(portalPermission('expense_approval'))jobs.push(loadExpenseRequests(false));
  if(portalPermission('inventory_approval'))jobs.push(loadInventoryRequests(false));
  if(portalPermission('farm_approval'))jobs.push(loadFarmRequests(false));
  await Promise.allSettled(jobs);
  renderDelegatedApprovals();
  if(show)toast('承認管理を更新しました');
}

function renderDelegatedApprovals(){
  const expensePending=expenseRequests.filter(item=>item.status==='pending');
  const inventoryPending=inventoryCountRequests.filter(item=>item.status==='pending');
  const farmPending=farmSubmissionRequests.filter(item=>item.status==='pending');

  if($('delegatedExpenseBadge'))$('delegatedExpenseBadge').textContent=expensePending.length;
  if($('delegatedInventoryBadge'))$('delegatedInventoryBadge').textContent=inventoryPending.length;
  if($('delegatedFarmBadge'))$('delegatedFarmBadge').textContent=farmPending.length;

  const total=
    (portalPermission('expense_approval')?expensePending.length:0)+
    (portalPermission('inventory_approval')?inventoryPending.length:0)+
    (portalPermission('farm_approval')?farmPending.length:0);

  if($('employeeApprovalBadge')){
    $('employeeApprovalBadge').textContent=total;
    $('employeeApprovalBadge').classList.toggle('hidden',total===0);
  }

  if($('delegatedExpenseList')){
    $('delegatedExpenseList').innerHTML=portalPermission('expense_approval')
      ?(expensePending.length?expensePending.map(item=>expenseCardHtml(item,true)).join(''):'<div class="empty">確認待ちの経費申請はありません。</div>')
      :'<div class="empty">経費承認権限がありません。</div>';
  }

  if($('delegatedInventoryList')){
    $('delegatedInventoryList').innerHTML=portalPermission('inventory_approval')
      ?(inventoryPending.length?inventoryPending.map(item=>inventoryRequestCard(item,true)).join(''):'<div class="empty">確認待ちの在庫申請はありません。</div>')
      :'<div class="empty">在庫承認権限がありません。</div>';
  }

  if($('delegatedFarmList')){
    $('delegatedFarmList').innerHTML=portalPermission('farm_approval')
      ?(farmPending.length?farmPending.map(item=>farmRequestCard(item,true)).join(''):'<div class="empty">確認待ちのFarm申請はありません。</div>')
      :'<div class="empty">Farm承認権限がありません。</div>';
  }
}

function requestStatusLabel(status){return ({pending:'確認待ち',approved:'承認済み',rejected:'却下'})[status]||status||'確認待ち'}
function requestDate(value){return value?new Date(value).toLocaleString('ja-JP'):'-'}

function setInventoryAdminTab(tab){
  document.querySelectorAll('[data-inventory-admin-tab]').forEach(b=>b.classList.toggle('active',b.dataset.inventoryAdminTab===tab));
  document.querySelectorAll('#page-inventory .site-db-view').forEach(v=>v.classList.remove('active'));
  $('inventoryAdminView'+tab[0].toUpperCase()+tab.slice(1))?.classList.add('active');
  if(tab==='requests')loadInventoryRequests(false);
}
function setEmployeeInventoryTab(tab){
  document.querySelectorAll('[data-employee-inventory-tab]').forEach(b=>b.classList.toggle('active',b.dataset.employeeInventoryTab===tab));
  document.querySelectorAll('#employee-page-inventory .employee-site-view').forEach(v=>v.classList.remove('active'));
  $('employeeInventoryView'+tab[0].toUpperCase()+tab.slice(1))?.classList.add('active');
  if(tab==='count')renderEmployeeInventoryCountSheet();
  if(tab==='history')loadInventoryRequests(false);
}
function setEmployeeFarmMainTab(tab){
  document.querySelectorAll('[data-employee-farm-main-tab]').forEach(b=>b.classList.toggle('active',b.dataset.employeeFarmMainTab===tab));
  document.querySelectorAll('#employee-page-farm>.employee-site-view').forEach(v=>v.classList.remove('active'));
  $('employeeFarmMainView'+tab[0].toUpperCase()+tab.slice(1))?.classList.add('active');
  if(tab==='history')loadFarmRequests(false);
}

function renderInventorySpreadsheet(){
  const body=$('inventorySpreadsheetBody');if(!body)return;
  const q=($('inventoryTableSearch')?.value||'').trim().toLowerCase();
  const filter=$('inventoryTableFilter')?.value||'';
  const rows=(inventorySpreadsheetRows.length?inventorySpreadsheetRows:inventorySnapshot.map((x,i)=>({
    id:x.id||null,name:x.name,stock:x.stock,min_stock:x.min,status:x.status||'',sort_order:x.sort_order??i+1
  }))).filter(x=>(!q||String(x.name).toLowerCase().includes(q))&&(!filter||(filter==='low'&&Number(x.stock)<Number(x.min_stock))));
  body.innerHTML=rows.length?rows.map((x,i)=>{
    const low=Number(x.stock)<Number(x.min_stock);
    return `<tr data-inventory-sheet-id="${x.id??''}" data-inventory-original-name="${esc(x.name)}">
      <td>${i+1}</td>
      <td><input class="inv-sheet-name" value="${esc(x.name)}" maxlength="80"></td>
      <td><input class="inv-sheet-stock" type="number" min="0" step="1" value="${Number(x.stock)||0}"></td>
      <td><input class="inv-sheet-min" type="number" min="0" step="1" value="${Number(x.min_stock)||0}"></td>
      <td><span class="spreadsheet-status ${low?'low':''}">${low?'要補充':'在庫OK'}</span></td>
      <td><input class="inv-sheet-sort" type="number" min="0" step="1" value="${Number(x.sort_order)||i+1}"></td>
      <td><button class="btn danger" onclick="deleteInventoryItemRow(this)">削除</button></td>
    </tr>`;
  }).join(''):'<tr><td colspan="7">材料がありません。</td></tr>';
}
function addInventoryItemRow(){
  inventorySpreadsheetRows.push({id:null,name:'新しい材料',stock:0,min_stock:0,status:'',sort_order:inventorySpreadsheetRows.length+1});
  renderInventorySpreadsheet();
  setInventoryAdminTab('sheet');
}
async function deleteInventoryItemRow(button){
  const row=button.closest('tr'),id=row?.dataset.inventorySheetId,name=row?.dataset.inventoryOriginalName||'この材料';
  if(!confirm(`「${name}」を在庫表から削除しますか？`))return;
  if(id){
    const {error}=await sb.from('inventory_items').delete().eq('id',id);
    if(error)return alert('削除できませんでした：'+error.message);
  }
  inventorySpreadsheetRows=inventorySpreadsheetRows.filter(x=>String(x.id||'')!==String(id||'')||x.name!==name);
  row?.remove();
  await loadInventorySnapshot(false);
  toast('材料を削除しました');
}
async function saveInventorySpreadsheet(){
  const rows=[...document.querySelectorAll('#inventorySpreadsheetBody tr[data-inventory-sheet-id]')];
  if(!rows.length)return alert('保存する材料がありません。');

  const records=rows.map((row,i)=>({
    id:row.dataset.inventorySheetId?Number(row.dataset.inventorySheetId):null,
    name:row.querySelector('.inv-sheet-name').value.trim(),
    stock:Math.max(0,Math.round(Number(row.querySelector('.inv-sheet-stock').value)||0)),
    min_stock:Math.max(0,Math.round(Number(row.querySelector('.inv-sheet-min').value)||0)),
    status:'',
    sort_order:Math.max(0,Math.round(Number(row.querySelector('.inv-sheet-sort').value)||i+1))
  })).filter(x=>x.name);

  if(!records.length)return alert('材料名を入力してください。');
  const duplicates=records.map(x=>x.name).filter((v,i,a)=>a.indexOf(v)!==i);
  if(duplicates.length)return alert('同じ材料名が重複しています：'+[...new Set(duplicates)].join('、'));

  try{
    for(const record of records){
      const payload={
        name:record.name,
        stock:record.stock,
        min_stock:record.min_stock,
        status:'',
        sort_order:record.sort_order,
        updated_at:new Date().toISOString()
      };
      let result;
      if(record.id){
        result=await sb.from('inventory_items').update(payload).eq('id',record.id);
      }else{
        result=await sb.from('inventory_items').upsert(payload,{onConflict:'name'});
      }
      if(result.error)throw new Error(`${record.name}：${result.error.message}`);
    }
    await loadInventorySnapshot(false);
    await writeAudit('inventory','在庫表を一括保存',`${records.length}品目`,'サイト内在庫表');
    toast('在庫表を保存しました');
  }catch(error){
    console.error('Inventory save error',error);
    alert('在庫表を保存できませんでした。\n'+(error?.message||error)+'\n\n修復SQLを実行してください。');
  }
}

function inventoryCountDraftKey(){
  const uid=currentEmployee?.uid||currentEmployee?.id||'guest';
  return `lait_divin_inventory_count_draft_${uid}`;
}
function loadInventoryCountDraft(){
  try{
    const saved=JSON.parse(localStorage.getItem(inventoryCountDraftKey())||'{}');
    inventoryCountDraft=saved?.counts&&typeof saved.counts==='object'?saved.counts:{};
    inventoryCountNoteDraft=String(saved?.note||'');
  }catch(error){
    console.warn('Inventory draft load failed',error);
    inventoryCountDraft={};
    inventoryCountNoteDraft='';
  }
}
function persistInventoryCountDraft(){
  try{
    localStorage.setItem(inventoryCountDraftKey(),JSON.stringify({
      counts:inventoryCountDraft,
      note:inventoryCountNoteDraft,
      saved_at:new Date().toISOString()
    }));
  }catch(error){
    console.warn('Inventory draft save failed',error);
  }
}
function saveInventoryCountNoteDraft(value){
  inventoryCountNoteDraft=String(value||'');
  persistInventoryCountDraft();
}
function clearInventoryCountDraft(ask=false){
  if(ask&&!confirm('入力中の在庫数とメモをすべて消しますか？'))return;
  inventoryCountDraft={};
  inventoryCountNoteDraft='';
  localStorage.removeItem(inventoryCountDraftKey());
  document.querySelectorAll('.employee-inventory-count').forEach(x=>x.value='');
  document.querySelectorAll('.inventory-difference').forEach(x=>{x.textContent='－';x.className='inventory-difference'});
  if($('employeeInventoryRequestNote'))$('employeeInventoryRequestNote').value='';
  if(ask)toast('在庫入力の下書きを消去しました');
}
function saveInventoryCountInputDraft(input){
  const row=input.closest('tr');
  if(!row)return;
  const name=row.dataset.inventoryCountName;
  if(input.value===''){
    delete inventoryCountDraft[name];
  }else{
    inventoryCountDraft[name]=String(input.value);
  }
  persistInventoryCountDraft();
  updateEmployeeInventoryDifference(input);
}
function renderEmployeeInventoryCountSheet(){
  const body=$('employeeInventoryCountBody');if(!body)return;
  loadInventoryCountDraft();
  body.innerHTML=(inventorySnapshot||[]).map(x=>{
    const saved=Object.prototype.hasOwnProperty.call(inventoryCountDraft,x.name)?inventoryCountDraft[x.name]:'';
    return `<tr data-inventory-count-name="${esc(x.name)}">
      <td><strong>${esc(x.name)}</strong></td>
      <td>${Number(x.stock).toLocaleString('ja-JP')}個</td>
      <td><input class="employee-inventory-count" type="number" min="0" step="1" value="${esc(saved)}" placeholder="確認した数" oninput="saveInventoryCountInputDraft(this)"></td>
      <td class="inventory-difference">－</td>
    </tr>`;
  }).join('');

  document.querySelectorAll('#employeeInventoryCountBody .employee-inventory-count').forEach(input=>{
    if(input.value!=='')updateEmployeeInventoryDifference(input);
  });
  if($('employeeInventoryRequestNote'))$('employeeInventoryRequestNote').value=inventoryCountNoteDraft;
}
function updateEmployeeInventoryDifference(input){
  const row=input.closest('tr'),name=row.dataset.inventoryCountName;
  const current=inventorySnapshot.find(x=>x.name===name)?.stock||0;
  const cell=row.querySelector('.inventory-difference');
  if(input.value===''){cell.textContent='－';cell.className='inventory-difference';return}
  const diff=Math.round(Number(input.value)||0)-Number(current);
  cell.textContent=`${diff>0?'+':''}${diff}個`;
  cell.className=`inventory-difference ${diff>0?'plus':diff<0?'minus':''}`;
}
async function submitInventoryCountRequest(){
  if(!currentEmployee?.uid)return alert('従業員情報を確認できません。');
  const entries=[...document.querySelectorAll('#employeeInventoryCountBody tr')].map(row=>{
    const input=row.querySelector('.employee-inventory-count');
    if(!input||input.value==='')return null;
    const name=row.dataset.inventoryCountName,current=inventorySnapshot.find(x=>x.name===name)?.stock||0;
    return {name,count:Math.max(0,Math.round(Number(input.value)||0)),previous:Number(current)||0};
  }).filter(Boolean);
  if(!entries.length)return alert('確認した材料の現在数を1つ以上入力してください。');

  const note=$('employeeInventoryRequestNote')?.value.trim()||'';
  inventoryCountNoteDraft=note;
  persistInventoryCountDraft();

  if(!confirm(`${entries.length}品目の在庫確認を管理者へ申請しますか？`))return;

  const payload={
    employee_uid:currentEmployee.uid,employee_id:currentEmployee.id,employee_name:currentEmployee.name,
    counts:entries,note,status:'pending',updated_at:new Date().toISOString()
  };
  const {error}=await sb.from('inventory_count_requests').insert(payload);
  if(error){
    persistInventoryCountDraft();
    return alert('申請できませんでした：'+error.message+'\n入力内容は保存されているため、再入力は不要です。');
  }

  clearInventoryCountDraft(false);
  await loadInventoryRequests(false);
  setEmployeeInventoryTab('history');
  toast('在庫確認を申請しました');
}
async function loadInventoryRequests(show=false){
  if(!sb||appMode==='login')return;
  try{
    let query=sb.from('inventory_count_requests').select('*').order('created_at',{ascending:false});
    if(appMode==='employee'&&currentEmployee?.uid&&!portalPermission('inventory_approval'))query=query.eq('employee_uid',currentEmployee.uid);
    const {data,error}=await query;if(error)throw error;
    inventoryCountRequests=(data||[]).map(x=>({...x,counts:Array.isArray(x.counts)?x.counts:[]}));
    renderInventoryRequestsAdmin();renderInventoryRequestsEmployee();updateInventoryRequestBadges();renderDelegatedApprovals?.();renderAdminApprovalCenter?.();
    if(show)toast('在庫申請を更新しました');
  }catch(error){console.error('Inventory request load error',error);if(show)alert('在庫申請を取得できませんでした：'+error.message)}
}
function updateInventoryRequestBadges(){
  const pending=inventoryCountRequests.filter(x=>x.status==='pending').length;
  ['inventoryRequestCount','inventoryRequestTabBadge'].forEach(id=>{if($(id))$(id).textContent=String(pending)});
  if($('employeeInventoryPending'))$('employeeInventoryPending').textContent=String(inventoryCountRequests.filter(x=>x.status==='pending').length);
}
function inventoryRequestCard(x,isAdmin){
  const counts=(x.counts||[]);
  const detail=counts.map(c=>`<div><span>${esc(c.name)}</span><strong>${Number(c.previous||0).toLocaleString()} → ${Number(c.count||0).toLocaleString()}個</strong></div>`).join('');
  const review=x.review_note?`<div class="approval-note">管理者コメント：${esc(x.review_note)}</div>`:'';
  const actions=isAdmin&&x.status==='pending'?`<div class="approval-actions"><button class="btn success" onclick="reviewInventoryRequest(${x.id},'approved')">✓ 承認して反映</button><button class="btn danger" onclick="reviewInventoryRequest(${x.id},'rejected')">却下</button></div>`:'';
  return `<article class="approval-card">
    <div class="approval-card-head"><div><h3>${esc(x.employee_name)} <small>${esc(x.employee_id)}</small></h3><small>${requestDate(x.created_at)}</small></div><span class="approval-status ${x.status}">${requestStatusLabel(x.status)}</span></div>
    <div class="approval-summary"><span>${counts.length}品目</span><span>申請番号 #${x.id}</span></div>
    <div class="approval-detail-grid">${detail}</div>
    ${x.note?`<div class="approval-note">申請メモ：${esc(x.note)}</div>`:''}${review}${actions}
  </article>`;
}
function renderInventoryRequestsAdmin(){
  const box=$('inventoryAdminRequestList');if(!box)return;
  const status=$('inventoryRequestStatusFilter')?.value??'pending',q=($('inventoryRequestSearch')?.value||'').trim().toLowerCase();
  const rows=inventoryCountRequests.filter(x=>(!status||x.status===status)&&(!q||`${x.employee_name} ${(x.counts||[]).map(c=>c.name).join(' ')}`.toLowerCase().includes(q)));
  box.innerHTML=rows.length?rows.map(x=>inventoryRequestCard(x,true)).join(''):'<div class="empty">該当する申請はありません。</div>';
}
function renderInventoryRequestsEmployee(){
  const box=$('employeeInventoryRequestHistory');if(!box)return;
  box.innerHTML=inventoryCountRequests.length?inventoryCountRequests.map(x=>inventoryRequestCard(x,false)).join(''):'<div class="empty">申請履歴はありません。</div>';
}
async function reviewInventoryRequest(id,status){
  if(!portalPermission('inventory_approval'))return alert('在庫申請を承認・却下する権限がありません。');
  const target=inventoryCountRequests.find(x=>Number(x.id)===Number(id));if(!target)return;
  const verb=status==='approved'?'承認':'却下';
  const note=prompt(`この在庫申請を${verb}します。\n管理者コメント（任意）`,'');if(note===null)return;
  if(!confirm(`申請 #${id} を${verb}しますか？`))return;
  try{
    if(status==='approved'){
      for(const count of target.counts||[]){
        const {error}=await sb.from('inventory_items').update({stock:Number(count.count)||0,status:'',updated_at:new Date().toISOString()}).eq('name',count.name);
        if(error)throw error;
      }
    }
    const {error}=await sb.from('inventory_count_requests').update({
      status,review_note:note.trim()||null,reviewed_by_uid:currentProfile?.id||null,
      reviewed_by_name:currentProfile?.display_name||'管理者',reviewed_at:new Date().toISOString(),updated_at:new Date().toISOString()
    }).eq('id',id).eq('status','pending');
    if(error)throw error;
    await Promise.all([loadInventorySnapshot(false),loadInventoryRequests(false)]);
    await writeAudit(
      'inventory',
      `在庫申請を${verb}`,
      [
        `申請者：${target.employee_name}`,
        `対象品目：${(target.counts||[]).length}品目`,
        ...(target.counts||[]).map(item=>`${item.name}：${Number(item.previous||0).toLocaleString('ja-JP')}個 → ${Number(item.count||0).toLocaleString('ja-JP')}個`),
        `申請メモ：${target.note||'なし'}`,
        `承認者コメント：${note||'なし'}`
      ].join('\n'),
      target.employee_name
    );
    toast(`在庫申請を${verb}しました`);
  }catch(error){alert(`在庫申請を${verb}できませんでした：`+error.message)}
}

function saveFarmEntryDraftFromDom(){
  document.querySelectorAll('#employeeFarmEntryBody tr[data-farm-entry-item]').forEach(row=>{
    const id=String(row.dataset.farmEntryItem||'');
    const input=row.querySelector('.employee-farm-entry-qty');
    if(id&&input)farmEntryDraft[id]=input.value;
  });
}
function updateFarmEntryDraft(input){
  const row=input.closest('tr');
  if(row)farmEntryDraft[String(row.dataset.farmEntryItem||'')]=input.value;
  calculateEmployeeFarmEntry();
}
function renderFarmEntrySheet(){
  const body=$('employeeFarmEntryBody');if(!body)return;
  saveFarmEntryDraftFromDom();
  const active=farmItems.filter(x=>x.is_active!==false);
  body.innerHTML=active.map(x=>{
    const id=String(x.id);
    const quantity=farmEntryDraft[id]??'';
    const cost=Number(x.cost_price)||0;
    const rate=Number(x.assessment_rate??x.unit_value)||0;
    return `<tr data-farm-entry-item="${x.id}" data-farm-entry-name="${esc(x.name)}" data-farm-entry-cost="${cost}" data-farm-entry-rate="${rate}">
      <td><strong>${esc(x.name)}</strong></td>
      <td>${yen.format(cost)}</td>
      <td>${rate.toLocaleString('ja-JP',{maximumFractionDigits:4})}</td>
      <td><input class="employee-farm-entry-qty" type="number" min="0" step="1" value="${esc(quantity)}" placeholder="0" oninput="updateFarmEntryDraft(this)"></td>
      <td class="employee-farm-entry-assessment">0</td>
      <td class="employee-farm-entry-costtotal">¥0</td>
    </tr>`;
  }).join('')||'<tr><td colspan="6">管理者がFarm品目を設定してください。</td></tr>';
  calculateEmployeeFarmEntry();
}
function calculateEmployeeFarmEntry(){
  let total=0,assessment=0,purchaseAmount=0;
  document.querySelectorAll('#employeeFarmEntryBody tr[data-farm-entry-item]').forEach(row=>{
    const qty=Math.max(0,Math.round(Number(row.querySelector('.employee-farm-entry-qty').value)||0));
    const rate=Number(row.dataset.farmEntryRate)||0;
    const cost=Number(row.dataset.farmEntryCost)||0;
    const assessmentSubtotal=qty*rate;
    const costSubtotal=qty*cost;
    total+=qty;
    assessment+=assessmentSubtotal;
    purchaseAmount+=costSubtotal;
    row.querySelector('.employee-farm-entry-assessment').textContent=assessmentSubtotal.toLocaleString('ja-JP',{maximumFractionDigits:4});
    row.querySelector('.employee-farm-entry-costtotal').textContent=yen.format(costSubtotal);
  });
  if($('employeeFarmEntryTotal'))$('employeeFarmEntryTotal').textContent=`${total.toLocaleString()}個`;
  if($('employeeFarmEntryAssessment'))$('employeeFarmEntryAssessment').textContent=assessment.toLocaleString('ja-JP',{maximumFractionDigits:4});
  if($('employeeFarmEntryPurchaseAmount'))$('employeeFarmEntryPurchaseAmount').textContent=yen.format(purchaseAmount);
  return {total,assessment,purchaseAmount};
}
async function submitFarmRequest(){
  if(!currentEmployee?.uid)return alert('従業員情報を確認できません。');
  if(!currentFarmPeriod)return alert('申請する集計期間を選択してください。');
  const entries=[...document.querySelectorAll('#employeeFarmEntryBody tr[data-farm-entry-item]')].map(row=>{
    const quantity=Math.max(0,Math.round(Number(row.querySelector('.employee-farm-entry-qty').value)||0));
    const assessmentRate=Number(row.dataset.farmEntryRate)||0;
    const costPrice=Number(row.dataset.farmEntryCost)||0;
    return {
      item_id:Number(row.dataset.farmEntryItem),
      name:row.dataset.farmEntryName,
      quantity,
      cost_price:costPrice,
      assessment_rate:assessmentRate,
      assessment_subtotal:quantity*assessmentRate,
      cost_subtotal:quantity*costPrice
    };
  }).filter(x=>x.quantity>0);
  if(!entries.length)return alert('個数を1つ以上入力してください。');
  const total=entries.reduce((s,x)=>s+x.quantity,0);
  const assessment=entries.reduce((s,x)=>s+x.assessment_subtotal,0);
  const purchaseAmount=entries.reduce((s,x)=>s+x.cost_subtotal,0);
  const note=$('employeeFarmRequestNote')?.value.trim()||'';
  if(!confirm(`合計 ${total.toLocaleString()}個
査定 ${assessment.toLocaleString('ja-JP',{maximumFractionDigits:4})}
金額 ${yen.format(purchaseAmount)}

この内容で申請しますか？`))return;
  const payload={
    period_id:Number(currentFarmPeriod),employee_uid:currentEmployee.uid,employee_id:currentEmployee.id,
    employee_name:currentEmployee.name,entries,total_quantity:total,assessment_amount:assessment,
    purchase_amount:purchaseAmount,note,status:'pending',updated_at:new Date().toISOString()
  };
  const {error}=await sb.from('farm_submission_requests').insert(payload);
  if(error)return alert('Farm申請を送信できませんでした：'+error.message);
  farmEntryDraft={};
  document.querySelectorAll('.employee-farm-entry-qty').forEach(x=>x.value='');
  if($('employeeFarmRequestNote'))$('employeeFarmRequestNote').value='';
  calculateEmployeeFarmEntry();
  await loadFarmRequests(false);
  setEmployeeFarmMainTab('history');
  toast('在庫仕入れ表を申請しました');
}
async function loadFarmRequests(show=false){
  if(!sb||appMode==='login')return;
  try{
    let query=sb.from('farm_submission_requests').select('*').order('created_at',{ascending:false});
    if(currentFarmPeriod)query=query.eq('period_id',Number(currentFarmPeriod));
    if(appMode==='employee'&&currentEmployee?.uid&&!portalPermission('farm_approval'))query=query.eq('employee_uid',currentEmployee.uid);
    const {data,error}=await query;if(error)throw error;
    farmSubmissionRequests=(data||[]).map(x=>({...x,entries:Array.isArray(x.entries)?x.entries:[]}));
    renderFarmRequestsAdmin();renderFarmRequestsEmployee();updateFarmRequestBadges();renderDelegatedApprovals?.();renderAdminApprovalCenter?.();
    if(show)toast('Farm申請を更新しました');
  }catch(error){console.error('Farm request load error',error);if(show)alert('Farm申請を取得できませんでした：'+error.message)}
}
function updateFarmRequestBadges(){
  const pending=farmSubmissionRequests.filter(x=>x.status==='pending').length;
  ['farmPendingRequestCount','farmRequestTabBadge'].forEach(id=>{if($(id))$(id).textContent=String(pending)});
  if($('employeeFarmPending'))$('employeeFarmPending').textContent=String(farmSubmissionRequests.filter(x=>x.status==='pending').length);
}
function farmRequestCard(x,isAdmin){
  const detail=(x.entries||[]).map(e=>`<div><span>${esc(e.name)}</span><strong>${Number(e.quantity).toLocaleString()}個 / 査定 ${Number(e.assessment_subtotal??e.subtotal??0).toLocaleString('ja-JP',{maximumFractionDigits:4})} / 金額 ${yen.format(Number(e.cost_subtotal)||0)}</strong></div>`).join('');
  const review=x.review_note?`<div class="approval-note">管理者コメント：${esc(x.review_note)}</div>`:'';
  const actions=isAdmin&&x.status==='pending'?`<div class="approval-actions"><button class="btn success" onclick="reviewFarmRequest(${x.id},'approved')">✓ 承認して反映</button><button class="btn danger" onclick="reviewFarmRequest(${x.id},'rejected')">却下</button></div>`:'';
  return `<article class="approval-card">
    <div class="approval-card-head"><div><h3>${esc(x.employee_name)} <small>${esc(x.employee_id)}</small></h3><small>${requestDate(x.created_at)}</small></div><span class="approval-status ${x.status}">${requestStatusLabel(x.status)}</span></div>
    <div class="approval-summary"><span>合計 ${Number(x.total_quantity).toLocaleString()}個</span><span>査定 ${Number(x.assessment_amount||0).toLocaleString('ja-JP',{maximumFractionDigits:4})}</span><span>金額 ${yen.format(Number(x.purchase_amount)||0)}</span><span>申請番号 #${x.id}</span></div>
    <div class="approval-detail-grid">${detail}</div>${x.note?`<div class="approval-note">申請メモ：${esc(x.note)}</div>`:''}${review}${actions}
  </article>`;
}
function renderFarmRequestsAdmin(){
  const box=$('farmAdminRequestList');if(!box)return;
  const status=$('farmRequestStatusFilter')?.value??'pending',q=($('farmRequestSearch')?.value||'').trim().toLowerCase();
  const rows=farmSubmissionRequests.filter(x=>(!status||x.status===status)&&(!q||`${x.employee_name} ${(x.entries||[]).map(e=>e.name).join(' ')}`.toLowerCase().includes(q)));
  box.innerHTML=rows.length?rows.map(x=>farmRequestCard(x,true)).join(''):'<div class="empty">該当する申請はありません。</div>';
}
function renderFarmRequestsEmployee(){
  const box=$('employeeFarmRequestHistory');if(!box)return;
  box.innerHTML=farmSubmissionRequests.length?farmSubmissionRequests.map(x=>farmRequestCard(x,false)).join(''):'<div class="empty">申請履歴はありません。</div>';
}
async function reviewFarmRequest(id,status){
  if(!portalPermission('farm_approval'))return alert('Farm申請を承認・却下する権限がありません。');
  const target=farmSubmissionRequests.find(x=>Number(x.id)===Number(id));if(!target)return;
  const verb=status==='approved'?'承認':'却下';
  const note=prompt(`このFarm申請を${verb}します。\n管理者コメント（任意）`,'');if(note===null)return;
  if(!confirm(`申請 #${id} を${verb}しますか？`))return;
  try{
    if(status==='approved'){
      for(const entry of target.entries||[]){
        const {data:existing,error:readError}=await sb.from('farm_entries').select('quantity').eq('period_id',target.period_id).eq('staff_name',target.employee_name).eq('item_id',entry.item_id).maybeSingle();
        if(readError)throw readError;
        const quantity=(Number(existing?.quantity)||0)+(Number(entry.quantity)||0);
        const {error:entryError}=await sb.from('farm_entries').upsert({period_id:target.period_id,staff_name:target.employee_name,item_id:entry.item_id,quantity},{onConflict:'period_id,staff_name,item_id'});
        if(entryError)throw entryError;
      }
      const {data:currentTotal,error:totalReadError}=await sb.from('farm_staff_totals').select('assessment,payment').eq('period_id',target.period_id).eq('staff_name',target.employee_name).maybeSingle();
      if(totalReadError)throw totalReadError;
      const assessment=(Number(currentTotal?.assessment)||0)+(Number(target.assessment_amount)||0);
      const payment=(Number(currentTotal?.payment)||0)+(Number(target.purchase_amount)||0);
      const {error:totalError}=await sb.from('farm_staff_totals').upsert({period_id:target.period_id,staff_name:target.employee_name,assessment,payment},{onConflict:'period_id,staff_name'});
      if(totalError)throw totalError;
    }
    const {error}=await sb.from('farm_submission_requests').update({
      status,review_note:note.trim()||null,reviewed_by_uid:currentProfile?.id||null,
      reviewed_by_name:currentProfile?.display_name||'管理者',reviewed_at:new Date().toISOString(),updated_at:new Date().toISOString()
    }).eq('id',id).eq('status','pending');
    if(error)throw error;
    await Promise.all([loadFarmData(false),loadFarmRequests(false)]);
    await writeAudit(
      'farm',
      `Farm申請を${verb}`,
      [
        `申請者：${target.employee_name}`,
        `合計個数：${Number(target.total_quantity||0).toLocaleString('ja-JP')}個`,
        `査定：${Number(target.assessment_amount||0).toLocaleString('ja-JP',{maximumFractionDigits:4})}`,
        `仕入れ金額：${yen.format(Number(target.purchase_amount)||0)}`,
        ...(target.entries||[]).map(item=>`${item.name}：${Number(item.quantity||0).toLocaleString('ja-JP')}個`),
        `申請メモ：${target.note||'なし'}`,
        `承認者コメント：${note||'なし'}`
      ].join('\n'),
      target.employee_name
    );
    toast(`Farm申請を${verb}しました`);
  }catch(error){alert(`Farm申請を${verb}できませんでした：`+error.message)}
}

function renderFarmItemSettings(){
  const body=$('farmItemSettingsBody');if(!body)return;
  body.innerHTML=(farmItems||[]).map((x,i)=>`<tr data-farm-item-setting="${x.id||''}">
    <td>${i+1}</td>
    <td><input class="farm-setting-name" value="${esc(x.name)}"></td>
    <td><input class="farm-setting-cost" type="number" min="0" step="1" value="${Number(x.cost_price)||0}"></td>
    <td><input class="farm-setting-rate" type="number" min="0" step="0.01" value="${Number(x.assessment_rate??x.unit_value)||0}"></td>
    <td><input class="farm-setting-sort" type="number" min="0" step="1" value="${farmN(x.sort_order)||i+1}"></td>
    <td><input class="farm-setting-active" type="checkbox" ${x.is_active===false?'':'checked'}></td>
    <td><button class="btn danger" onclick="deleteFarmItemSetting(this)">削除</button></td>
  </tr>`).join('')||'<tr><td colspan="7">品目を追加してください。</td></tr>';
}
function addFarmItemSettingRow(){
  farmItems.push({id:null,name:'新しい品目',cost_price:0,assessment_rate:0,unit_value:0,sort_order:farmItems.length+1,is_active:true});
  renderFarmItemSettings();setFarmTab('itemsmanage');
}
async function deleteFarmItemSetting(button){
  const row=button.closest('tr'),id=row.dataset.farmItemSetting,name=row.querySelector('.farm-setting-name').value;
  if(!confirm(`「${name}」を削除しますか？`))return;
  if(id){const {error}=await sb.from('farm_items').delete().eq('id',id);if(error)return alert('削除できませんでした：'+error.message)}
  farmItems=farmItems.filter(x=>String(x.id||'')!==String(id||'')||x.name!==name);renderFarmItemSettings();renderFarmEntrySheet();
}

async function recalculateCurrentFarmTotals(){
  if(!currentFarmPeriod)return;

  const [
    {data:entries,error:entriesError},
    {data:items,error:itemsError},
    {data:existing,error:existingError}
  ]=await Promise.all([
    sb.from('farm_entries').select('*').eq('period_id',currentFarmPeriod),
    sb.from('farm_items').select('*'),
    sb.from('farm_staff_totals').select('staff_name').eq('period_id',currentFarmPeriod)
  ]);

  if(entriesError)throw entriesError;
  if(itemsError)throw itemsError;
  if(existingError)throw existingError;

  const itemMap=new Map((items||[]).map(item=>[String(item.id),item]));
  const staffMap=new Map();

  (existing||[]).forEach(row=>{
    staffMap.set(row.staff_name,{
      period_id:Number(currentFarmPeriod),
      staff_name:row.staff_name,
      assessment:0,
      payment:0
    });
  });

  (entries||[]).forEach(row=>{
    const item=itemMap.get(String(row.item_id));
    if(!item)return;

    if(!staffMap.has(row.staff_name)){
      staffMap.set(row.staff_name,{
        period_id:Number(currentFarmPeriod),
        staff_name:row.staff_name,
        assessment:0,
        payment:0
      });
    }

    const staff=staffMap.get(row.staff_name);
    const quantity=Number(row.quantity)||0;
    const assessmentRate=Number(item.assessment_rate??item.unit_value)||0;
    const costPrice=Number(item.cost_price)||0;

    staff.assessment+=quantity*assessmentRate;
    staff.payment+=quantity*costPrice;
  });

  const payload=[...staffMap.values()];
  if(!payload.length)return;

  const {error}=await sb
    .from('farm_staff_totals')
    .upsert(payload,{onConflict:'period_id,staff_name'});

  if(error)throw error;
}

async function saveFarmItemSettings(){
  const rows=[...document.querySelectorAll('#farmItemSettingsBody tr[data-farm-item-setting]')];
  const records=rows.map((row,i)=>({
    id:row.dataset.farmItemSetting?Number(row.dataset.farmItemSetting):null,
    name:row.querySelector('.farm-setting-name').value.trim(),
    cost_price:Math.max(0,Math.round(Number(row.querySelector('.farm-setting-cost').value)||0)),
    assessment_rate:Math.max(0,Number(row.querySelector('.farm-setting-rate').value)||0),
    sort_order:Math.max(0,Math.round(Number(row.querySelector('.farm-setting-sort').value)||i+1)),
    is_active:row.querySelector('.farm-setting-active').checked
  })).filter(x=>x.name);

  if(!records.length)return alert('Farm品目を1つ以上入力してください。');
  const duplicates=records.map(x=>x.name).filter((v,i,a)=>a.indexOf(v)!==i);
  if(duplicates.length)return alert('同じ品目名が重複しています：'+[...new Set(duplicates)].join('、'));

  try{
    for(const record of records){
      const payload={
        name:record.name,
        cost_price:record.cost_price,
        assessment_rate:record.assessment_rate,
        sort_order:record.sort_order,
        is_active:record.is_active
      };
      let result;
      if(record.id){
        result=await sb.from('farm_items').update(payload).eq('id',record.id);
      }else{
        result=await sb.from('farm_items').upsert(payload,{onConflict:'name'});
      }
      if(result.error)throw new Error(`${record.name}：${result.error.message}`);
    }
    await recalculateCurrentFarmTotals();
    await loadFarmData(false);
    renderFarmItemSettings();
    renderFarmEntrySheet();
    renderRanking?.();
    renderEmployeeRanking?.();
    toast('品目設定を保存し、全員の査定・仕入れ金額を再計算しました');
  }catch(error){
    console.error('Farm item save error',error);
    alert('Farm品目設定を保存できませんでした。\n'+(error?.message||error)+'\n\nVer.18.1.7の修復SQLを実行してください。');
  }
}

/* Existing rendering hooks */
const originalLoadInventorySnapshot=loadInventorySnapshot;
loadInventorySnapshot=async function(show=false){
  await originalLoadInventorySnapshot(show);
  inventorySpreadsheetRows=inventorySnapshot.map((x,i)=>({id:x.id||null,name:x.name,stock:x.stock,min_stock:x.min,status:x.status||'',sort_order:x.sort_order??i+1}));
  renderInventorySpreadsheet();renderEmployeeInventoryCountSheet();
};
const originalLoadFarmData=loadFarmData;
loadFarmData=async function(show=false){
  await originalLoadFarmData(show);
  renderFarmEntrySheet();renderFarmItemSettings();
};
const originalSetFarmTab=setFarmTab;
setFarmTab=function(tab){
  document.querySelectorAll('[data-farm-tab]').forEach(b=>b.classList.toggle('active',b.dataset.farmTab===tab));
  document.querySelectorAll('#page-farm .farm-view').forEach(v=>v.classList.remove('active'));
  $('farmView'+tab[0].toUpperCase()+tab.slice(1))?.classList.add('active');
  if(tab==='requests')loadFarmRequests(false);
  if(tab==='staffmanage')renderFarmManage();
  if(tab==='itemsmanage')renderFarmItemSettings();
};


/* =========================================================
   SOURCE: bootstrap.js
========================================================= */
(() => {
  'use strict';

  async function bootPortal() {
    try {
      if (typeof startRealtimeFallback === 'function') {
        startRealtimeFallback();
      }
      if (typeof restoreSession === 'function') {
        await restoreSession();
      }
      console.info('Lait Divin Staff Portal Ver.26.0.3 initialized');
    } catch (error) {
      console.error('Portal initialization failed:', error);
      const statusNodes = document.querySelectorAll('[data-realtime-status]');
      statusNodes.forEach((node) => {
        node.textContent = '● 初期化エラー';
        node.classList.add('sync-warn');
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(bootPortal, 0), { once: true });
  } else {
    setTimeout(bootPortal, 0);
  }
})();
