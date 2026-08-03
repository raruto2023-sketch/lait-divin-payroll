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
let campaignData=[];
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


let adminApprovalTab='expense';

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

let delegatedApprovalTab='expense';

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
