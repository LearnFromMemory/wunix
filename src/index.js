const { app, BrowserWindow, nativeImage, Notification, ipcMain } = require('electron');
const path = require('path');

let mainWindow;
let loaderWindow;

function createWindows() {
  
  loaderWindow = new BrowserWindow({
    width: 480,
    height: 450,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    center: true,
    resizable: false,
    show: false, 
    roundedCorners: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  loaderWindow.loadFile(path.join(__dirname, '..', 'loader', 'loader.html'));
  
  
  loaderWindow.once('ready-to-show', () => {
    loaderWindow.setOpacity(0);
    loaderWindow.show();
    
    
    let opacity = 0;
    const fadeIn = setInterval(() => {
      opacity += 0.05;
      if (opacity >= 1) {
        opacity = 1;
        clearInterval(fadeIn);
      }
      loaderWindow.setOpacity(opacity);
    }, 16);
  });

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'icon.png')),
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
      preload: path.join(__dirname, '..', 'event' ,'preload.js')
    }
  });

  mainWindow.webContents.setUserAgent(
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
  );

  mainWindow.loadURL('https://web.whatsapp.com');

  
  mainWindow.webContents.once('did-finish-load', () => {
    
    setTimeout(() => {
      if (loaderWindow && !loaderWindow.isDestroyed()) {
        
        loaderWindow.webContents.executeJavaScript(`
          document.body.classList.add('slide-out');
        `);
        
        
        setTimeout(() => {
          let opacity = 1;
          const fadeOut = setInterval(() => {
            opacity -= 0.1;
            if (opacity <= 0) {
              opacity = 0;
              clearInterval(fadeOut);
              loaderWindow.close();
              mainWindow.show();
              mainWindow.focus();
              
              
              initializeNotifications();
            }
            loaderWindow.setOpacity(opacity);
          }, 16);
        }, 500); 
      } else {
        mainWindow.show();
        mainWindow.focus();
        initializeNotifications();
      }
    }, 4500); 
  });

  
  loaderWindow.on('closed', () => {
    loaderWindow = null;
  });

  mainWindow.setMenu(null);
}

function initializeNotifications() {
  
  mainWindow.webContents.executeJavaScript(`
    ${getNotificationScript()}
  `);

  
  if (Notification.isSupported()) {
    console.log('[LOGS] eventFunction: NOTIFICATION supported');
  }
}

function getNotificationScript() {
  return `
    (function() {
      console.log('wunix notification monitoring started');
      
      let lastMessageCount = 0;
      let lastTitle = document.title;
      let observedChats = new Set();
      
      
      function sendNotification(data) {
        window.electronAPI?.sendNotification(data);
      }
      
      
      function monitorTitleChanges() {
        const observer = new MutationObserver(() => {
          const newTitle = document.title;
          if (newTitle !== lastTitle) {
            lastTitle = newTitle;
            
            
            const unreadMatch = newTitle.match(/\\((\\d+)\\)/);
            const currentCount = unreadMatch ? parseInt(unreadMatch[1]) : 0;
            lastMessageCount = currentCount;
          }
        });
        
        observer.observe(document.querySelector('title'), {
          childList: true,
          subtree: true
        });
      }
      
      
      function monitorMessages() {
        const chatContainer = document.querySelector('[data-testid="chat-list"]') || 
                            document.querySelector('[data-tab="1"]') ||
                            document.querySelector('#pane-side');
        
        if (!chatContainer) {
          setTimeout(monitorMessages, 1000);
          return;
        }
        
        const observer = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === 1) { 
                
                const chatItems = node.querySelectorAll ? 
                  node.querySelectorAll('[data-testid="list-item-chat"], [role="listitem"]') : [];
                
                chatItems.forEach((chatItem) => {
                  const unreadBadge = chatItem.querySelector('[data-testid="icon-unread-count"], .VOr2j, ._1pJ9J');
                  if (unreadBadge && !observedChats.has(chatItem)) {
                    observedChats.add(chatItem);
                    
                    
                    const nameElement = chatItem.querySelector('[data-testid="conversation-info-header"] span, ._21S-L span, .zoWT4 span') ||
                                      chatItem.querySelector('span[title]');
                    const contactName = nameElement ? nameElement.textContent || nameElement.title : 'Unknown Contact';
                    
                    
                    const messageElement = chatItem.querySelector('[data-testid="last-msg"], ._1VzZY, .P6z4j');
                    const lastMessage = messageElement ? messageElement.textContent.substring(0, 50) : 'New message';
                    
                    
                    const isGroup = chatItem.querySelector('[data-testid="group"], .haAclf, ._1WmWl') !== null;
                    const isChannel = contactName.includes('Channel') || chatItem.querySelector('[data-testid="channel"]');
                    
                    let notificationType = 'message';
                    if (isChannel) notificationType = 'channel';
                    else if (isGroup) notificationType = 'group';
                    
                    sendNotification({
                      type: notificationType,
                      title: contactName,
                      body: lastMessage,
                      contact: contactName,
                      isGroup: isGroup,
                      isChannel: isChannel
                    });
                  }
                });
                
                
                const callElements = node.querySelectorAll ? 
                  node.querySelectorAll('[data-testid="incoming-call"], [data-testid="call"], .call-notification') : [];
                
                callElements.forEach((callElement) => {
                  const callerName = callElement.querySelector('span[title], ._1wjpf span, .call-name')?.textContent || 'Unknown Caller';
                  
                  sendNotification({
                    type: 'call',
                    title: 'Incoming Call',
                    body: \`\${callerName} is calling...\`,
                    contact: callerName,
                    urgent: true
                  });
                });
              }
            });
          });
        });
        
        observer.observe(chatContainer, {
          childList: true,
          subtree: true
        });
      }
      
      
      function monitorCalls() {
        const callObserver = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === 1 && node.classList) {
                
                if (node.classList.contains('call-screen') || 
                    node.querySelector('[data-testid="incoming-call"]')) {
                  
                  const callerElement = node.querySelector('.call-name span, [data-testid="caller-name"]') ||
                                      node.querySelector('span[title]');
                  const callerName = callerElement ? callerElement.textContent : 'Unknown Caller';
                  
                  sendNotification({
                    type: 'incoming_call',
                    title: 'Incoming WhatsApp Call',
                    body: \`\${callerName} is calling you\`,
                    contact: callerName,
                    urgent: true
                  });
                }
              }
            });
          });
        });
        
        callObserver.observe(document.body, {
          childList: true,
          subtree: true
        });
      }
      
      
      function startMonitoring() {
        if (document.querySelector('[data-testid="chat-list"]') || 
            document.querySelector('#pane-side') ||
            document.readyState === 'complete') {
          
          monitorTitleChanges();
          monitorMessages();
          monitorCalls();
          console.log('wunix monitoring active');
        } else {
          setTimeout(startMonitoring, 500);
        }
      }
      
      
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startMonitoring);
      } else {
        startMonitoring();
      }
      
    })();
  `;
}

ipcMain.handle('send-notification', (event, data) => {
  if (!Notification.isSupported()) return;
  
  const iconPath = path.join(__dirname, '..', 'assets', 'icon.png');
  
  const notification = new Notification({
    title: data.title || 'wunix',
    body: data.body || 'New notification',
    icon: iconPath,
    sound: true,
    urgency: data.urgent ? 'critical' : 'normal'
  });
  
  notification.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      mainWindow.show();
    }
  });
  
  notification.show();
  
  if (data.count) {
    app.setBadgeCount(data.count);
  }
});

app.whenReady().then(createWindows);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindows();
});