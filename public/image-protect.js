(function() {
  // 禁止右键菜单
  document.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    return false;
  });
  
  // 禁止选中文字和图片
  document.addEventListener('selectstart', function(e) {
    e.preventDefault();
    return false;
  });
  
  // 禁止拖拽图片
  document.addEventListener('dragstart', function(e) {
    if (e.target.tagName === 'IMG' || e.target.tagName === 'VIDEO') {
      e.preventDefault();
      return false;
    }
  });
  
  // 禁止开发者工具快捷键
  document.addEventListener('keydown', function(e) {
    if (e.key === 'F12') {
      e.preventDefault();
      return false;
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'I') {
      e.preventDefault();
      return false;
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'J') {
      e.preventDefault();
      return false;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'U') {
      e.preventDefault();
      return false;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      return false;
    }
  });
  
  // 禁止触摸设备长按保存
  document.addEventListener('touchstart', function(e) {
    var clickable = e.target.closest('a, button, [role="button"]');
    if ((e.target.tagName === 'IMG' || e.target.tagName === 'VIDEO') && !clickable) {
      e.preventDefault();
    }
  }, { passive: false });
  
  // 禁止图片拖拽属性
  window.addEventListener('DOMContentLoaded', function() {
    var images = document.getElementsByTagName('img');
    for (var i = 0; i < images.length; i++) {
      images[i].setAttribute('draggable', 'false');
      images[i].setAttribute('oncontextmenu', 'return false');
    }
    var videos = document.getElementsByTagName('video');
    for (var i = 0; i < videos.length; i++) {
      videos[i].setAttribute('draggable', 'false');
      videos[i].setAttribute('oncontextmenu', 'return false');
    }
  });
  
  // 动态添加的图片也禁止拖拽
  window.addEventListener('DOMContentLoaded', function() {
    var observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        mutation.addedNodes.forEach(function(node) {
          if (node.nodeType === 1) {
            if (node.tagName === 'IMG' || node.tagName === 'VIDEO') {
              node.setAttribute('draggable', 'false');
              node.setAttribute('oncontextmenu', 'return false');
            }
            var images = node.querySelectorAll ? node.querySelectorAll('img, video') : [];
            images.forEach(function(img) {
              img.setAttribute('draggable', 'false');
              img.setAttribute('oncontextmenu', 'return false');
            });
          }
        });
      });
    });
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }
  });
})();
