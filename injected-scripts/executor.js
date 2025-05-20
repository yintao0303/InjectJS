/**
 * JS注入器 - 脚本执行器
 * 
 * 这个文件可以通过URL加载，避免内联脚本的CSP限制
 * 参数通过URL查询参数传递
 */

(function() {
  // 获取URL中的参数
  const getScriptParams = () => {
    const params = new URLSearchParams(document.currentScript.src.split('?')[1] || '');
    return {
      id: params.get('id') || '',
      name: params.get('name') || '未命名脚本'
    };
  };
  
  // 记录执行信息到控制台
  const logExecution = (name, success, error) => {
    if (success) {
      console.log(`[JS注入器] "${name}" 执行成功`);
    } else {
      console.error(`[JS注入器] "${name}" 执行错误:`, error);
    }
  };
  
  // 监听消息事件，用于接收要执行的代码
  window.addEventListener('message', function(event) {
    // 确保消息来自于同一窗口
    if (event.source !== window) return;
    
    // 验证消息是否来自JS注入器
    if (event.data && event.data.type === 'js-injector-execute') {
      try {
        const { code, name, id } = event.data;
        
        // 立即执行代码
        (new Function(code))();
        
        // 记录成功执行
        logExecution(name, true);
        
        // 通知执行完成
        window.postMessage({
          type: 'js-injector-executed',
          id: id,
          success: true
        }, '*');
      } catch (error) {
        // 记录执行错误
        logExecution(event.data.name, false, error);
        
        // 通知执行错误
        window.postMessage({
          type: 'js-injector-executed',
          id: event.data.id,
          success: false,
          error: error.message
        }, '*');
      }
    }
  });
  
  // 如果脚本带有直接代码参数，则立即执行
  const scriptParams = getScriptParams();
  if (scriptParams.id) {
    // 通知已准备好执行
    window.postMessage({
      type: 'js-injector-ready',
      id: scriptParams.id
    }, '*');
  }
  
  // 通知脚本已加载
  console.log('[JS注入器] 执行器脚本已加载');
})(); 