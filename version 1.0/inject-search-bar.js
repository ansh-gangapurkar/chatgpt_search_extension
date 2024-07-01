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
                console.log('Retrieved chat data:', event.target.result);
                resolve(event.target.result);
            };

            request.onerror = (event) => {
                console.error('Error getting chat data:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    function injectSearchBar() {
        const navContainer = document.evaluate('/html/body/div[1]/div[1]/div[1]/div/div/div/div/nav/div[2]', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        if (!navContainer) {
            console.log('Navigation container for injection not found');
            return;
        }

        let searchBarContainer = document.querySelector('.chatgpt-search-container');
        if (!searchBarContainer) {
            searchBarContainer = document.createElement('div');
            searchBarContainer.className = 'chatgpt-search-container';
            searchBarContainer.innerHTML = `
                <input type="text" id="chatgpt-search-input" placeholder="Search your chats...">
                <div id="chatgpt-search-results" style="display: none;"></div>
            `;
            navContainer.parentNode.insertBefore(searchBarContainer, navContainer);
            const searchInput = document.getElementById('chatgpt-search-input');
            searchInput.addEventListener('input', debouncedPerformSearch);

            console.log('Search bar injected successfully');
        }
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

        console.log('Scraped chat titles:', newChatData);
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

    function tokenizeAndNormalize(text) {
        return text.toLowerCase().split(/\W+/).filter(token => token.length > 0);
    }

    function levenshteinDistance(a, b) {
        const matrix = [];

        for (let i = 0; i <= b.length; i++) {
            matrix[i] = [i];
        }

        for (let j = 1; j <= a.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }

        return matrix[b.length][a.length];
    }

    function calculateRelevanceScore(queryTokens, titleTokens) {
        let score = 0;
        for (const queryToken of queryTokens) {
            let bestMatch = Infinity;
            for (const titleToken of titleTokens) {
                if (titleToken.startsWith(queryToken)) {
                    bestMatch = 0;
                    break;
                }
                const distance = levenshteinDistance(queryToken, titleToken);
                const similarity = 1 - distance / Math.max(queryToken.length, titleToken.length);
                if (similarity > 0.5) {
                    bestMatch = Math.min(bestMatch, distance);
                }
            }
            if (bestMatch < Infinity) {
                score += 1 / (1 + bestMatch);
            }
        }
        return score / Math.sqrt(queryTokens.length);
    }

    let cachedResults = null;
    let cachedQuery = '';

    function performSearch() {
        const query = document.getElementById('chatgpt-search-input').value.trim();
        const resultsContainer = document.getElementById('chatgpt-search-results');

        if (query === '') {
            resultsContainer.innerHTML = '';
            resultsContainer.style.display = 'none';
            return;
        }

        if (query === cachedQuery && cachedResults) {
            displayResults(cachedResults);
            return;
        }

        const queryTokens = tokenizeAndNormalize(query);
        console.log('Search query tokens:', queryTokens);

        getChatData()
            .then(chatData => {
                console.log('Chat data for search:', chatData);
                const results = chatData.map(chat => {
                    const titleTokens = tokenizeAndNormalize(chat.title);
                    const relevanceScore = calculateRelevanceScore(queryTokens, titleTokens);
                    return { ...chat, relevanceScore };
                })
                .filter(chat => chat.relevanceScore > 0)
                .sort((a, b) => b.relevanceScore - a.relevanceScore)
                .slice(0, 20);

                cachedResults = results;
                cachedQuery = query;
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

    const debouncedPerformSearch = debounce(performSearch, 100);

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
