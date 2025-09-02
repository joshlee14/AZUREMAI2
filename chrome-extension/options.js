(async () => {
  // When the options page loads, populate the input with the stored API base
  // or the default defined in the manifest.  The manifest's host_permissions
  // ensure we have access to any domain we choose here.
  const apiBaseInput = document.getElementById('apiBase');
  const msgSpan = document.getElementById('msg');
  const saveBtn = document.getElementById('saveBtn');

  // Initialize the input value.  If nothing is stored, use the default from
  // the content script (the Azure App Service base).  We cannot import
  // variables from the content script here, so we duplicate the default.
  const DEFAULT_API_BASE = 'https://icarusmai5-fkh7gge6edh6aabj.centralus-01.azurewebsites.net';
  chrome.storage.sync.get({ apiBase: DEFAULT_API_BASE }, ({ apiBase }) => {
    apiBaseInput.value = apiBase || DEFAULT_API_BASE;
  });

  // Save the new API base when the user clicks Save.  Remove any trailing
  // slash to avoid double slashes when concatenating paths.
  saveBtn.addEventListener('click', () => {
    const v = apiBaseInput.value.trim().replace(/\/$/, '');
    chrome.storage.sync.set({ apiBase: v }, () => {
      msgSpan.textContent = 'Saved';
      setTimeout(() => { msgSpan.textContent = ''; }, 1500);
    });
  });
})();