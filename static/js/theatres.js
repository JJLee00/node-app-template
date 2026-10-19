document.addEventListener('DOMContentLoaded', () => {
  const location = document.getElementById('theatreLocation');
  const mapLocation = document.getElementById('mapLocation');
  location.addEventListener('input', () => { mapLocation.textContent = location.value || 'your area'; });
  document.querySelectorAll('[data-showtime]').forEach((button) => button.addEventListener('click', () => {
    document.querySelectorAll('[data-showtime]').forEach((item) => item.classList.remove('is-selected'));
    button.classList.add('is-selected');
  }));
});
