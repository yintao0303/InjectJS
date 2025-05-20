/**
 * JS注入器 - 通用注入脚本
 * 
 * 此脚本通过web_accessible_resources机制加载，用于在网页中执行自定义JavaScript代码
 */

// 全局命名空间，避免污染页面环境
window._JSInjector = window._JSInjector || {
  // 唯一ID，避免冲突
  id: 'js-injector-' + Date.now(),
  
  // 版本信息
  version: '1.0',
  
  // 执行的脚本历史
  executedScripts: [],
  
  // 已创建的Blob URLs (需要在不使用时释放)
  blobUrls: [],
  
  // 通过Blob URL执行函数 - 避免内联脚本和eval
  executeViaBlob: function(code, scriptName) {
    try {
      // 创建一个带有包装的脚本Blob
      const wrappedCode = `
        try {
          ${code}
          console.log('[JS注入器] "${scriptName || '未命名脚本'}" 执行成功');
        } catch(err) {
          console.error('[JS注入器] "${scriptName || '未命名脚本'}" 执行错误:', err);
        }
      `;
      
      // 创建Blob对象
      const blob = new Blob([wrappedCode], { type: 'application/javascript' });
      
      // 创建Blob URL
      const blobUrl = URL.createObjectURL(blob);
      
      // 存储创建的URL以便后续清理
      this.blobUrls.push(blobUrl);
      
      // 创建脚本元素并设置src为Blob URL
      const script = document.createElement('script');
      script.src = blobUrl;
      script.setAttribute('data-js-injector', this.id);
      script.setAttribute('data-script-name', scriptName || 'unnamed-script');
      
      // 添加到文档中执行
      document.head.appendChild(script);
      
      // 记录执行信息
      this.executedScripts.push({
        name: scriptName || 'unnamed-script',
        timestamp: Date.now(),
        success: true,
        method: 'blob-url'
      });
      
      return true;
    } catch (error) {
      console.error('[JS注入器] 执行错误:', error);
      
      this.executedScripts.push({
        name: scriptName || 'unnamed-script',
        timestamp: Date.now(),
        success: false,
        error: error.message,
        method: 'blob-url'
      });
      
      return false;
    }
  },
  
  // 释放所有创建的Blob URLs
  releaseBlobs: function() {
    this.blobUrls.forEach(url => {
      try {
        URL.revokeObjectURL(url);
      } catch (e) {
        console.error('[JS注入器] 释放Blob URL失败:', e);
      }
    });
    this.blobUrls = [];
  },
  
  // 主要的注入函数
  injectScript: function(code, scriptName) {
    // 使用Blob URL方法注入
    return this.executeViaBlob(code, scriptName);
  },
  
  // 页面卸载时清理资源
  cleanup: function() {
    this.releaseBlobs();
  }
};

// 添加页面卸载事件监听器以清理资源
window.addEventListener('beforeunload', function() {
  if (window._JSInjector) {
    window._JSInjector.cleanup();
  }
});

// 通知扩展脚本已加载
console.log('[JS注入器] 注入核心脚本已加载，版本:', window._JSInjector.version); 