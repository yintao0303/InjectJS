// 导入i18n模块
import { i18n, translator } from './i18n/index.js';

document.addEventListener('DOMContentLoaded', async () => {
  // 获取URL参数
  const urlParams = new URLSearchParams(window.location.search);
  const domain = urlParams.get('domain') || '';
  const scriptId = urlParams.get('id') || '';
  
  // 获取DOM元素
  const domainInput = document.getElementById('domain');
  const nameInput = document.getElementById('name');
  const codeTextarea = document.getElementById('code');
  const codeEditorDiv = document.getElementById('code-editor');
  const saveButton = document.getElementById('save');
  const returnButton = document.getElementById('return');
  const cancelButton = document.getElementById('cancel');
  const deleteButton = document.getElementById('delete');
  const pageTitle = document.getElementById('page-title');
  const formatCodeButton = document.getElementById('format-code');
  const toggleAutocompleteButton = document.getElementById('toggle-autocomplete');
  const toggleThemeButton = document.getElementById('toggle-theme');
  const toastContainer = document.getElementById('toast-container');
  
  // 添加语言切换按钮
  const titleContainer = document.createElement('div');
  titleContainer.style.display = 'flex';
  titleContainer.style.alignItems = 'center';
  
  const langToggle = document.createElement('button');
  langToggle.id = 'lang-toggle';
  langToggle.innerHTML = `<span style="display: flex; align-items: center; gap: 4px;">
    <span style="font-size: 18px;">🌐</span><span data-i18n="language">语言</span>
  </span>`;
  langToggle.title = 'Switch Language / 切换语言';
  langToggle.className = 'lang-toggle';
  
  // 将原标题和页面标题替换为容器
  const titleContent = pageTitle.textContent;
  pageTitle.textContent = '';
  
  const titleSpan = document.createElement('span');
  titleSpan.textContent = titleContent;
  titleSpan.setAttribute('data-i18n', scriptId ? 'edit_script' : 'add_script');
  
  titleContainer.appendChild(titleSpan);
  titleContainer.appendChild(langToggle);
  pageTitle.appendChild(titleContainer);
  
  // 暗黑模式变量
  let isDarkMode = false;
  
  // 编辑器变量 - 提前声明
  let editor = null;
  
  // 初始化主题
  await initTheme();
  
  // 初始化页面翻译
  translator.translatePage();
  
  // 监听语言切换按钮点击
  langToggle.addEventListener('click', toggleLanguage);
  
  // 切换语言函数
  function toggleLanguage() {
    // 获取当前语言
    const currentLang = i18n.getLanguage();
    // 切换语言
    const newLang = currentLang === 'en' ? 'zh' : 'en';
    // 设置新语言
    i18n.setLanguage(newLang);
    // 显示提示
    showToast(newLang === 'en' ? 'Switched to English' : '已切换到中文', 'info');
    
    // 更新自动补全按钮文本
    updateAutocompleteButtonText();
  }
  
  // 初始化主题
  async function initTheme() {
    return new Promise((resolve) => {
      // 从本地存储中获取主题设置
      chrome.storage.local.get('darkMode', (data) => {
        isDarkMode = data.darkMode === true;
        resolve();
      });
    });
  }
  
  // 应用主题
  function applyTheme(isDark) {
    if (isDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
      if (editor) {
        editor.setOption('theme', 'monokai');
      }
      currentTheme = 'monokai';
    } else {
      document.documentElement.removeAttribute('data-theme');
      if (editor) {
        editor.setOption('theme', 'default');
      }
      currentTheme = 'default';
    }
  }
  
  // 初始化CodeMirror编辑器
  editor = CodeMirror(codeEditorDiv, {
    value: '',
    mode: 'javascript',
    theme: isDarkMode ? 'monokai' : 'default',
    lineNumbers: true,
    tabSize: 2,
    indentWithTabs: false,
    indentUnit: 2,
    matchBrackets: true,
    autoCloseBrackets: true,
    extraKeys: {
      'Ctrl-Space': 'autocomplete',
      'Tab': function(cm) {
        const spaces = Array(cm.getOption('indentUnit') + 1).join(' ');
        cm.replaceSelection(spaces);
      }
    }
  });
  
  // 自动补全状态
  let autocompleteEnabled = true;
  
  // 主题状态 - 更新为与暗黑模式同步
  let currentTheme = isDarkMode ? 'monokai' : 'default';
  
  // 现在应用主题，此时editor已经初始化
  applyTheme(isDarkMode);
  
  // 切换主题
  function toggleTheme() {
    isDarkMode = !isDarkMode;
    
    // 保存主题设置
    chrome.storage.local.set({ darkMode: isDarkMode });
    
    // 应用主题
    applyTheme(isDarkMode);
    
    showToast(isDarkMode ? i18n.t('switched_to_dark_theme') : i18n.t('switched_to_light_theme'), 'info');
  }
  
  // 添加事件监听
  toggleThemeButton.addEventListener('click', toggleTheme);
  
  // Toast通知系统
  function showToast(message, type = 'info', duration = 3000) {
    // 创建toast元素
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    // 添加到容器
    toastContainer.appendChild(toast);
    
    // 显示动画
    setTimeout(() => {
      toast.classList.add('show');
    }, 10);
    
    // 自动消失
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        toastContainer.removeChild(toast);
      }, 300);
    }, duration);
    
    return toast;
  }
  
  // 替代confirm的函数
  function showConfirmToast(message) {
    return new Promise((resolve) => {
      // 创建toast元素
      const toast = document.createElement('div');
      toast.className = 'toast toast-warning';
      
      // 添加消息和按钮
      const messageEl = document.createElement('div');
      messageEl.textContent = message;
      messageEl.style.marginBottom = '10px';
      toast.appendChild(messageEl);
      
      const buttonContainer = document.createElement('div');
      buttonContainer.style.marginTop = '10px';
      buttonContainer.style.display = 'flex';
      buttonContainer.style.justifyContent = 'center';
      buttonContainer.style.gap = '10px';
      
      const confirmBtn = document.createElement('button');
      confirmBtn.textContent = i18n.t('confirm');
      confirmBtn.style.padding = '5px 10px';
      confirmBtn.style.border = 'none';
      confirmBtn.style.borderRadius = '3px';
      confirmBtn.style.backgroundColor = '#4caf50';
      confirmBtn.style.color = 'white';
      confirmBtn.style.cursor = 'pointer';
      
      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = i18n.t('cancel');
      cancelBtn.style.padding = '5px 10px';
      cancelBtn.style.border = 'none';
      cancelBtn.style.borderRadius = '3px';
      cancelBtn.style.backgroundColor = '#f44336';
      cancelBtn.style.color = 'white';
      cancelBtn.style.cursor = 'pointer';
      
      buttonContainer.appendChild(confirmBtn);
      buttonContainer.appendChild(cancelBtn);
      toast.appendChild(buttonContainer);
      
      // 添加到容器
      toastContainer.appendChild(toast);
      
      // 显示动画
      setTimeout(() => {
        toast.classList.add('show');
      }, 10);
      
      // 按钮事件
      confirmBtn.addEventListener('click', () => {
        toast.classList.remove('show');
        setTimeout(() => {
          toastContainer.removeChild(toast);
          resolve(true);
        }, 300);
      });
      
      cancelBtn.addEventListener('click', () => {
        toast.classList.remove('show');
        setTimeout(() => {
          toastContainer.removeChild(toast);
          resolve(false);
        }, 300);
      });
    });
  }
  
  // 检查未保存的更改
  async function checkUnsavedChanges() {
    const originalData = await chrome.storage.local.get('scripts');
    const scripts = originalData.scripts || {};
    
    // 判断是否有未保存的更改
    if (scriptId && scripts[scriptId] && !scripts[scriptId].unsaved) {
      // 获取原始脚本
      const originalScript = scripts[scriptId];
      
      // 比较输入值和原始值
      const hasChanges = 
        domainInput.value !== originalScript.domain || 
        nameInput.value !== originalScript.name || 
        editor.getValue() !== originalScript.code;
      
      if (hasChanges) {
        // 标记未保存更改
        scripts[scriptId].unsaved = true;
        await chrome.storage.local.set({ scripts });
      }
    }
  }
  
  // 格式化JS代码
  function formatJSCode(code) {
    try {
      // 简单格式化，替换多个空格和缩进
      let formatted = code.replace(/\n{3,}/g, '\n\n'); // 删除多余的换行
      
      // 添加适当的缩进
      const lines = formatted.split('\n');
      let indentLevel = 0;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // 调整缩进级别
        if (line.match(/[{[]$/)) {
          // 此行以 { 或 [ 结束，下一行需要增加缩进
          lines[i] = '  '.repeat(indentLevel) + line;
          indentLevel++;
        } else if (line.match(/^[}\]]/)) {
          // 此行以 } 或 ] 开始，减少缩进
          indentLevel = Math.max(0, indentLevel - 1);
          lines[i] = '  '.repeat(indentLevel) + line;
        } else {
          // 使用当前缩进级别
          lines[i] = '  '.repeat(indentLevel) + line;
        }
        
        // 检查行结束是否有额外的 }]
        if (line.match(/^[^}\]]*[}\]]+/)) {
          const rightBraces = (line.match(/[}\]]/g) || []).length;
          const leftBraces = (line.match(/[{[]/g) || []).length;
          
          // 如果右括号多于左括号，减少相应的缩进
          if (rightBraces > leftBraces) {
            indentLevel = Math.max(0, indentLevel - (rightBraces - leftBraces));
          }
        }
      }
      
      return lines.join('\n');
    } catch (e) {
      console.error('格式化代码时出错:', e);
      showToast(i18n.t('format_error'), 'error');
      return code; // 返回原始代码
    }
  }
  
  // 格式化按钮事件
  formatCodeButton.addEventListener('click', () => {
    const currentCode = editor.getValue();
    const formattedCode = formatJSCode(currentCode);
    editor.setValue(formattedCode);
    showToast(i18n.t('code_formatted'), 'success');
  });
  
  // 切换自动补全
  function toggleAutocomplete() {
    autocompleteEnabled = !autocompleteEnabled;
    
    const extraKeys = autocompleteEnabled 
      ? {
          'Ctrl-Space': 'autocomplete',
          'Tab': function(cm) {
            const spaces = Array(cm.getOption('indentUnit') + 1).join(' ');
            cm.replaceSelection(spaces);
          }
        }
      : {
          'Tab': function(cm) {
            const spaces = Array(cm.getOption('indentUnit') + 1).join(' ');
            cm.replaceSelection(spaces);
          }
        };
    
    editor.setOption('extraKeys', extraKeys);
    updateAutocompleteButtonText();
    
    showToast(
      autocompleteEnabled 
        ? i18n.t('autocomplete_enabled')
        : i18n.t('autocomplete_disabled'), 
      'info'
    );
  }
  
  // 更新自动补全按钮文本
  function updateAutocompleteButtonText() {
    const autoCompleteTextSpan = toggleAutocompleteButton.querySelector('span:last-child');
    if (autoCompleteTextSpan) {
      autoCompleteTextSpan.textContent = autocompleteEnabled 
        ? i18n.t('autocomplete_on')
        : i18n.t('autocomplete_off');
    }
  }
  
  toggleAutocompleteButton.addEventListener('click', toggleAutocomplete);
  
  // 保存按钮事件
  saveButton.addEventListener('click', async () => {
    // 获取输入值
    const domainValue = domainInput.value.trim();
    const nameValue = nameInput.value.trim();
    const codeValue = editor.getValue();
    
    // 验证输入
    if (!domainValue) {
      showToast(i18n.t('domain_required'), 'error');
      domainInput.focus();
      return;
    }
    
    if (!nameValue) {
      showToast(i18n.t('name_required'), 'error');
      nameInput.focus();
      return;
    }
    
    if (!codeValue) {
      showToast(i18n.t('code_required'), 'error');
      editor.focus();
      return;
    }
    
    try {
      // 获取脚本
      const data = await chrome.storage.local.get('scripts');
      const scripts = data.scripts || {};
      
      // 当前时间
      const now = Date.now();
      
      if (scriptId) {
        // 更新现有脚本
        const script = scripts[scriptId];
        if (script) {
          script.domain = domainValue;
          script.name = nameValue;
          script.code = codeValue;
          script.updatedAt = now;
          delete script.unsaved; // 删除未保存标记
        }
      } else {
        // 创建新脚本ID
        const newId = 'script_' + now;
        
        // 添加新脚本
        scripts[newId] = {
          domain: domainValue,
          name: nameValue,
          code: codeValue,
          createdAt: now,
          updatedAt: now
        };
      }
      
      // 保存脚本
      await chrome.storage.local.set({ scripts });
      
      showToast(i18n.t('script_saved'), 'success');
      
      // 延迟返回，让用户看到保存成功消息
      setTimeout(() => {
        window.location.href = 'manager.html';
      }, 1500);
    } catch (error) {
      console.error('保存脚本时出错:', error);
      showToast(i18n.t('save_error') + ': ' + error.message, 'error');
    }
  });
  
  // 取消按钮事件
  cancelButton.addEventListener('click', async () => {
    // 如果是编辑现有脚本，检查是否有未保存的更改
    if (scriptId) {
      const data = await chrome.storage.local.get('scripts');
      const scripts = data.scripts || {};
      const script = scripts[scriptId];
      
      if (script && script.unsaved) {
        // 有未保存的更改，询问用户
        const confirmed = await showConfirmToast(i18n.t('unsaved_changes'));
        if (!confirmed) return;
        
        // 删除未保存标记
        delete script.unsaved;
        await chrome.storage.local.set({ scripts });
      }
    }
    
    // 返回到管理页面
    window.location.href = 'manager.html';
  });
  
  // 返回按钮事件
  returnButton.addEventListener('click', async () => {
    // 如果是编辑现有脚本，检查是否有未保存的更改
    if (scriptId) {
      const data = await chrome.storage.local.get('scripts');
      const scripts = data.scripts || {};
      const script = scripts[scriptId];
      
      if (script && script.unsaved) {
        // 有未保存的更改，询问用户
        const confirmed = await showConfirmToast(i18n.t('unsaved_changes'));
        if (!confirmed) return;
        
        // 删除未保存标记
        delete script.unsaved;
        await chrome.storage.local.set({ scripts });
      }
    }
    
    // 返回到管理页面
    window.location.href = 'manager.html';
  });
  
  // 删除按钮事件
  deleteButton.addEventListener('click', async () => {
    // 确认删除
    const confirmed = await showConfirmToast(i18n.t('confirm_delete'));
    
    if (confirmed) {
      try {
        // 获取脚本
        const data = await chrome.storage.local.get('scripts');
        const scripts = data.scripts || {};
        
        // 删除脚本
        if (scripts[scriptId]) {
          delete scripts[scriptId];
          await chrome.storage.local.set({ scripts });
          
          showToast(i18n.t('script_deleted'), 'success');
          
          // 延迟返回，让用户看到删除成功消息
          setTimeout(() => {
            window.location.href = 'manager.html';
          }, 1500);
        }
      } catch (error) {
        console.error('删除脚本时出错:', error);
        showToast(i18n.t('delete_error') + ': ' + error.message, 'error');
      }
    }
  });
  
  // 如果提供了域名或脚本ID，自动填充表单
  if (domain) {
    domainInput.value = domain;
  }
  
  if (scriptId) {
    // 加载脚本并填充表单
    try {
      const data = await chrome.storage.local.get('scripts');
      const scripts = data.scripts || {};
      const script = scripts[scriptId];
      
      if (script) {
        // 更新页面标题
        if (titleSpan) {
          titleSpan.textContent = i18n.t('edit_script');
          titleSpan.setAttribute('data-i18n', 'edit_script');
        } else {
          pageTitle.textContent = i18n.t('edit_script');
          pageTitle.setAttribute('data-i18n', 'edit_script');
        }
        
        // 填充表单
        domainInput.value = script.domain;
        nameInput.value = script.name;
        editor.setValue(script.code || '');
        
        // 显示删除按钮
        deleteButton.style.display = 'flex';
      }
    } catch (error) {
      console.error('加载脚本时出错:', error);
      showToast(i18n.t('load_script_error') + ': ' + error.message, 'error');
    }
  }
  
  // 监听输入变化，标记未保存的更改
  domainInput.addEventListener('input', checkUnsavedChanges);
  nameInput.addEventListener('input', checkUnsavedChanges);
  editor.on('change', checkUnsavedChanges);
  
  // 设置自动补全
  updateAutocompleteButtonText();
});