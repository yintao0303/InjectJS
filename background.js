// 监听标签页更新事件
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // 当页面加载完成时
  if (changeInfo.status === 'complete' && tab.url) {
    // 确保是http或https链接
    if (!tab.url.startsWith('http://') && !tab.url.startsWith('https://')) {
      return; // 不是网页，不执行注入
    }
    
    try {
      // 从URL中获取域名
      let url = new URL(tab.url);
      let domain = url.hostname;
      
      // 从存储中获取所有注入脚本
      chrome.storage.local.get('scripts', (data) => {
        const scripts = data.scripts || {};
        
        // 检查当前域名是否有对应的注入脚本
        for (const key in scripts) {
          // 如果域名完全匹配或者是通配符匹配
          if (domain === scripts[key].domain || 
              (scripts[key].domain.startsWith('*.') && domain.endsWith(scripts[key].domain.substring(1)))) {
            
            // 检查脚本是否被启用，如果未明确设置则默认为启用
            const isEnabled = scripts[key].enabled !== false;
            
            // 只有启用的脚本才会被注入
            if (!isEnabled) {
              console.log(`跳过被禁用的脚本: ${scripts[key].name || '未命名脚本'} (${scripts[key].domain})`);
              continue; // 跳过禁用的脚本
            }
            
            // 预先获取资源URL (在后台脚本中获取，而不是在注入的脚本中)
            const injectorUrl = chrome.runtime.getURL('injected-scripts/injector.js');
            const executorUrl = chrome.runtime.getURL('injected-scripts/executor.js');
            
            // 使用内容脚本注入模式
            injectWithContentScript(tabId, scripts[key])
              .then(result => {
                console.log('注入成功:', result);
              })
              .catch(error => {
                console.error('主要注入方法失败:', error);
                // 尝试备用方法1: 辅助脚本方式
                injectHelperScript(tabId)
                  .then(() => injectUserScript(tabId, scripts[key]))
                  .then(result => {
                    console.log('备用方法1成功:', result);
                  })
                  .catch(err => {
                    console.error('备用方法1失败:', err);
                    // 尝试备用方法2: Blob URL方式
                    fallbackInjection(tabId, scripts[key])
                      .then(result => {
                        console.log('备用方法2成功:', result);
                      })
                      .catch(err2 => {
                        console.error('备用方法2失败:', err2);
                        // 最后尝试严格CSP兼容的注入方法
                        strictCSPFallback(tabId, scripts[key])
                          .then(result => {
                            console.log('严格CSP兼容注入' + (result ? '成功' : '失败'));
                          })
                          .catch(finalError => {
                            console.error('所有注入方法都失败:', finalError);
                          });
                      });
                  });
              });
            
            break;
          }
        }
      });
    } catch (error) {
      console.error('处理URL时出错:', error);
    }
  }
});

// 通过内容脚本注入 - 此方法最可靠，能绕过大多数CSP限制
async function injectWithContentScript(tabId, scriptInfo) {
  // 获取扩展资源的完整URL
  const injectorUrl = chrome.runtime.getURL('injected-scripts/injector.js');
  const executorUrl = chrome.runtime.getURL('injected-scripts/executor.js');
  
  // 首先尝试直接作为内容脚本注入
  // 这种方式会在扩展的上下文中运行，绕过网站的CSP
  return chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: triggerInjection,
    args: [scriptInfo, injectorUrl, executorUrl],
    world: "MAIN" // 在主世界中执行以访问页面的DOM和JS上下文
  });
}

