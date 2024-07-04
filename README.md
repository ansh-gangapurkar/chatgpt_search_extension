# ChatGPT Search Bar Chrome Extension

This project is a Chrome extension that allows users to search through their ChatGPT chats.

## Data Storage

The extension interacts with the ChatGPT website to scrape and index chat titles and IDs, storing them using IndexedDB for search functionality.

## Project Structure

- **Content Scripts**: 
  - `inject-search-bar.js`: Injects a search bar into the ChatGPT website and manages IndexedDB for storing chat data. It also scrapes chat titles and IDs from the ChatGPT website.
  - `content.js`: Handles messages from the extension popup for displaying search results.

- **Background Scripts**:
  - `background.js`: Initializes and manages IndexedDB, handles extension installation and updates, and processes messages related to database operations.

- **Popup**:
  - `popup.html`: The user interface for the extension popup.
  - `popup.js`: Handles user interactions within the popup, including refreshing the chat database and performing search operations.

- **Styles**:
  - `popup-styles.css`: Styles for the extension popup.
  - `injected-styles.css`: Styles for the injected search bar on the ChatGPT website.
  - `instructions-styles.css`: Styles for the instructions page.

- **Manifest**:
  - `manifest.json`: Configuration for the Chrome extension.

- **Instructions**:
  - `instructions.html`: Instructions for using the extension, displayed when the extension is installed.

## Requirements

To use this project, you will need to have a Chrome browser. Download the extension [here](https://chromewebstore.google.com/detail/chatgpt-search-bar/hobnnbggfgajghdnhiiempklmhepijhg?authuser=4&hl=en).
