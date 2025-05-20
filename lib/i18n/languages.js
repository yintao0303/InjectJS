// 语言包
const languages = {
  'zh': {
    // 通用
    'save': '保存',
    'return': '返回',
    'cancel': '取消',
    'delete': '删除',
    'confirm': '确认',
    'yes': '是',
    'no': '否',
    
    // 编辑器页面
    'add_script': '添加脚本',
    'edit_script': '编辑脚本',
    'website_domain': '网站域名',
    'domain_placeholder': '例如: example.com 或 *.example.com',
    'domain_hint': '使用 * 作为通配符匹配所有子域名',
    'script_name': '脚本名称',
    'name_placeholder': '输入一个描述性名称',
    'js_code': 'JavaScript 代码',
    'code_placeholder': '// 在此输入要注入的JavaScript代码',
    'format_code': '格式化代码',
    'autocomplete_on': '自动补全: 开',
    'autocomplete_off': '自动补全: 关',
    'toggle_theme': '切换主题',
    'note_title': '注意:',
    'note_content': '注入的JavaScript代码将在目标网站的上下文中运行。请谨慎编写代码，避免破坏网站功能。',
    
    // 提示消息
    'please_enter_domain': '请输入网站域名',
    'please_enter_name': '请输入脚本名称',
    'please_enter_code': '请输入JavaScript代码',
    'script_saved': '脚本保存成功！',
    'script_deleted': '脚本已删除！',
    'format_success': '代码格式化成功',
    'format_error': '格式化错误: ',
    'format_fail': '无法格式化代码: ',
    'simple_format': '使用简单格式化完成',
    'autocomplete_enabled': '已启用自动补全',
    'autocomplete_disabled': '已禁用自动补全',
    'theme_changed': '已切换到{theme}主题',
    'theme_dark': '深色',
    'theme_light': '浅色',
    'confirm_overwrite': '已存在针对域名 {domain} 的脚本。是否覆盖？',
    'confirm_delete': '确定要删除此脚本吗？此操作无法撤销。',
    'confirm_leave': '您有未保存的更改。确定要离开吗？',
    'data_restored': '已恢复原始数据',
    'form_cleared': '已清空表单',
    
    // 设置
    'language': '语言',
    'language_zh': '中文',
    'language_en': '英文',
    'settings': '设置',
    'settings_saved': '设置已保存'
  },
  'en': {
    // Common
    'save': 'Save',
    'return': 'Return',
    'cancel': 'Cancel',
    'delete': 'Delete',
    'confirm': 'Confirm',
    'yes': 'Yes',
    'no': 'No',
    
    // Editor page
    'add_script': 'Add Script',
    'edit_script': 'Edit Script',
    'website_domain': 'Website Domain',
    'domain_placeholder': 'Example: example.com or *.example.com',
    'domain_hint': 'Use * as wildcard to match all subdomains',
    'script_name': 'Script Name',
    'name_placeholder': 'Enter a descriptive name',
    'js_code': 'JavaScript Code',
    'code_placeholder': '// Enter JavaScript code to inject here',
    'format_code': 'Format Code',
    'autocomplete_on': 'Autocomplete: On',
    'autocomplete_off': 'Autocomplete: Off',
    'toggle_theme': 'Toggle Theme',
    'note_title': 'Note:',
    'note_content': 'Injected JavaScript code will run in the context of the target website. Please be careful with your code to avoid breaking website functionality.',
    
    // Messages
    'please_enter_domain': 'Please enter a website domain',
    'please_enter_name': 'Please enter a script name',
    'please_enter_code': 'Please enter JavaScript code',
    'script_saved': 'Script saved successfully!',
    'script_deleted': 'Script deleted!',
    'format_success': 'Code formatting successful',
    'format_error': 'Formatting error: ',
    'format_fail': 'Failed to format code: ',
    'simple_format': 'Simple formatting completed',
    'autocomplete_enabled': 'Autocomplete enabled',
    'autocomplete_disabled': 'Autocomplete disabled',
    'theme_changed': 'Switched to {theme} theme',
    'theme_dark': 'dark',
    'theme_light': 'light',
    'confirm_overwrite': 'A script for domain {domain} already exists. Overwrite it?',
    'confirm_delete': 'Are you sure you want to delete this script? This action cannot be undone.',
    'confirm_leave': 'You have unsaved changes. Are you sure you want to leave?',
    'data_restored': 'Original data restored',
    'form_cleared': 'Form cleared',
    
    // Settings
    'language': 'Language',
    'language_zh': 'Chinese',
    'language_en': 'English',
    'settings': 'Settings',
    'settings_saved': 'Settings saved'
  }
};

// 语言工具函数
const i18n = {
  // 当前语言
  currentLang: 'zh',
  
  // 初始化语言
  init: async function() {
    try {
      // 从存储中获取语言设置
      const data = await chrome.storage.local.get('settings');
      const settings = data.settings || {};
      this.currentLang = settings.language || 'zh';
    } catch (error) {
      console.error('Failed to initialize language:', error);
      this.currentLang = 'zh';
    }
    return this.currentLang;
  },
  
  // 设置语言
  setLanguage: async function(lang) {
    if (languages[lang]) {
      this.currentLang = lang;
      
      // 保存语言设置
      try {
        const data = await chrome.storage.local.get('settings');
        const settings = data.settings || {};
        settings.language = lang;
        await chrome.storage.local.set({ settings });
      } catch (error) {
        console.error('Failed to save language setting:', error);
      }
      
      return true;
    }
    return false;
  },
  
  // 获取当前语言的翻译
  get: function(key, params) {
    const translations = languages[this.currentLang] || languages['zh'];
    let text = translations[key] || key;
    
    // 如果有参数，替换文本中的占位符
    if (params) {
      for (const paramKey in params) {
        text = text.replace(`{${paramKey}}`, params[paramKey]);
      }
    }
    
    return text;
  },
  
  // 获取可用的语言列表
  getLanguages: function() {
    return Object.keys(languages).map(code => ({
      code,
      name: languages[code][`language_${code}`] || code
    }));
  }
};

// 导出
window.i18n = i18n; 