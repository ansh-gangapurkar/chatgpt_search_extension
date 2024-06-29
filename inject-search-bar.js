(function() {
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

    function deleteDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.deleteDatabase('ChatGPTSearchDB');

            request.onerror = (event) => {
                console.error('Error deleting database:', event.target.error);
                reject(event.target.error);
            };

            request.onsuccess = (event) => {
                console.log('Database deleted successfully');
                resolve();
            };
        });
    }

    function refreshDatabase() {
        return deleteDatabase()
            .then(() => openDatabase())
            .then(() => scrapeChatTitles())
            .then(() => {
                console.log('Database refreshed and chats rescraped');
            })
            .catch((error) => {
                console.error('Error refreshing database:', error);
            });
    }

    function saveChatData(chatData) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['chats'], 'readwrite');
            const objectStore = transaction.objectStore('chats');

            chatData.forEach(chat => {
                objectStore.put(chat);
            });

            transaction.oncomplete = () => {
                console.log('Chat data saved successfully');
                resolve();
            };

            transaction.onerror = (event) => {
                console.error('Error saving chat data:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    function getChatData() {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['chats'], 'readonly');
            const objectStore = transaction.objectStore('chats');
            const request = objectStore.getAll();

            request.onsuccess = (event) => {
                resolve(event.target.result);
            };

            request.onerror = (event) => {
                console.error('Error getting chat data:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    function injectSearchBar() {
        const targetElement = document.querySelector('div.flex.flex-col.gap-2.pb-2.text-token-text-primary.text-sm.juice\\:mt-5');
        if (!targetElement) {
            console.log('Target element for injection not found');
            return;
        }

        const searchBarContainer = document.createElement('div');
        searchBarContainer.className = 'chatgpt-search-container';
        searchBarContainer.innerHTML = `
            <input type="text" id="chatgpt-search-input" placeholder="Search your chats...">
            <div id="chatgpt-search-results" style="display: none;"></div>
        `;

        targetElement.parentNode.insertBefore(searchBarContainer, targetElement);

        const searchInput = document.getElementById('chatgpt-search-input');
        searchInput.addEventListener('input', debounce(performSearch, 300));

        console.log('Search bar injected successfully');
    }

    function scrapeChatTitles() {
        const chatItems = document.querySelectorAll('nav li');
        const newChatData = Array.from(chatItems).map(item => {
            const titleElement = item.querySelector('div[class*="overflow-hidden"]');
            const linkElement = item.querySelector('a');
            
            if (titleElement && linkElement) {
                const title = titleElement.textContent.trim();
                const chatId = linkElement.getAttribute('href').split('/').pop();
                const fullLink = `https://chatgpt.com${linkElement.getAttribute('href')}`;
                return { title, chatId, link: fullLink };
            }
            return null;
        }).filter(Boolean);

        updateChatData(newChatData);
    }

    async function updateChatData(newChatData) {
        try {
            const existingChatData = await getChatData();

  
            newChatData.forEach(newChat => {
                if (!existingChatData.some(existingChat => existingChat.chatId === newChat.chatId)) {
                    existingChatData.push(newChat);
                }
            });

            const updatedChatData = existingChatData.filter(existingChat => 
                newChatData.some(newChat => newChat.chatId === existingChat.chatId)
            );

            updatedChatData.forEach(existingChat => {
                const updatedChat = newChatData.find(newChat => newChat.chatId === existingChat.chatId);
                if (updatedChat && updatedChat.title !== existingChat.title) {
                    existingChat.title = updatedChat.title;
                }
            });

            await saveChatData(updatedChatData);
            console.log('Chat data updated and saved to IndexedDB');
        } catch (error) {
            console.error('Error updating chat data:', error);
        }
    }

    function performSearch() {
        const query = document.getElementById('chatgpt-search-input').value.trim().toLowerCase();
        const resultsContainer = document.getElementById('chatgpt-search-results');

        if (query === '') {
            resultsContainer.innerHTML = '';
            resultsContainer.style.display = 'none';
            return;
        }

        getChatData()
            .then(chatData => {
                const results = chatData.filter(chat => chat.title.toLowerCase().includes(query));
                displayResults(results);
            })
            .catch(error => {
                console.error('Error performing search:', error);
                resultsContainer.innerHTML = '<div class="chatgpt-search-message">Error: Unable to perform search.</div>';
                resultsContainer.style.display = 'block';
            });
    }

    function displayResults(results) {
        const resultsContainer = document.getElementById('chatgpt-search-results');
        resultsContainer.innerHTML = '';

        if (results.length === 0) {
            resultsContainer.innerHTML = '<div class="chatgpt-search-message">No results found.</div>';
        } else {
            results.forEach(result => {
                const resultElement = document.createElement('div');
                resultElement.className = 'chatgpt-search-result-item';
                resultElement.innerHTML = `
                    <p class="chatgpt-search-result-title">${result.title}</p>
                    <a href="${result.link}" class="chatgpt-search-result-link">Open Chat</a>
                `;
                resultsContainer.appendChild(resultElement);
            });
        }

        resultsContainer.style.display = 'block';
    }

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    

    openDatabase().then(() => {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                injectSearchBar();
                scrapeChatTitles();
            });
        } else {
            injectSearchBar();
            scrapeChatTitles();
        }

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    if (!document.querySelector('.chatgpt-search-container')) {
                        injectSearchBar();
                    }
                    scrapeChatTitles();
                }
            });
        });

        observer.observe(document.body, { childList: true, subtree: true });

        window.addEventListener('scroll', debounce(scrapeChatTitles, 500));

        console.log('Inject search bar script loaded with IndexedDB support');
    }).catch(error => {
        console.error('Failed to open database:', error);
    });

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === "refreshDatabase") {
            refreshDatabase().then(() => {
                sendResponse({success: true});
            }).catch((error) => {
                console.error('Error in refreshDatabase:', error);
                sendResponse({success: false, error: error.message});
            });
            return true; 
        }
    });
    
})();