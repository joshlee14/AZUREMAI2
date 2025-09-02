// background.js
//
// Service worker that handles clicks on the extension toolbar icon.  When the
// user clicks the MAI Copilot button, we send a message to the active tab
// instructing the content script to toggle the HUD on Sunfire pages.  If
// no content script is available (e.g. the user is not on a matching page),
// the message will fail silently.

chrome.action.onClicked.addListener(async (tab) => {
  try {
    if (!tab || typeof tab.id !== 'number') return;
    await chrome.tabs.sendMessage(tab.id, { type: 'MAI_TOGGLE_HUD' });
  } catch (err) {
    // When the content script is not present (e.g., on non-Sunfire pages),
    // the sendMessage call will throw.  Catch and ignore the error to
    // prevent unhandled promise rejections.
    console.debug('[MAI] Failed to toggle HUD:', err && err.message);
  }
});