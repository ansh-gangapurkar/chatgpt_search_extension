document.addEventListener('DOMContentLoaded', function() {
  const searchInput = document.getElementById('chatgpt-search-input');
  const resultsContainer = document.getElementById('chatgpt-search-results');

  searchInput.addEventListener('input', debounce(performSearch, 300));

  function performSearch() {
      const query = searchInput.value.trim();

      if (query === '') {
          resultsContainer.innerHTML = '';
          resultsContainer.style.display = 'none';
          return;
      }

      chrome.runtime.sendMessage({action: "getChatData"}, response => {
          if (response.success) {
              const chatData = response.data;
              const results = searchChats(query, chatData);
              displayResults(results);
          } else {
              resultsContainer.innerHTML = '<div class="chatgpt-search-message">Error: Unable to perform search.</div>';
              resultsContainer.style.display = 'block';
          }
      });
  }

  function searchChats(query, chatData) {
      const queryTokens = tokenizeAndNormalize(query);
      return chatData.map(chat => {
          const titleTokens = tokenizeAndNormalize(chat.title);
          const relevanceScore = calculateRelevanceScore(queryTokens, titleTokens);
          return { ...chat, relevanceScore };
      })
      .filter(chat => chat.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 20);
  }

  function displayResults(results) {
      resultsContainer.innerHTML = '';

      if (results.length === 0) {
          resultsContainer.innerHTML = '<div class="chatgpt-search-message">No results found.</div>';
      } else {
          results.forEach(result => {
              const resultElement = document.createElement('div');
              resultElement.className = 'chatgpt-search-result-item';
              resultElement.innerHTML = `
                  <p class="chatgpt-search-result-title">${result.title}</p>
                  <a href="${result.link}" class="chatgpt-search-result-link" target="_blank">Open Chat</a>
              `;
              resultsContainer.appendChild(resultElement);
          });
      }
      resultsContainer.style.display = 'block';
  }

  function tokenizeAndNormalize(text) {
      return text.toLowerCase().split(/\W+/).filter(token => token.length > 0);
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
              if (similarity > 0.65) {
                  bestMatch = Math.min(bestMatch, distance);
              }
          }
          if (bestMatch < Infinity) {
              score += 1 / (1 + bestMatch);
          }
      }
      return score / Math.sqrt(queryTokens.length);
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
});