// 在页面中触发注入过程
async function triggerInjection(scriptInfo, injectorUrl, executorUrl) {
  try {
    // 创建脚本文件的URL
    const createScriptFileUrl = (code) => {
      const blob = new Blob([code], { type: 'application/javascript' });
      return URL.createObjectURL(blob);
    };
    
    // 添加执行器脚本
    const loadExecutorScript = () => {
      return new Promise((resolve, reject) => {
        // 生成唯一ID用于脚本通信
        const scriptId = 'js-injector-' + Date.now();
        
        // 创建消息监听器
        const messageHandler = (event) => {
          if (event.source !== window) return;
          
          if (event.data && event.data.type === 'js-injector-ready' && 
              event.data.id === scriptId) {
            // 当executor.js准备好后，发送要执行的代码
            window.postMessage({
              type: 'js-injector-execute',
              id: scriptId,
              name: scriptInfo.name || '未命名脚本',
              code: scriptInfo.code
            }, '*');
          }
          
          if (event.data && event.data.type === 'js-injector-executed' && 
              event.data.id === scriptId) {
            // 执行完成，移除监听器
            window.removeEventListener('message', messageHandler);
            
            if (event.data.success) {
              resolve(true);
            } else {
              reject(new Error(event.data.error || '执行失败'));
            }
          }
        };
        
        // 添加消息监听
        window.addEventListener('message', messageHandler);
        
        // 创建脚本元素
        const script = document.createElement('script');
        script.src = `${executorUrl}?id=${scriptId}&t=${Date.now()}`;
        script.setAttribute('data-js-injector', 'executor');
        document.head.appendChild(script);
        
        // 设置超时
        setTimeout(() => {
          window.removeEventListener('message', messageHandler);
          reject(new Error('执行超时'));
        }, 10000);
      });
    };
    
    // 尝试使用executor脚本执行
    try {
      await loadExecutorScript();
      return { success: true, method: 'executor' };
    } catch (executorError) {
      console.warn('使用executor脚本执行失败:', executorError);
      
      // 尝试辅助脚本执行
      const loadHelperScript = () => {
        return new Promise((resolve, reject) => {
          if (window._JSInjector) {
            resolve(true);
            return;
          }
          
          const helperScript = document.createElement('script');
          helperScript.onload = () => resolve(true);
          helperScript.onerror = (e) => reject(new Error('加载辅助脚本失败: ' + e.message));
          helperScript.src = injectorUrl;
          document.head.appendChild(helperScript);
        });
      };
      
      try {
        // 执行注入流程
        await loadHelperScript();
        
        // 如果辅助脚本加载成功且提供了injectScript方法，则使用它
        if (window._JSInjector && typeof window._JSInjector.injectScript === 'function') {
          window._JSInjector.injectScript(scriptInfo.code, scriptInfo.name);
          return { success: true, method: 'helper' };
        }
      } catch (helperError) {
        console.warn('使用辅助脚本执行失败:', helperError);
      }
      
      // 最后尝试Blob URL方法
      const loadUserScript = () => {
        // 在严格CSP环境中，我们使用blob URL而不是内联脚本
        const userScriptUrl = createScriptFileUrl(`
          (function() {
            try {
              ${scriptInfo.code}
              console.log('[JS注入器] 脚本执行成功');
            } catch (error) {
              console.error('[JS注入器] 脚本执行错误:', error);
            }
          })();
        `);
        
        const scriptElem = document.createElement('script');
        scriptElem.src = userScriptUrl;
        document.head.appendChild(scriptElem);
        
        // 清理Blob URL
        setTimeout(() => URL.revokeObjectURL(userScriptUrl), 5000);
      };
      
      // 使用直接注入
      loadUserScript();
      return { success: true, method: 'direct-blob' };
    }
  } catch (error) {
    console.error('执行注入失败:', error);
    return { success: false, error: error.message };
  }
}

// 注入辅助脚本
async function injectHelperScript(tabId) {
  // 获取扩展中injector.js的URL
  const injectorUrl = chrome.runtime.getURL('injected-scripts/injector.js');
  
  // 注入加载器脚本
  return chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: (url) => {
      // 检查是否已经注入
      if (window._JSInjector) {
        return true;
      }
      
      // 创建script标签加载injector.js
      const script = document.createElement('script');
      script.src = url;
      script.id = 'js-injector-loader';
      document.head.appendChild(script);
      
      return true;
    },
    args: [injectorUrl]
  });
}

// 注入用户脚本
async function injectUserScript(tabId, scriptInfo) {
  return chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: (scriptData) => {
      // 等待辅助脚本加载完成
      const checkInterval = setInterval(() => {
        if (window._JSInjector) {
          clearInterval(checkInterval);
          
          // 使用辅助脚本注入用户代码
          window._JSInjector.injectScript(
            scriptData.code,
            scriptData.name
          );
        }
      }, 50);
      
      // 5秒后如果仍未加载，则停止等待
      setTimeout(() => clearInterval(checkInterval), 5000);
      
      return true;
    },
    args: [scriptInfo]
  });
}

// 备用注入方法 - 通过动态添加外部脚本
async function fallbackInjection(tabId, scriptInfo) {
  return chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: (code, name) => {
      try {
        // 使用立即执行的匿名函数创建一个隔离的作用域
        const executeInPage = (codeToExecute, scriptName) => {
          // 创建blob URL来避免内联脚本
          const wrappedCode = `
            (function() {
              try {
                ${codeToExecute}
                console.log('[JS注入器] "${scriptName}" 执行成功');
              } catch(err) {
                console.error('[JS注入器] "${scriptName}" 执行错误:', err);
              }
            })();
          `;
          
          // 创建Blob对象和URL
          const blob = new Blob([wrappedCode], { type: 'application/javascript' });
          const blobUrl = URL.createObjectURL(blob);
          
          // 创建脚本元素并使用blob URL
          const script = document.createElement('script');
          script.src = blobUrl;
          script.setAttribute('data-js-injector', 'fallback');
          script.setAttribute('data-script-name', scriptName);
          
          // 添加到文档头部
          document.head.appendChild(script);
          
          // 释放blob URL (延迟释放确保脚本加载完成)
          setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
          
          return true;
        };
        
        // 执行代码
        return executeInPage(code, name);
      } catch (error) {
        console.error('备用注入方法失败:', error);
        return false;
      }
    },
    args: [scriptInfo.code, scriptInfo.name || '未命名脚本']
  }).catch(error => {
    console.error('备用注入执行失败:', error);
  });
}

