(() => {
  // CHECK FOR TOKEN AS SOON AS THE PAGE LOADS
  // Every page built on base.html loads this file, so this one check protects all of them.
  // If the user isn't logged in, send them to the logon page.
  const token = localStorage.getItem('movieboxToken');
  if (!token) {
    window.location.href = '/logon';
    return;
  }

  // LOG OUT: remove the token and go back to the logon page
  document.querySelectorAll('[data-logout]').forEach((button) => {
    button.addEventListener('click', () => {
      localStorage.removeItem('movieboxToken');
      window.location.href = '/logon';
    });
  });

  const root = document.documentElement;
  const mobileToggle = document.querySelector('[data-mobile-menu-toggle]');
  const mobileNav = document.querySelector('.mobile-nav');
  mobileToggle?.addEventListener('click', () => {
    const open = mobileNav.classList.toggle('is-open');
    mobileToggle.setAttribute('aria-expanded', String(open));
  });

  document.querySelectorAll('[data-tab-target]').forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.dataset.tabTarget;
      document.querySelectorAll('[data-tab-target]').forEach((item) => item.classList.toggle('is-active', item === button));
      document.querySelectorAll('[data-tab-panel]').forEach((panel) => panel.classList.toggle('is-active', panel.dataset.tabPanel === target));
    });
  });

  document.querySelector('[data-like]')?.addEventListener('click', (event) => {
    const button = event.currentTarget;
    const active = button.classList.toggle('is-liked');
    const baseCount = Number(button.dataset.count || 0);
    button.querySelector('span').textContent = String(baseCount + (active ? 1 : 0));
  });

  const reviewList = document.querySelector('[data-review-list]');
  document.querySelector('[data-review-sort]')?.addEventListener('change', (event) => {
    const rows = [...reviewList.querySelectorAll('.review-row')];
    rows.sort((a, b) => event.target.value === 'favorites'
      ? Number(b.dataset.favorites) - Number(a.dataset.favorites)
      : Number(a.dataset.order) - Number(b.dataset.order));
    rows.forEach((row) => reviewList.appendChild(row));
  });

  document.querySelectorAll('[data-remove-watchlist]').forEach((button) => {
    button.addEventListener('click', () => {
      button.closest('.watchlist-card')?.remove();
      const count = document.querySelector('[data-watchlist-count]');
      if (count) count.textContent = String(document.querySelectorAll('.watchlist-card').length);
    });
  });

  document.querySelectorAll('[data-chat-button]').forEach((button) => {
    button.addEventListener('click', () => { button.querySelector('span').textContent = 'Chat opened'; });
  });

  const savedTheme = localStorage.getItem('moviebox-theme');
  if (savedTheme === 'light' || savedTheme === 'dark') root.dataset.theme = savedTheme;
  const syncThemeButtons = () => document.querySelectorAll('[data-theme-option]').forEach((button) => button.classList.toggle('is-active', button.dataset.themeOption === root.dataset.theme));
  syncThemeButtons();
  document.querySelectorAll('[data-theme-option]').forEach((button) => button.addEventListener('click', () => {
    root.dataset.theme = button.dataset.themeOption;
    localStorage.setItem('moviebox-theme', button.dataset.themeOption);
    syncThemeButtons();
  }));

  document.querySelectorAll('[data-toggle]').forEach((button) => button.addEventListener('click', () => {
    const enabled = !button.classList.contains('is-on');
    button.classList.toggle('is-on', enabled);
    button.setAttribute('aria-checked', String(enabled));
  }));
})();
