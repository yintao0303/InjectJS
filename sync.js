/**
 * 数据同步模块
 * 负责在不同设备间同步脚本数据
 */

// 全局变量，控制是否进行自动同步
let autoSyncEnabled = true;
let syncIntervalId = null;
let lastSyncTime = 0;
const DEFAULT_SYNC_INTERVAL = 10 * 60 * 1000; // 默认10分钟同步一次

// 初始化同步模块
async function initSync() {
  console.log('初始化同步模块...');
  
  // 获取同步设置
  const settings = await getSyncSettings();
  autoSyncEnabled = settings.autoSync;
  
  // 如果启用了自动同步，设置定时器
  if (autoSyncEnabled) {
    startAutoSync(settings.syncInterval);
  }
  
  // 设置消息监听器，处理来自选项页的设置变更
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'updateSyncSettings') {
      handleSyncSettingsUpdate(message.settings);
      sendResponse({success: true});
    } else if (message.action === 'syncNow') {
      syncData()
        .then(result => sendResponse({success: true, result}))
        .catch(error => sendResponse({success: false, error: error.message}));
      return true; // 表示异步响应
    } else if (message.action === 'getSyncStatus') {
      getSyncStatus()
        .then(status => sendResponse({success: true, status}))
        .catch(error => sendResponse({success: false, error: error.message}));
      return true; // 表示异步响应
    }
  });
  
  // 首次运行时执行一次同步
  if (autoSyncEnabled) {
    setTimeout(() => syncData(), 5000);
  }
}

// 处理同步设置更新
function handleSyncSettingsUpdate(settings) {
  console.log('同步设置已更新:', settings);
  autoSyncEnabled = settings.autoSync;
  
  // 停止现有的同步定时器
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
  }
  
  // 如果开启了自动同步，重新启动定时器
  if (autoSyncEnabled) {
    startAutoSync(settings.syncInterval);
  }
}

// 开始自动同步
function startAutoSync(interval = DEFAULT_SYNC_INTERVAL) {
  // 确保间隔合理
  const syncInterval = Math.max(interval, 60000); // 最小1分钟
  
  console.log(`设置自动同步，间隔: ${syncInterval}毫秒`);
  
  syncIntervalId = setInterval(() => {
    syncData().catch(error => {
      console.error('自动同步出错:', error);
    });
  }, syncInterval);
}

// 获取同步设置
async function getSyncSettings() {
  const data = await chrome.storage.local.get(['syncSettings']);
  const defaultSettings = {
    autoSync: true,
    syncInterval: DEFAULT_SYNC_INTERVAL,
    syncProvider: 'chrome', // 默认使用chrome sync
    lastSyncTime: 0
  };
  
  return data.syncSettings || defaultSettings;
}

// 保存同步设置
async function saveSyncSettings(settings) {
  return chrome.storage.local.set({
    syncSettings: {
      ...await getSyncSettings(),
      ...settings
    }
  });
}

// 获取同步状态
async function getSyncStatus() {
  const settings = await getSyncSettings();
  const now = Date.now();
  
  return {
    autoSyncEnabled: autoSyncEnabled,
    lastSyncTime: settings.lastSyncTime,
    nextSyncTime: autoSyncEnabled ? (settings.lastSyncTime + settings.syncInterval) : null,
    timeUntilNextSync: autoSyncEnabled ? Math.max(0, (settings.lastSyncTime + settings.syncInterval) - now) : null,
    syncProvider: settings.syncProvider
  };
}

// 同步数据
async function syncData() {
  console.log('开始数据同步...');
  
  try {
    const settings = await getSyncSettings();
    const provider = settings.syncProvider;
    
    let result;
    if (provider === 'chrome') {
      result = await syncWithChromeSync();
    } else {
      throw new Error(`不支持的同步提供商: ${provider}`);
    }
    
    // 更新上次同步时间
    await saveSyncSettings({
      lastSyncTime: Date.now()
    });
    
    console.log('数据同步完成:', result);
    return result;
  } catch (error) {
    console.error('数据同步失败:', error);
    throw error;
  }
}

