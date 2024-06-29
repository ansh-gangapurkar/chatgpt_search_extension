document.addEventListener('DOMContentLoaded', function() {
    const refreshButton = document.getElementById('refreshButton');

    const buttonState = localStorage.getItem('buttonState');
    if (buttonState === 'refreshed') {
        refreshButton.textContent = 'Database Refreshed!';
    }

    refreshButton.addEventListener('click', function() {
        refreshButton.disabled = true;

        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, { action: "refreshDatabase" }, function(response) {
                if (chrome.runtime.lastError) {
                    console.error(chrome.runtime.lastError);
                    refreshButton.disabled = false;
                } else {
                    alert('Database refreshed successfully!');
                    refreshButton.textContent = 'Database Refreshed!';
                    localStorage.setItem('buttonState', 'refreshed');
                }
            });
        });
    });

    window.addEventListener('beforeunload', function() {
        localStorage.removeItem('buttonState');
    });
});