// 严格CSP兼容的备用注入 - 使用动态import或fetch绕过CSP限制
async function strictCSPFallback(tabId, scriptInfo) {
  return chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: (code, name) => {
      try {
        // 方法1：使用动态import - 从Blob URL导入模块
        const tryImportMethod = async () => {
          try {
            // 创建一个ES模块格式的代码
            const moduleCode = `
              export default async function() {
                try {
                  ${code}
                  console.log('[JS注入器] "${name}" (ES模块方式) 执行成功');
                  return true;
                } catch(err) {
                  console.error('[JS注入器] "${name}" (ES模块方式) 执行错误:', err);
                  return false;
                }
              }
            `;
            
            // 创建Blob URL
            const blob = new Blob([moduleCode], { type: 'application/javascript' });
            const moduleUrl = URL.createObjectURL(blob);
            
            // 动态导入模块
            const module = await import(moduleUrl);
            
            // 执行默认导出的函数
            const result = await module.default();
            
            // 清理
            setTimeout(() => URL.revokeObjectURL(moduleUrl), 1000);
            
            return result;
          } catch (error) {
            console.warn('ES模块方式执行失败:', error);
            return false;
          }
        };
        
        // 方法2：使用fetch和动态创建的Worker
        const tryWorkerMethod = async () => {
          try {
            // 创建Worker代码
            const workerCode = `
              self.onmessage = function(e) {
                try {
                  // 使用eval在Worker上下文中执行代码
                  // Worker通常有自己的CSP上下文
                  eval(e.data.code);
                  self.postMessage({ success: true });
                } catch (error) {
                  self.postMessage({ success: false, error: error.message });
                }
              };
            `;
            
            // 创建Blob URL
            const blob = new Blob([workerCode], { type: 'application/javascript' });
            const workerUrl = URL.createObjectURL(blob);
            
            // 创建Worker
            const worker = new Worker(workerUrl);
            
            // 返回一个Promise等待Worker执行结果
            return new Promise((resolve) => {
              worker.onmessage = function(e) {
                if (e.data.success) {
                  console.log('[JS注入器] "${name}" (Worker方式) 执行成功');
                } else {
                  console.error('[JS注入器] "${name}" (Worker方式) 执行错误:', e.data.error);
                }
                
                // 终止Worker并清理
                worker.terminate();
                URL.revokeObjectURL(workerUrl);
                resolve(e.data.success);
              };
              
              // 向Worker发送代码
              worker.postMessage({ code });
              
              // 设置超时
              setTimeout(() => {
                worker.terminate();
                URL.revokeObjectURL(workerUrl);
                resolve(false);
              }, 5000);
            });
          } catch (error) {
            console.warn('Worker方式执行失败:', error);
            return false;
          }
        };
        
        // 方法3：使用Data URL作为iframe的src (兼容性较好的方法)
        const tryIframeMethod = () => {
          try {
            // 创建一个隐藏的iframe
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            
            // 准备在iframe中执行的HTML内容
            const htmlContent = `
              <!DOCTYPE html>
              <html>
              <head>
                <script>
                  try {
                    ${code}
                    window.parent.postMessage({ type: 'js-injector-result', success: true }, '*');
                  } catch(err) {
                    console.error('执行错误:', err);
                    window.parent.postMessage({ 
                      type: 'js-injector-result', 
                      success: false, 
                      error: err.message 
                    }, '*');
                  }
                </script>
              </head>
              <body></body>
              </html>
            `;
            
            // 创建data URL
            const dataUrl = 'data:text/html;base64,' + btoa(htmlContent);
            
            // 设置frame的src并添加到文档
            iframe.src = dataUrl;
            
            // 创建消息处理器
            return new Promise((resolve) => {
              const messageHandler = (event) => {
                if (event.data && event.data.type === 'js-injector-result') {
                  window.removeEventListener('message', messageHandler);
                  document.body.removeChild(iframe);
                  
                  if (event.data.success) {
                    console.log('[JS注入器] "${name}" (iframe方式) 执行成功');
                  } else {
                    console.error('[JS注入器] "${name}" (iframe方式) 执行错误:', 
                      event.data.error);
                  }
                  
                  resolve(event.data.success);
                }
              };
              
              window.addEventListener('message', messageHandler);
              document.body.appendChild(iframe);
              
              // 设置超时
              setTimeout(() => {
                window.removeEventListener('message', messageHandler);
                if (document.body.contains(iframe)) {
                  document.body.removeChild(iframe);
                }
                resolve(false);
              }, 5000);
            });
          } catch (error) {
            console.warn('iframe方式执行失败:', error);
            return false;
          }
        };
        
        // 依次尝试各种方法
        return Promise.resolve()
          .then(tryImportMethod)
          .then(result => result ? result : tryWorkerMethod())
          .then(result => result ? result : tryIframeMethod())
          .catch(error => {
            console.error('所有CSP兼容方法都失败:', error);
            return false;
          });
      } catch (error) {
        console.error('严格CSP兼容注入失败:', error);
        return false;
      }
    },
    args: [scriptInfo.code, scriptInfo.name || '未命名脚本']
  }).catch(error => {
    console.error('严格CSP兼容注入执行失败:', error);
  });
} 