// 使用Chrome同步存储进行同步
async function syncWithChromeSync() {
  // 1. 从本地获取数据
  const localData = await chrome.storage.local.get(['scripts', 'disabled_scripts']);
  
  // 2. 从云端获取数据
  const cloudData = await chrome.storage.sync.get(['scripts', 'disabled_scripts', 'lastSyncTimestamp']);
  
  // 3. 比较云端和本地的时间戳，确定同步方向
  const localTimestamp = (await chrome.storage.local.get(['lastSyncTimestamp'])).lastSyncTimestamp || 0;
  const cloudTimestamp = cloudData.lastSyncTimestamp || 0;
  
  const mergeResult = {
    direction: null,
    changes: {
      scripts: 0,
      disabled_scripts: 0
    }
  };
  
  // 初始化合并后的数据
  let mergedScripts = {};
  let mergedDisabledScripts = [];
  
  // 4. 执行数据合并
  if (cloudTimestamp > localTimestamp) {
    console.log('云端数据更新，从云端同步到本地');
    mergeResult.direction = 'cloud_to_local';
    
    // 云端脚本合并到本地
    mergedScripts = {...(localData.scripts || {}), ...(cloudData.scripts || {})};
    
    // 合并禁用脚本列表
    const localDisabled = new Set(localData.disabled_scripts || []);
    const cloudDisabled = new Set(cloudData.disabled_scripts || []);
    mergedDisabledScripts = [...new Set([...localDisabled, ...cloudDisabled])];
    
    // 计算变更数量
    mergeResult.changes.scripts = Object.keys(cloudData.scripts || {}).length;
    mergeResult.changes.disabled_scripts = cloudData.disabled_scripts ? cloudData.disabled_scripts.length : 0;
    
    // 保存到本地
    await chrome.storage.local.set({
      scripts: mergedScripts,
      disabled_scripts: mergedDisabledScripts,
      lastSyncTimestamp: Date.now()
    });
  } else {
    console.log('本地数据更新或首次同步，从本地同步到云端');
    mergeResult.direction = 'local_to_cloud';
    
    // 本地脚本合并到云端
    mergedScripts = localData.scripts || {};
    mergedDisabledScripts = localData.disabled_scripts || [];
    
    // 计算变更数量
    mergeResult.changes.scripts = Object.keys(mergedScripts).length;
    mergeResult.changes.disabled_scripts = mergedDisabledScripts.length;
    
    // 保存到云端 - 注意：Cloud Sync有存储大小限制
    try {
      // 计算数据大小
      const dataStr = JSON.stringify({
        scripts: mergedScripts,
        disabled_scripts: mergedDisabledScripts
      });
      
      if (dataStr.length > 100000) { // 近似100KB，Chrome sync限制102KB
        // 如果数据太大，我们需要分块存储或提示用户
        console.warn('数据过大，超出Chrome存储同步限制，只同步禁用脚本列表');
        // 至少同步禁用脚本列表，这通常很小
        await chrome.storage.sync.set({
          disabled_scripts: mergedDisabledScripts,
          lastSyncTimestamp: Date.now()
        });
        mergeResult.dataTooLarge = true;
      } else {
        // 数据大小在限制范围内，完整同步
        await chrome.storage.sync.set({
          scripts: mergedScripts,
          disabled_scripts: mergedDisabledScripts,
          lastSyncTimestamp: Date.now()
        });
      }
    } catch (error) {
      console.error('保存到Chrome同步存储失败:', error);
      // 如果是QUOTA_BYTES超限错误，尝试只同步禁用脚本列表
      if (error.message.includes('QUOTA_BYTES')) {
        await chrome.storage.sync.set({
          disabled_scripts: mergedDisabledScripts,
          lastSyncTimestamp: Date.now()
        });
        mergeResult.dataTooLarge = true;
      } else {
        throw error;
      }
    }
  }
  
  return mergeResult;
}

// 导出模块
window.JsInjectorSync = {
  init: initSync,
  syncNow: syncData,
  getStatus: getSyncStatus,
  getSettings: getSyncSettings,
  saveSettings: saveSyncSettings
}; 