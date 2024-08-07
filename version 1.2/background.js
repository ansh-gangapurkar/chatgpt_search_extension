let db;

function initializeDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('ChatGPTSearchDB', 1);

        request.onerror = (event) => {
            console.error('Database error:', event.target.error);
            reject(event.target.error);
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            console.log('Database initialized successfully');
            resolve();
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            const objectStore = db.createObjectStore('chats', { keyPath: 'chatId' });
            objectStore.createIndex('title', 'title', { unique: false });
            console.log('Object store created');
        };
    });
}

function ensureDatabaseInitialized() {
    return new Promise((resolve, reject) => {
        if (db) {
            resolve();
        } else {
            initializeDatabase().then(resolve).catch(reject);
        }
    });
}

chrome.runtime.onInstalled.addListener((details) => {
    ensureDatabaseInitialized().catch(error => {
        console.error('Failed to initialize database on install:', error);
    });

    if (details.reason === "install") {
        console.log("Extension installed");
        chrome.tabs.create({ url: chrome.runtime.getURL("instructions.html") });
    } else if (details.reason === "update") {
        console.log("Extension updated to version", chrome.runtime.getManifest().version);
    }
});

chrome.runtime.onStartup.addListener(() => {
    ensureDatabaseInitialized().catch(error => {
        console.error('Failed to initialize database on startup:', error);
    });
});

function deleteChatData(chatId) {
    return new Promise((resolve, reject) => {
        ensureDatabaseInitialized().then(() => {
            const transaction = db.transaction(['chats'], 'readwrite');
            const objectStore = transaction.objectStore('chats');
            const request = objectStore.delete(chatId);

            request.onsuccess = () => {
                console.log(`Chat data deleted: ${chatId}`);
                resolve();
            };

            request.onerror = (event) => {
                console.error('Error deleting chat data:', event.target.error);
                reject(event.target.error);
            };
        }).catch(reject);
    });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "isDatabaseReady") {
        sendResponse({ ready: db !== undefined });
    } else if (request.action === "saveChatData") {
        saveChatData(request.data)
            .then(() => sendResponse({ success: true }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    } else if (request.action === "getChatData") {
        getChatData()
            .then(data => sendResponse({ success: true, data: data }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    } else if (request.action === "deleteChatData") {
        deleteChatData(request.chatId)
            .then(() => sendResponse({ success: true }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }
});

function saveChatData(chatData) {
    return new Promise((resolve, reject) => {
        ensureDatabaseInitialized().then(() => {
            const transaction = db.transaction(['chats'], 'readwrite');
            const objectStore = transaction.objectStore('chats');

            const promises = chatData.map(chat => {
                return new Promise((resolve, reject) => {
                    const request = objectStore.put(chat);
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                });
            });

            Promise.all(promises)
                .then(() => {
                    console.log('Chat data saved successfully');
                    resolve();
                })
                .catch((error) => {
                    console.error('Error saving chat data:', error);
                    reject(error);
                });
        }).catch(reject);
    });
}

function getChatData() {
    return new Promise((resolve, reject) => {
        ensureDatabaseInitialized().then(() => {
            const transaction = db.transaction(['chats'], 'readonly');
            const objectStore = transaction.objectStore('chats');
            const request = objectStore.getAll();

            request.onsuccess = (event) => {
                console.log('Retrieved chat data:', event.target.result);
                resolve(event.target.result);
            };

            request.onerror = (event) => {
                console.error('Error getting chat data:', event.target.error);
                reject(event.target.error);
            };
        }).catch(reject);
    });
}
