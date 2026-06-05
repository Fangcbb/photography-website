(function(){
  // 智能百度推送：只推新 URL，每天每个 URL 只推一次
  var KEY = 'baidu_pushed';
  var DATE_KEY = 'baidu_push_date';
  var today = new Date().toISOString().slice(0, 10);

  // 获取已推送记录
  function getPushed() {
    try {
      var date = localStorage.getItem(DATE_KEY);
      if (date !== today) {
        localStorage.removeItem(KEY);
        localStorage.setItem(DATE_KEY, today);
        return {};
      }
      return JSON.parse(localStorage.getItem(KEY) || '{}');
    } catch(e) { return {}; }
  }

  // 标记已推送
  function setPushed(url) {
    try {
      var pushed = getPushed();
      pushed[url] = 1;
      localStorage.setItem(KEY, JSON.stringify(pushed));
    } catch(e) {}
  }

  var url = window.location.href;
  var pushed = getPushed();

  // 已经推过的 URL 不再推
  if (pushed[url]) return;

  var bp = document.createElement('script');
  var curProtocol = window.location.protocol.split(':')[0];
  if (curProtocol === 'https') {
    bp.src = 'https://zz.bdstatic.com/linksubmit/push.js';
  } else {
    bp.src = 'http://push.zhanzhang.baidu.com/push.js';
  }
  bp.async = true;
  bp.onload = function() { setPushed(url); };
  var s = document.getElementsByTagName("script")[0];
  s.parentNode.insertBefore(bp, s);
})();
