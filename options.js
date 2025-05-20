// 导入i18n模块
import { i18n, translator } from './i18n/index.js';

document.addEventListener('DOMContentLoaded', () => {
  // 获取DOM元素
  const exportDataButton = document.getElementById('export-data');
  const importDataButton = document.getElementById('import-data');
  const importFileInput = document.getElementById('import-file');
  const clearDataButton = document.getElementById('clear-data');
  const themeToggleSwitch = document.getElementById('theme-toggle');
  const themeStatus = document.getElementById('theme-status');
  const languageSelect = document.getElementById('language-select');
  
  // 初始化主题
  initTheme();
  
  // 初始化语言选择器
  initLanguageSelector();
  
  // 初始化页面翻译
  translator.translatePage();
  
  // 初始化语言选择器
  function initLanguageSelector() {
    // 获取当前语言设置
    chrome.storage.local.get('language', (data) => {
      const currentLanguage = data.language || 'en';
      
      // 设置选择器默认值
      languageSelect.value = currentLanguage;
      
      // 监听选择变化
      languageSelect.addEventListener('change', handleLanguageChange);
    });
  }
  
  // 处理语言变更
  function handleLanguageChange() {
    const selectedLanguage = languageSelect.value;
    
    // 保存语言设置
    chrome.storage.local.set({ language: selectedLanguage });
    
    // 根据选择设置语言
    if (selectedLanguage === 'auto') {
      i18n.setLanguageByBrowser();
    } else {
      i18n.setLanguage(selectedLanguage);
    }
    
    // 显示消息
    showMessage(i18n.t('language_changed'), 'success');
  }
  
  // 导出数据
  exportDataButton.addEventListener('click', async () => {
    try {
      // 获取所有脚本数据
      const data = await chrome.storage.local.get('scripts');
      const scripts = data.scripts || {};
      
      // 创建数据对象
      const exportData = {
        version: 1,
        scripts,
        exportDate: Date.now()
      };
      
      // 转换为JSON字符串
      const jsonString = JSON.stringify(exportData, null, 2);
      
      // 创建下载链接
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `js-injector-backup-${new Date().toISOString().slice(0, 10)}.json`;
      
      // 模拟点击下载
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // 释放URL对象
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 100);
      
      showMessage(i18n.t('data_export_success'), 'success');
    } catch (error) {
      console.error('导出数据时出错:', error);
      showMessage(i18n.t('data_export_failed'), 'error');
    }
  });
  
  // 导入数据按钮点击事件
  importDataButton.addEventListener('click', () => {
    importFileInput.click();
  });
  
  // 处理文件选择
  importFileInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    
    if (!file) {
      return;
    }
    
    try {
      // 读取文件内容
      const fileContent = await readFileAsText(file);
      const importData = JSON.parse(fileContent);
      
      // 验证数据格式
      if (!importData.scripts || typeof importData.scripts !== 'object') {
        throw new Error('无效的数据格式');
      }
      
      // 确认导入
      if (confirm(i18n.t('import_confirmation'))) {
        // 保存导入的脚本
        await chrome.storage.local.set({ scripts: importData.scripts });
        showMessage(i18n.t('data_import_success'), 'success');
      }
    } catch (error) {
      console.error('导入失败:', error);
      showMessage(`${i18n.t('data_import_failed')} ${error.message}`, 'error');
    }
    
    // 重置文件输入
    importFileInput.value = '';
  });
  
  // 清除所有数据
  clearDataButton.addEventListener('click', async () => {
    if (confirm(i18n.t('clear_data_confirmation'))) {
      try {
        await chrome.storage.local.set({ scripts: {} });
        showMessage(i18n.t('clear_data_success'), 'success');
      } catch (error) {
        console.error('清除数据时出错:', error);
        showMessage(i18n.t('clear_data_failed'), 'error');
      }
    }
  });
  
  // 显示消息
  function showMessage(message, type) {
    // 移除任何已存在的消息
    const existingMessages = document.querySelectorAll('.message');
    existingMessages.forEach(msg => msg.remove());
    
    // 创建消息元素
    const messageElement = document.createElement('div');
    messageElement.className = `message ${type}`;
    messageElement.textContent = message;
    
    // 添加到页面
    document.body.appendChild(messageElement);
    
    // 3秒后自动移除
    setTimeout(() => {
      messageElement.style.opacity = '0';
      setTimeout(() => messageElement.remove(), 500);
    }, 3000);
  }
  
  // 读取文件为文本
  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => resolve(event.target.result);
      reader.onerror = (error) => reject(error);
      reader.readAsText(file);
    });
  }
  
  // 初始化主题
  function initTheme() {
    // 从本地存储中获取主题设置
    chrome.storage.local.get('darkMode', (data) => {
      const isDarkMode = data.darkMode === true;
      applyTheme(isDarkMode);
      
      // 更新开关状态
      themeToggleSwitch.checked = isDarkMode;
      updateThemeStatusText(isDarkMode);
    });
    
    // 添加主题切换事件监听
    themeToggleSwitch.addEventListener('change', toggleTheme);
  }
  
  // 应用主题
  function applyTheme(isDark) {
    if (isDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }
  
  // 更新主题状态文本
  function updateThemeStatusText(isDarkMode) {
    themeStatus.textContent = isDarkMode ? i18n.t('on') : i18n.t('off');
    themeStatus.setAttribute('data-i18n', isDarkMode ? 'on' : 'off');
  }
  
  // 切换主题
  function toggleTheme() {
    const isDarkMode = themeToggleSwitch.checked;
    
    // 应用主题
    applyTheme(isDarkMode);
    
    // 更新状态文本
    updateThemeStatusText(isDarkMode);
    
    // 保存主题设置
    chrome.storage.local.set({ darkMode: isDarkMode });
  }
}); 