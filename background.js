let db;

function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('ChatGPTSearchDB', 1);

        request.onerror = (event) => {
            console.error('IndexedDB error:', event.target.error);
            reject(event.target.error);
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            console.log('Database opened successfully');
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            db = event.target.result;
            const objectStore = db.createObjectStore('chats', { keyPath: 'chatId' });
            objectStore.createIndex('title', 'title', { unique: false });
            console.log('Object store created');
        };
    });
}

chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === "install") {
        console.log("Extension installed");
        openDatabase().then(() => {
            console.log("IndexedDB initialized");
        }).catch(error => {
            console.error('Failed to open database:', error);
        });

        // Open a new tab with instructions
        chrome.tabs.create({ url: chrome.runtime.getURL("instructions.html") });
    } else if (details.reason === "update") {
        console.log("Extension updated to version", chrome.runtime.getManifest().version);
    }
});