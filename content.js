chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'displayResults') {
      const resultsContainer = document.getElementById('results');
      resultsContainer.innerHTML = '';
      message.results.forEach(result => {
        const resultElement = document.createElement('div');
        resultElement.innerText = result;
        resultsContainer.appendChild(resultElement);
      });
    }
  });
  