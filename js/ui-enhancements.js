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
