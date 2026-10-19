document.addEventListener('DOMContentLoaded', () => {
  const forms = [...document.querySelectorAll('[data-auth-form]')];
  const message = document.getElementById('message');

  // Switch between the Log In and Create Account views.
  function setMode(mode) {
    document
      .querySelectorAll('.auth-tabs [data-auth-tab]')
      .forEach((tab) => {
        tab.classList.toggle(
          'is-active',
          tab.dataset.authTab === mode
        );
      });

    // Only display the form belonging to the selected mode.
    forms.forEach((form) => {
      form.hidden = form.dataset.authForm !== mode;
    });

    document.querySelector('[data-auth-eyebrow]').textContent =
      mode === 'login'
        ? 'Welcome back'
        : 'Join the community';

    document.querySelector('[data-auth-title]').textContent =
      mode === 'login'
        ? 'Log in to MovieBox'
        : 'Create your account';

    document.querySelector('[data-auth-copy]').textContent =
      mode === 'login'
        ? 'Your watchlist has been waiting.'
        : 'Start sharing your movie world today.';

    document.querySelector('[data-auth-switch]').innerHTML =
      mode === 'login'
        ? 'New to MovieBox? <button type="button" data-switch-mode="create">Create an account</button>'
        : 'Already have an account? <button type="button" data-switch-mode="login">Log in</button>';

    message.textContent = '';
  }

  // Handle authentication tabs, bottom switch link,
  // and password visibility buttons.
  document.addEventListener('click', (event) => {
    const tab = event.target.closest(
      '[data-auth-tab], [data-switch-mode]'
    );

    if (tab) {
      setMode(
        tab.dataset.authTab ||
        tab.dataset.switchMode
      );
    }

    const toggle = event.target.closest('[data-password-toggle]');

    if (toggle) {
      const input = toggle
        .closest('.password-field')
        .querySelector('input');

      input.type =
        input.type === 'password'
          ? 'text'
          : 'password';

      toggle.textContent =
        input.type === 'password'
          ? 'Show'
          : 'Hide';
    }
  });

  // Send login/account creation requests to Express.
  async function submitAuth(form, endpoint) {
    message.className = 'message';
    message.textContent = 'Please wait…';

    const payload = Object.fromEntries(
      new FormData(form).entries()
    );

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || 'Request failed.'
        );
      }

      if (data.token) {
        localStorage.setItem(
          'movieboxToken',
          data.token
        );
      }

      message.classList.add('success');
      message.textContent =
        data.message || 'Success.';

      if (endpoint === '/api/login') {
        window.location.href = '/dashboard';
      } else {
        setMode('login');
      }
    } catch (error) {
      message.classList.add('error');
      message.textContent = error.message;
    }
  }

  document
    .getElementById('logon-form')
    .addEventListener('submit', (event) => {
      event.preventDefault();

      submitAuth(
        event.currentTarget,
        '/api/login'
      );
    });

  document
    .getElementById('create-account-form')
    .addEventListener('submit', (event) => {
      event.preventDefault();

      submitAuth(
        event.currentTarget,
        '/api/create-account'
      );
    });

  // Default to Log In unless ?mode=create is present.
  const initialMode =
    new URLSearchParams(window.location.search).get('mode') === 'create'
      ? 'create'
      : 'login';

  setMode(initialMode);
});