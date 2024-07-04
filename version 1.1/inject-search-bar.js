(function() {
    async function saveChatData(chatData) {
        try {
            await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({action: "saveChatData", data: chatData}, response => {
                    if (response.success) {
                        resolve();
                    } else {
                        reject(new Error(response.error));
                    }
                });
            });
        } catch (error) {
            if (error.message.includes('Extension context invalidated')) {
                setTimeout(() => saveChatData(chatData), 1000);
            } else {
                console.error('Error saving chat data:', error);
            }
        }
    }

    async function getChatData() {
        try {
            return await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({action: "getChatData"}, response => {
                    if (response.success) {
                        resolve(response.data);
                    } else {
                        reject(new Error(response.error));
                    }
                });
            });
        } catch (error) {
            if (error.message.includes('Extension context invalidated')) {
                setTimeout(() => getChatData(), 1000);
            } else {
                console.error('Error getting chat data:', error);
            }
        }
    }

    function injectSearchBar() {
        const navContainer = document.evaluate('/html/body/div[1]/div[1]/div[1]/div/div/div/div/nav/div[2]', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        if (!navContainer) {
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
        }
    }

    async function scrapeChatTitles() {
        const chatItems = document.querySelectorAll('nav li');
        const newChatData = Array.from(chatItems).map(item => {
            const titleElement = item.querySelector('div[class*="overflow-hidden"]');
            const linkElement = item.querySelector('a');
            if (titleElement && linkElement) {
                const title = titleElement.textContent.trim();
                const chatId = linkElement.getAttribute('href').split('/').pop();
                const fullLink = `https://chat.openai.com${linkElement.getAttribute('href')}`;
                return { title, chatId, link: fullLink };
            }
            return null;
        }).filter(Boolean);

        try {
            const existingData = await getChatData();
            const updatedData = mergeAndUpdateChatData(existingData, newChatData);
            await saveChatData(updatedData);
        } catch (error) {
            console.error('Error updating chat data:', error);
        }
    }

    function mergeAndUpdateChatData(existingData, newData) {
        const mergedData = [...existingData];
        const existingIds = new Set(existingData.map(chat => chat.chatId));

        newData.forEach(newChat => {
            const existingIndex = mergedData.findIndex(chat => chat.chatId === newChat.chatId);
            if (existingIndex !== -1) {
                mergedData[existingIndex] = newChat;
            } else if (!existingIds.has(newChat.chatId)) {
                mergedData.push(newChat);
            }
        });

        const newIds = new Set(newData.map(chat => chat.chatId));
        return mergedData.filter(chat => newIds.has(chat.chatId));
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
                if (similarity > 0.6) {
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

        getChatData()
            .then(chatData => {
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

    const debouncedPerformSearch = debounce(performSearch, 300);

    function detectDeletedChat() {
        let currentChats = new Map();

        function getAllChatElements() {
            return Array.from(document.querySelectorAll('nav ol > li'));
        }

        function getChatName(chatElement) {
            const nameElement = chatElement.querySelector('div[class*="overflow-hidden"]');
            return nameElement ? nameElement.textContent.trim() : null;
        }

        function getChatId(chatElement) {
            const linkElement = chatElement.querySelector('a');
            return linkElement ? linkElement.getAttribute('href').split('/').pop() : null;
        }

        function updateCurrentChats() {
            const newChats = new Map();
            getAllChatElements().forEach(chatElement => {
                const chatName = getChatName(chatElement);
                const chatId = getChatId(chatElement);
                if (chatName && chatId) {
                    newChats.set(chatId, { element: chatElement, name: chatName });
                }
            });

            currentChats.forEach((chat, chatId) => {
                if (!newChats.has(chatId)) {
                    chrome.runtime.sendMessage({
                        action: "deleteChatData",
                        chatId: chatId
                    });
                }
            });

            currentChats = newChats;
        }

        updateCurrentChats();

        const observer = new MutationObserver((mutations) => {
            if (mutations.some(mutation => 
                mutation.type === 'childList' && 
                (mutation.removedNodes.length > 0 || mutation.addedNodes.length > 0))) {
                updateCurrentChats();
            }
        });

        const chatListContainer = document.querySelector('nav');
        if (chatListContainer) {
            observer.observe(chatListContainer, { childList: true, subtree: true });
        }

        return observer;
    }

    const deletedChatObserver = detectDeletedChat();

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
})();
