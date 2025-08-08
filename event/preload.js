const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  sendNotification: (data) => ipcRenderer.invoke('send-notification', data),

  getVersion: () => ipcRenderer.invoke('get-version'),
  minimize: () => ipcRenderer.invoke('minimize-window'),
  close: () => ipcRenderer.invoke('close-window'),

  onNotificationSettingsChanged: (callback) => 
    ipcRenderer.on('notification-settings-changed', callback),
  
  onAppUpdate: (callback) => 
    ipcRenderer.on('app-update', callback)
});