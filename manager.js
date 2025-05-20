// 导入i18n模块
import { i18n, translator } from './i18n/index.js';

document.addEventListener('DOMContentLoaded', async () => {
  // 初始化主题
  initTheme();
  
  // 添加主题切换按钮和语言切换按钮
  const header = document.querySelector('h1');
  
  // 语言切换按钮
  const langToggle = document.createElement('button');
  langToggle.id = 'lang-toggle';
  langToggle.innerHTML = `<span style="display: flex; align-items: center; gap: 4px;">
    <span style="font-size: 18px;">🌐</span><span data-i18n="language">语言</span>
  </span>`;
  langToggle.title = 'Switch Language / 切换语言';
  langToggle.className = 'lang-toggle';
  langToggle.addEventListener('click', toggleLanguage);
  header.appendChild(langToggle);
  
  // 主题切换按钮
  const themeToggle = document.createElement('button');
  themeToggle.id = 'toggle-theme';
  themeToggle.innerHTML = `<span style="display: flex; align-items: center; gap: 4px;">
    <span style="font-size: 18px;">🌓</span><span data-i18n="theme">主题</span>
  </span>`;
  themeToggle.title = i18n.t('toggle_dark_mode');
  themeToggle.className = 'lang-toggle';
  themeToggle.addEventListener('click', toggleTheme);
  header.appendChild(themeToggle);
  
  // 初始化页面翻译
  translator.translatePage();
  
  // 切换语言函数
  function toggleLanguage() {
    // 获取当前语言
    const currentLang = i18n.getLanguage();
    // 切换语言
    const newLang = currentLang === 'en' ? 'zh' : 'en';
    // 设置新语言
    i18n.setLanguage(newLang);
    // 显示提示
    showMessage(newLang === 'en' ? 'Switched to English' : '已切换到中文', 'info');
  }
  
  // 获取DOM元素
  const scriptsList = document.getElementById('scripts-list');
  const emptyState = document.getElementById('empty-state');
  const scriptsTable = document.getElementById('scripts-table');
  const addNewButton = document.getElementById('add-new');
  const searchInput = document.getElementById('search');
  
  // 获取所有脚本
  let scripts = {};
  let filteredScripts = {};
  
  // 加载脚本列表
  async function loadScripts() {
    try {
      const data = await chrome.storage.local.get('scripts');
      scripts = data.scripts || {};
      filteredScripts = {...scripts};
      renderScriptsList();
    } catch (error) {
      console.error('加载脚本时出错:', error);
      showError(i18n.t('load_scripts_failed'));
    }
  }
  
  // 渲染脚本列表
  function renderScriptsList() {
    scriptsList.innerHTML = '';
    
    const scriptIds = Object.keys(filteredScripts);
    
    if (scriptIds.length === 0) {
      scriptsTable.style.display = 'none';
      emptyState.style.display = 'block';
      return;
    }
    
    scriptsTable.style.display = 'table';
    emptyState.style.display = 'none';
    
    // 按更新时间排序（最新的在前）
    scriptIds.sort((a, b) => filteredScripts[b].updatedAt - filteredScripts[a].updatedAt);
    
    // 创建表格行
    scriptIds.forEach(id => {
      const script = filteredScripts[id];
      const tr = document.createElement('tr');
      
      // 创建表格单元格
      const nameTd = document.createElement('td');
      nameTd.textContent = script.name;
      
      const domainTd = document.createElement('td');
      domainTd.textContent = script.domain;
      
      const createdAtTd = document.createElement('td');
      createdAtTd.textContent = formatDate(script.createdAt);
      
      const updatedAtTd = document.createElement('td');
      updatedAtTd.textContent = formatDate(script.updatedAt);
      
      const actionsTd = document.createElement('td');
      actionsTd.className = 'actions';
      
      // 编辑按钮
      const editButton = document.createElement('button');
      editButton.className = 'small';
      editButton.textContent = i18n.t('edit');
      editButton.addEventListener('click', () => {
        window.location.href = `editor.html?id=${id}`;
      });
      
      // 删除按钮
      const deleteButton = document.createElement('button');
      deleteButton.className = 'small danger';
      deleteButton.textContent = i18n.t('delete');
      deleteButton.addEventListener('click', async () => {
        if (confirm(i18n.t('confirm_delete_script', { name: script.name }))) {
          try {
            delete scripts[id];
            await chrome.storage.local.set({ scripts });
            loadScripts();
          } catch (error) {
            console.error('删除脚本时出错:', error);
            alert(i18n.t('delete_script_failed'));
          }
        }
      });
      
      // 添加按钮到操作单元格
      actionsTd.appendChild(editButton);
      actionsTd.appendChild(deleteButton);
      
      // 添加所有单元格到行
      tr.appendChild(nameTd);
      tr.appendChild(domainTd);
      tr.appendChild(createdAtTd);
      tr.appendChild(updatedAtTd);
      tr.appendChild(actionsTd);
      
      // 添加行到表格
      scriptsList.appendChild(tr);
    });
  }
  
  // 显示错误信息
  function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    document.body.insertBefore(errorDiv, scriptsTable);
    
    // 3秒后自动隐藏错误信息
    setTimeout(() => {
      errorDiv.style.opacity = '0';
      setTimeout(() => errorDiv.remove(), 500);
    }, 3000);
  }
  
  // 显示消息
  function showMessage(message, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `error-message ${type === 'info' ? 'info-message' : ''}`;
    messageDiv.textContent = message;
    messageDiv.style.backgroundColor = type === 'info' ? '#4285f4' : '#ea4335';
    document.body.insertBefore(messageDiv, scriptsTable);
    
    // 3秒后自动隐藏错误信息
    setTimeout(() => {
      messageDiv.style.opacity = '0';
      setTimeout(() => messageDiv.remove(), 500);
    }, 3000);
  }
  
  // 格式化日期
  function formatDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString();
  }
  
  // 搜索脚本
  function searchScripts(query) {
    query = query.toLowerCase();
    
    if (!query) {
      filteredScripts = {...scripts};
    } else {
      filteredScripts = {};
      
      for (const id in scripts) {
        const script = scripts[id];
        if (
          script.name.toLowerCase().includes(query) ||
          script.domain.toLowerCase().includes(query)
        ) {
          filteredScripts[id] = script;
        }
      }
    }
    
    renderScriptsList();
  }
  
  // 添加新脚本按钮事件
  addNewButton.addEventListener('click', () => {
    window.location.href = 'editor.html';
  });
  
  // 搜索框事件
  searchInput.addEventListener('input', () => {
    searchScripts(searchInput.value);
  });
  
  // 初始化主题
  function initTheme() {
    // 从本地存储中获取主题设置
    chrome.storage.local.get('darkMode', (data) => {
      const isDarkMode = data.darkMode === true;
      applyTheme(isDarkMode);
    });
  }
  
  // 应用主题
  function applyTheme(isDark) {
    if (isDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }
  
  // 切换主题
  function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const isDarkMode = currentTheme === 'dark';
    
    // 应用主题
    applyTheme(!isDarkMode);
    
    // 保存主题设置
    chrome.storage.local.set({ darkMode: !isDarkMode });
    
    // 显示主题切换提示
    showMessage(isDarkMode ? i18n.t('switched_to_light_theme') : i18n.t('switched_to_dark_theme'), 'info');
  }
  
  // 加载脚本列表
  loadScripts();
}); 