// 导入语言文件
import en from './en.js';
import zh from './zh.js';

class I18n {
  constructor() {
    // 可用的语言
    this.languages = {
      en: en,
      zh: zh
    };
    
    // 默认语言
    this.defaultLanguage = 'en';
    
    // 当前语言
    this.currentLanguage = this.defaultLanguage;
    
    // 初始化
    this.init();
  }
  
  // 初始化语言设置
  async init() {
    try {
      // 从存储中获取语言设置
      const result = await chrome.storage.local.get('language');
      
      if (result.language) {
        // 如果有存储的语言设置，则使用它
        this.setLanguage(result.language);
      } else {
        // 没有设置过语言，设置并保存默认语言(英文)
        this.setLanguage(this.defaultLanguage);
        chrome.storage.local.set({ language: this.defaultLanguage });
      }
    } catch (error) {
      console.error('初始化语言设置失败:', error);
      // 使用默认语言
      this.setLanguage(this.defaultLanguage);
      // 尝试保存设置
      try {
        chrome.storage.local.set({ language: this.defaultLanguage });
      } catch (e) {
        console.error('保存默认语言设置失败:', e);
      }
    }
  }
  
  // 根据浏览器设置选择语言
  setLanguageByBrowser() {
    const browserLang = navigator.language.toLowerCase().split('-')[0];
    
    // 检查是否支持该语言
    if (this.languages[browserLang]) {
      this.setLanguage(browserLang);
    } else {
      // 不支持则使用默认语言
      this.setLanguage(this.defaultLanguage);
    }
  }
  
  // 设置当前语言
  setLanguage(lang) {
    if (this.languages[lang]) {
      this.currentLanguage = lang;
      // 保存语言设置到存储
      chrome.storage.local.set({ language: lang });
      // 通知语言变更
      this.notifyLanguageChange();
      return true;
    }
    return false;
  }
  
  // 获取当前语言
  getLanguage() {
    return this.currentLanguage;
  }
  
  // 获取翻译文本
  translate(key) {
    const langData = this.languages[this.currentLanguage];
    
    if (langData && langData[key]) {
      return langData[key];
    }
    
    // 如果当前语言没有该翻译，尝试从默认语言获取
    if (this.currentLanguage !== this.defaultLanguage) {
      const defaultLangData = this.languages[this.defaultLanguage];
      if (defaultLangData && defaultLangData[key]) {
        return defaultLangData[key];
      }
    }
    
    // 如果没有找到翻译，返回键名
    return key;
  }
  
  // t方法作为translate的别名
  t(key) {
    return this.translate(key);
  }
  
  // 通知语言变更
  notifyLanguageChange() {
    // 创建自定义事件
    const event = new CustomEvent('languageChanged', {
      detail: { language: this.currentLanguage }
    });
    
    // 触发事件
    document.dispatchEvent(event);
  }
  
  // 获取所有可用语言
  getAvailableLanguages() {
    return Object.keys(this.languages);
  }
}

// 创建单例实例
const i18n = new I18n();

// 导出实例
export default i18n; 