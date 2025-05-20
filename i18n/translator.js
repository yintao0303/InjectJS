// 导入i18n实例
import i18n from './i18n.js';

// DOM翻译器
class DOMTranslator {
  constructor() {
    // 初始化监听器
    this.initEventListeners();
  }
  
  // 初始化事件监听器
  initEventListeners() {
    // 监听语言变更事件
    document.addEventListener('languageChanged', () => {
      this.translatePage();
    });
  }
  
  // 翻译整个页面
  translatePage() {
    // 翻译所有带有data-i18n属性的元素
    this.translateElements(document.querySelectorAll('[data-i18n]'));
    
    // 翻译所有带有data-i18n-title属性的元素的title属性
    this.translateAttributes(document.querySelectorAll('[data-i18n-title]'), 'title');
    
    // 翻译所有带有data-i18n-placeholder属性的元素的placeholder属性
    this.translateAttributes(document.querySelectorAll('[data-i18n-placeholder]'), 'placeholder');
  }
  
  // 翻译元素内容
  translateElements(elements) {
    elements.forEach(element => {
      const key = element.getAttribute('data-i18n');
      if (key) {
        element.textContent = i18n.translate(key);
      }
    });
  }
  
  // 翻译元素属性
  translateAttributes(elements, attributeName) {
    elements.forEach(element => {
      const key = element.getAttribute(`data-i18n-${attributeName}`);
      if (key) {
        element.setAttribute(attributeName, i18n.translate(key));
      }
    });
  }
  
  // 应用所有初始翻译
  applyTranslations() {
    document.addEventListener('DOMContentLoaded', () => {
      this.translatePage();
    });
  }
}

// 创建单例实例
const translator = new DOMTranslator();

// 导出实例
export default translator; 