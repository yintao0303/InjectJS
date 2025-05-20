// 导入i18n模块
import { i18n, translator } from './i18n/index.js';

document.addEventListener('DOMContentLoaded', async function() {
  // 获取DOM元素
  const currentDomainEl = document.getElementById('current-domain');
  const scriptStatusEl = document.getElementById('script-status');
  const addScriptBtn = document.getElementById('add-script');
  const editScriptBtn = document.getElementById('edit-script');
  const manageScriptsBtn = document.getElementById('manage-scripts');
  const optionsBtn = document.getElementById('options');
  const toggleInjectionSwitch = document.getElementById('toggle-injection');
  const toggleThemeBtn = document.getElementById('toggle-theme');
  const langToggleBtn = document.getElementById('lang-toggle');
  
  // 代码编辑器相关元素
  const codeContainer = document.getElementById('code-container');
  const codeEditorDiv = document.getElementById('code-editor');
  const codeTitle = document.getElementById('code-title');
  const scriptNameInput = document.getElementById('script-name-input');
  const editNameBtn = document.getElementById('edit-name');
  const toggleEditBtn = document.getElementById('toggle-edit');
  const refreshPageBtn = document.getElementById('refresh-page');
  const codeStatus = document.getElementById('code-status');
  const saveScriptBtn = document.getElementById('save-script');
  const emptyState = document.getElementById('empty-state');
  const createScriptBtn = document.getElementById('create-script');
  const toastContainer = document.getElementById('toast-container');
  
  // 获取当前标签页的URL
  let currentDomain = '';
  let currentTabId = null;
  let currentTabUrl = '';
  let matchedScriptId = null;
  let currentScript = null;
  let isEditMode = true; // 默认为编辑模式
  let isEditingName = false;
  let isScriptEnabled = false;
  let isDarkMode = false; // 暗黑模式状态
  let editor = null; // 将编辑器变量提升到顶层作用域
  
  // 初始化主题
  initTheme();
  
  // 初始化UI为编辑模式
  // 更新编辑按钮为保存图标
  toggleEditBtn.innerHTML = '<span>✓</span>';
  toggleEditBtn.title = i18n.t('save_edit');
  
  // 更新状态文本
  if (codeStatus) {
    codeStatus.textContent = i18n.t('edit_mode');
  }
  
  // 等待i18n初始化完成 
  await waitForI18nInit();
  
  // 初始化页面翻译
  translator.translatePage();
  
  // 初始化语言切换按钮
  initLangToggle();
  
  // 初始化主题
  function initTheme() {
    // 从本地存储中获取主题设置
    chrome.storage.local.get('darkMode', (data) => {
      isDarkMode = data.darkMode === true;
      applyTheme(isDarkMode);
      
      // 更新切换按钮状态
      if (toggleThemeBtn) {
        toggleThemeBtn.innerHTML = isDarkMode ? '<span>☀️</span>' : '<span>🌙</span>';
        toggleThemeBtn.title = isDarkMode ? '切换到亮色模式' : '切换到暗色模式';
      }
    });
  }
  
  // 应用主题
  function applyTheme(isDark) {
    if (isDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
      if (editor) {
        editor.setOption('theme', 'monokai'); // 暗色主题
      }
    } else {
      document.documentElement.removeAttribute('data-theme');
      if (editor) {
        editor.setOption('theme', 'default'); // 亮色主题
      }
    }
  }
  
  // 切换主题
  function toggleTheme() {
    isDarkMode = !isDarkMode;
    
    // 应用主题
    applyTheme(isDarkMode);
    
    // 更新切换按钮状态
    if (toggleThemeBtn) {
      toggleThemeBtn.innerHTML = isDarkMode ? '<span>☀️</span>' : '<span>🌙</span>';
      toggleThemeBtn.title = isDarkMode ? '切换到亮色模式' : '切换到暗色模式';
    }
    
    // 保存主题设置
    chrome.storage.local.set({ darkMode: isDarkMode });
  }
  
  // 初始化CodeMirror编辑器
  editor = CodeMirror(codeEditorDiv, {
    value: '',
    mode: 'javascript',
    theme: isDarkMode ? 'monokai' : 'default', // 根据当前主题设置编辑器主题
    lineNumbers: true,
    tabSize: 2,
    indentWithTabs: false,
    indentUnit: 2,
    matchBrackets: true,
    autoCloseBrackets: true,
    readOnly: false, // 默认为可编辑模式，不再是只读
    lineWrapping: false, // 不换行，保持代码整洁
    scrollbarStyle: 'native', // 使用原生滚动条样式
    viewportMargin: Infinity, // 允许视口外的内容渲染
    extraKeys: {
      'Ctrl-Space': 'autocomplete',
      'Tab': function(cm) {
        const spaces = Array(cm.getOption('indentUnit') + 1).join(' ');
        cm.replaceSelection(spaces);
      }
    }
  });
  
  // 更新状态显示
  function updateStatusDisplay(isActive, statusText) {
    // 更新文本内容，保留状态指示器
    const statusIndicator = scriptStatusEl.querySelector('.status-indicator');
    
    // 从状态文本中移除"状态: "前缀
    const displayText = statusText.replace('状态: ', '');
    scriptStatusEl.textContent = displayText;
    scriptStatusEl.insertAdjacentElement('afterbegin', statusIndicator);
    
    // 更新状态类
    if (isActive) {
      scriptStatusEl.classList.add('status-active');
      scriptStatusEl.classList.remove('status-inactive');
      isScriptEnabled = true;
      toggleInjectionSwitch.checked = true;
    } else {
      scriptStatusEl.classList.remove('status-active');
      scriptStatusEl.classList.add('status-inactive');
      isScriptEnabled = false;
      toggleInjectionSwitch.checked = false;
    }
  }
  
  // 启用或禁用切换开关
  function setToggleSwitchState(enabled) {
    toggleInjectionSwitch.disabled = !enabled;
    const switchLabel = toggleInjectionSwitch.closest('.switch');
    if (switchLabel) {
      if (enabled) {
        switchLabel.removeAttribute('data-disabled');
      } else {
        switchLabel.setAttribute('data-disabled', 'true');
      }
    }
  }
  
  // 显示代码
  function showCode(script) {
    currentScript = script;
    codeContainer.classList.remove('hidden');
    codeTitle.textContent = script.name || '未命名脚本';
    scriptNameInput.value = script.name || '未命名脚本';
    editor.setValue(script.code || '');
    emptyState.classList.add('hidden');
    codeEditorDiv.style.display = '';
    editor.refresh(); // 刷新编辑器以确保正确显示
    setEditMode(true); // 默认设置为编辑模式，而不是只读
    
    // 确保保存按钮可见
    saveScriptBtn.classList.remove('hidden');
  }
  
  // 显示空状态
  function showEmptyState() {
    currentScript = null;
    codeContainer.classList.remove('hidden');
    codeEditorDiv.style.display = 'none';
    emptyState.classList.remove('hidden');
    saveScriptBtn.classList.add('hidden');
  }
  
  // 设置编辑模式
  function setEditMode(enabled) {
    isEditMode = enabled;
    editor.setOption('readOnly', !enabled);
    
    if (enabled) {
      codeStatus.textContent = i18n.t('edit_mode');
      toggleEditBtn.innerHTML = '<span>✓</span>';
      toggleEditBtn.title = i18n.t('save_edit');
      saveScriptBtn.classList.remove('hidden');
    } else {
      codeStatus.textContent = i18n.t('read_mode');
      toggleEditBtn.innerHTML = '<span>✎</span>';
      toggleEditBtn.title = i18n.t('switch_edit');
      saveScriptBtn.classList.add('hidden');
    }
  }
  
  // 刷新当前页面
  function refreshPage() {
    if (!currentTabId) {
      showToast(i18n.t('refresh_error'), 'error');
      return;
    }
    
    try {
      // 使用chrome.tabs.reload刷新当前页面
      chrome.tabs.reload(currentTabId);
      showToast(i18n.t('refresh_in_progress'), 'info');
      
      // 延迟关闭popup窗口
      setTimeout(() => {
        window.close();
      }, 1000);
    } catch (error) {
      console.error('刷新页面时出错:', error);
      showToast(i18n.t('refresh_failed') + ': ' + error.message, 'error');
    }
  }
  
  // 切换编辑名称
  function toggleEditName() {
    if (isEditingName) {
      // 保存名称
      const newName = scriptNameInput.value.trim();
      if (newName) {
        currentScript.name = newName;
        codeTitle.textContent = newName;
        
        // 如果是编辑模式，保存名称到脚本对象，但不保存到存储
        if (!isEditMode) {
          // 不在编辑模式时，直接保存到存储
          saveScriptName(newName);
        }
      }
      
      // 隐藏输入框，显示标题
      scriptNameInput.classList.add('hidden');
      codeTitle.classList.remove('hidden');
      editNameBtn.innerHTML = '<span>✏️</span>';
      isEditingName = false;
    } else {
      // 显示输入框，隐藏标题
      scriptNameInput.value = currentScript.name || '未命名脚本';
      scriptNameInput.classList.remove('hidden');
      codeTitle.classList.add('hidden');
      scriptNameInput.focus();
      scriptNameInput.select();
      editNameBtn.innerHTML = '<span>✓</span>';
      isEditingName = true;
    }
  }
  
  // 保存脚本名称
  async function saveScriptName(newName) {
    if (!currentScript || !matchedScriptId) return;
    
    try {
      // 获取当前所有脚本
      const data = await chrome.storage.local.get('scripts');
      const scripts = data.scripts || {};
      
      // 更新脚本名称
      if (scripts[matchedScriptId]) {
        scripts[matchedScriptId].name = newName;
        
        // 保存回存储
        await chrome.storage.local.set({ scripts });
        
        showToast(i18n.t('name_updated'), 'success');
      }
    } catch (error) {
      console.error('保存脚本名称时出错:', error);
      showToast(i18n.t('name_update_failed') + ': ' + error.message, 'error');
    }
  }
  
  // 保存脚本
  async function saveScript() {
    if (!currentScript) return;
    
    try {
      // 如果正在编辑名称，先保存名称
      if (isEditingName) {
        toggleEditName();
      }
      
      // 获取当前所有脚本和禁用脚本
      const data = await chrome.storage.local.get(['scripts', '_disabledScripts']);
      const scripts = data.scripts || {};
      const disabledScripts = data._disabledScripts || {};
      
      // 检查是否是新脚本（临时ID）
      const isNewScript = matchedScriptId.startsWith('temp_');
      
      // 获取当前时间
      const currentTime = Date.now();
      
      // 准备脚本数据
      const scriptData = {
        domain: currentDomain,
        name: currentScript.name,
        code: editor.getValue(),
        createdAt: currentScript.createdAt || currentTime,
        updatedAt: currentTime
      };
      
      if (isNewScript) {
        // 为新脚本创建一个真实的ID
        const realId = 'script_' + currentTime;
        matchedScriptId = realId;
        
        // 根据启用状态决定存储位置
        if (isScriptEnabled) {
          scripts[realId] = scriptData;
        } else {
          disabledScripts[realId] = scriptData;
        }
        
        // 更新状态
        updateStatusDisplay(isScriptEnabled, isScriptEnabled ? i18n.t('status_injected') : i18n.t('status_disabled'));
        editScriptBtn.disabled = false;
      } else {
        // 更新现有脚本 - 首先确定脚本在哪个存储中
        const scriptInActive = scripts[matchedScriptId] !== undefined;
        const scriptInDisabled = disabledScripts[matchedScriptId] !== undefined;
        
        // 保留原始创建时间
        if (scriptInActive && scripts[matchedScriptId].createdAt) {
          scriptData.createdAt = scripts[matchedScriptId].createdAt;
        } else if (scriptInDisabled && disabledScripts[matchedScriptId].createdAt) {
          scriptData.createdAt = disabledScripts[matchedScriptId].createdAt;
        }
        
        if (isScriptEnabled) {
          // 脚本应当保存在激活列表中
          if (scriptInDisabled) {
            // 如果脚本在禁用列表中，移动到激活列表
            delete disabledScripts[matchedScriptId];
          }
          scripts[matchedScriptId] = scriptData;
        } else {
          // 脚本应当保存在禁用列表中
          if (scriptInActive) {
            // 如果脚本在激活列表中，移动到禁用列表
            delete scripts[matchedScriptId];
          }
          disabledScripts[matchedScriptId] = scriptData;
        }
      }
      
      // 保存回存储
      await chrome.storage.local.set({ 
        scripts: scripts,
        _disabledScripts: disabledScripts 
      });
      
      // 保持在编辑模式，而不是切换到只读模式
      // 但重置当前脚本对象以保存更新后的代码
      currentScript = scriptData;
      
      // 显示保存成功状态
      showToast(i18n.t('save_success'), 'success');
      
    } catch (error) {
      console.error('保存脚本时出错:', error);
      showToast(i18n.t('save_failed') + ': ' + error.message, 'error');
    }
  }
  
  // 切换脚本启用状态
  async function toggleScriptEnabled(enabled) {
    isScriptEnabled = enabled;
    
    // 更新状态显示
    updateStatusDisplay(
      enabled, 
      enabled ? i18n.t('status_injected') : i18n.t('status_disabled')
    );
    
    if (!matchedScriptId || matchedScriptId.startsWith('temp_')) {
      // 如果是新脚本或未保存的脚本，只更新UI状态
      return;
    }
    
    try {
      // 获取当前所有脚本
      const data = await chrome.storage.local.get('scripts');
      const scripts = data.scripts || {};
      
      if (enabled) {
        // 启用脚本 - 如果存在于_disabledScripts中，则恢复
        const disabledData = await chrome.storage.local.get('_disabledScripts');
        const disabledScripts = disabledData._disabledScripts || {};
        
        if (disabledScripts[matchedScriptId]) {
          // 恢复被禁用的脚本
          scripts[matchedScriptId] = disabledScripts[matchedScriptId];
          // 从禁用列表中移除
          delete disabledScripts[matchedScriptId];
          // 保存更改
          await chrome.storage.local.set({ 
            'scripts': scripts,
            '_disabledScripts': disabledScripts
          });
        } else if (scripts[matchedScriptId]) {
          // 脚本已经在启用列表中，只需标记为启用
          scripts[matchedScriptId].enabled = true;
          await chrome.storage.local.set({ 'scripts': scripts });
        }
      } else {
        // 禁用脚本 - 移动到_disabledScripts中
        if (scripts[matchedScriptId]) {
          // 获取禁用脚本存储
          const disabledData = await chrome.storage.local.get('_disabledScripts');
          const disabledScripts = disabledData._disabledScripts || {};
          
          // 保存到禁用存储
          disabledScripts[matchedScriptId] = scripts[matchedScriptId];
          // 从active scripts中移除
          delete scripts[matchedScriptId];
          
          // 保存更改
          await chrome.storage.local.set({ 
            'scripts': scripts,
            '_disabledScripts': disabledScripts
          });
        }
      }
      
      // 立即刷新页面以应用更改
      refreshPage();
    } catch (error) {
      console.error('更新脚本状态时出错:', error);
      showToast(i18n.t('status_update_failed') + ': ' + error.message, 'error');
    }
  }
  
  // 获取当前标签
  chrome.tabs.query({active: true, currentWindow: true}, async function(tabs) {
    if (tabs.length === 0) {
      currentDomainEl.textContent = i18n.t('no_available_tabs');
      updateStatusDisplay(false, i18n.t('load_error'));
      disableSiteButtons(addScriptBtn, editScriptBtn);
      showEmptyState();
      return;
    }
    
    const currentTab = tabs[0];
    currentTabId = currentTab.id;
    currentTabUrl = currentTab.url;
    
    // 检查URL是否有效
    if (!currentTabUrl || !currentTabUrl.startsWith('http')) {
      currentDomainEl.textContent = i18n.t('not_a_web_page');
      updateStatusDisplay(false, i18n.t('use_script_injection_function'));
      disableSiteButtons(addScriptBtn, editScriptBtn);
      showEmptyState();
      return;
    }
    
    try {
      // 从URL中提取域名
      const url = new URL(currentTabUrl);
      currentDomain = url.hostname;
      currentDomainEl.textContent = currentDomain;
      
      // 先检查活动脚本
      const data = await chrome.storage.local.get(['scripts', '_disabledScripts']);
      const scripts = data.scripts || {};
      const disabledScripts = data._disabledScripts || {};
      
      // 查找匹配的活动脚本
      let exactMatch = false;
      let foundInDisabled = false;
      
      // 首先在活动脚本中查找
      Object.keys(scripts).forEach(id => {
        const script = scripts[id];
        const scriptDomain = script.domain;
        
        // 检查是否是通配符域名（例如 *.example.com）
        if (scriptDomain.startsWith('*.') && currentDomain.endsWith(scriptDomain.substring(1))) {
          if (!exactMatch) {
            matchedScriptId = id;
            isScriptEnabled = true;
          }
        } 
        // 精确匹配
        else if (scriptDomain === currentDomain) {
          matchedScriptId = id;
          isScriptEnabled = true;
          exactMatch = true;
        }
      });
      
      // 如果在活动脚本中未找到，则在禁用脚本中查找
      if (!matchedScriptId) {
        Object.keys(disabledScripts).forEach(id => {
          const script = disabledScripts[id];
          const scriptDomain = script.domain;
          
          // 检查是否是通配符域名（例如 *.example.com）
          if (scriptDomain.startsWith('*.') && currentDomain.endsWith(scriptDomain.substring(1))) {
            if (!exactMatch && !foundInDisabled) {
              matchedScriptId = id;
              isScriptEnabled = false;
              foundInDisabled = true;
            }
          } 
          // 精确匹配
          else if (scriptDomain === currentDomain) {
            matchedScriptId = id;
            isScriptEnabled = false;
            foundInDisabled = true;
            exactMatch = true;
          }
        });
      }
      
      // 更新UI
      if (matchedScriptId) {
        updateStatusDisplay(
          isScriptEnabled, 
          isScriptEnabled ? i18n.t('status_injected') : i18n.t('status_disabled')
        );
        editScriptBtn.disabled = false;
        addScriptBtn.disabled = false;
        setToggleSwitchState(true); // 启用开关
        
        // 显示脚本代码 - 无论是活动脚本还是禁用脚本
        const scriptToShow = isScriptEnabled ? 
                            scripts[matchedScriptId] : 
                            disabledScripts[matchedScriptId];
        
        showCode(scriptToShow);
      } else {
        updateStatusDisplay(false, i18n.t('status_not_injected'));
        editScriptBtn.disabled = true;
        addScriptBtn.disabled = false;
        setToggleSwitchState(false); // 禁用开关
        showEmptyState();
      }
      
    } catch (error) {
      console.error('处理当前标签页时出错:', error);
      currentDomainEl.textContent = i18n.t('error');
      updateStatusDisplay(false, i18n.t('load_error'));
      disableSiteButtons(addScriptBtn, editScriptBtn);
      showEmptyState();
    }
  });
  
  // 添加脚本按钮
  addScriptBtn.addEventListener('click', function() {
    chrome.tabs.create({url: `editor.html?domain=${encodeURIComponent(currentDomain)}`});
  });
  
  // 编辑脚本按钮
  editScriptBtn.addEventListener('click', function() {
    if (matchedScriptId) {
      chrome.tabs.create({url: `editor.html?id=${matchedScriptId}`});
    }
  });
  
  // 管理脚本按钮
  manageScriptsBtn.addEventListener('click', function() {
    chrome.tabs.create({url: 'manager.html'});
  });
  
  // 选项按钮
  optionsBtn.addEventListener('click', function() {
    chrome.tabs.create({url: 'options.html'});
  });
  
  // 开关控制
  toggleInjectionSwitch.addEventListener('change', function() {
    toggleScriptEnabled(this.checked);
  });
  
  // 创建新脚本
  function createNewScript() {
    // 获取当前时间戳
    const currentTime = Date.now();
    
    // 创建一个新的空脚本
    currentScript = {
      domain: currentDomain,
      name: i18n.t('script_name') + currentDomain,
      code: '// ' + i18n.t('write_your_javascript_code') + '\n\n\n\n\n\n\n\n\n',
      enabled: true,
      createdAt: currentTime,
      updatedAt: currentTime
    };
    
    // 创建一个临时ID
    matchedScriptId = 'temp_' + currentTime;
    
    // 显示编辑器并进入编辑模式
    emptyState.classList.add('hidden');
    codeEditorDiv.style.display = '';
    codeTitle.textContent = currentScript.name;
    scriptNameInput.value = currentScript.name;
    editor.setValue(currentScript.code);
    editor.refresh();
    setEditMode(true);
    
    // 显示保存按钮
    saveScriptBtn.classList.remove('hidden');
    
    // 更新状态
    isScriptEnabled = true;
    updateStatusDisplay(true, i18n.t('status_injected'));
  }
  
  // 切换编辑模式
  toggleEditBtn.addEventListener('click', function() {
    if (!currentScript) {
      createNewScript();
      return;
    }
    
    // 始终执行保存操作，不再切换模式
    saveScript();
  });
  
  // 创建脚本按钮
  if (createScriptBtn) {
    createScriptBtn.addEventListener('click', function() {
      createNewScript();
    });
  }
  
  // 刷新页面按钮
  refreshPageBtn.addEventListener('click', function() {
    refreshPage();
  });
  
  // 保存脚本按钮
  saveScriptBtn.addEventListener('click', function() {
    saveScript();
  });
  
  // 编辑名称按钮
  editNameBtn.addEventListener('click', function() {
    if (!currentScript) return;
    toggleEditName();
  });
  
  // 名称输入框回车保存
  scriptNameInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      toggleEditName();
    }
  });
  
  // 禁用特定于网站的按钮
  function disableSiteButtons(addButton, editButton) {
    addButton.disabled = true;
    editButton.disabled = true;
    setToggleSwitchState(false); // 禁用切换开关
  }
  
  // 暗黑模式切换按钮
  toggleThemeBtn.addEventListener('click', function() {
    toggleTheme();
  });
  
  // 等待i18n初始化完成的函数
  async function waitForI18nInit() {
    // 如果已经有language存储，直接返回
    const result = await chrome.storage.local.get('language');
    if (!result.language) {
      // 如果没有language存储，等待100ms确保i18n初始化完成
      return new Promise(resolve => setTimeout(resolve, 100));
    }
    return Promise.resolve();
  }
  
  // 初始化语言切换按钮
  function initLangToggle() {
    const langToggle = document.getElementById('lang-toggle');
    
    // 更新语言显示
    async function updateLangDisplay() {
      // 直接从存储中获取当前语言设置，确保获取的是最新的
      const result = await chrome.storage.local.get('language');
      const currentLang = result.language || 'en';
      
      const langText = currentLang === 'zh' ? '中文' : 'English';
      const langIcon = currentLang === 'zh' ? '🇨🇳' : '🇺🇸';
      langToggle.innerHTML = `<span style="display: flex; align-items: center; gap: 4px;">
        <span style="font-size: 14px;">${langIcon}</span><span>${langText}</span>
      </span>`;
    }
    
    // 初始更新语言显示
    updateLangDisplay();
    
    // 切换语言事件
    langToggle.addEventListener('click', async () => {
      // 获取当前语言
      const result = await chrome.storage.local.get('language');
      const currentLang = result.language || 'en';
      
      // 切换语言
      const newLang = currentLang === 'en' ? 'zh' : 'en';
      
      // 设置新语言
      i18n.setLanguage(newLang);
      
      // 更新显示
      updateLangDisplay();
      
      // 显示提示
      showToast(newLang === 'en' ? 'Switched to English' : '已切换到中文', 'info');
    });
  }
  
  // Toast通知系统
  function showToast(message, type = 'info', duration = 2000) {
    // 清除之前的toast
    const existingToasts = document.querySelectorAll('.toast');
    existingToasts.forEach(t => {
      if (t.classList.contains('show')) {
        t.classList.remove('show');
        setTimeout(() => {
          if (t.parentNode) t.parentNode.removeChild(t);
        }, 300);
      }
    });
    
    // 创建toast元素
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    // 添加到容器
    toastContainer.appendChild(toast);
    
    // 触发动画
    setTimeout(() => {
      toast.classList.add('show');
    }, 10);
    
    // 自动消失
    setTimeout(() => {
      toast.classList.remove('show');
      
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, duration);
    
    return toast;
  }
}); 