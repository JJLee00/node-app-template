document.addEventListener('DOMContentLoaded', () => {
  const text = document.getElementById('reviewText');
  const post = document.getElementById('postReview');
  const notice = document.getElementById('postNotice');
  text.addEventListener('input', () => { post.disabled = !text.value.trim(); });
  post.addEventListener('click', () => {
    const visibility = document.getElementById('reviewVisibility').value.toLowerCase();
    notice.textContent = `Your ${visibility} review was posted.`;
    notice.hidden = false;
    text.value = '';
    post.disabled = true;
  });
  document.querySelectorAll('[data-like]').forEach((button) => button.addEventListener('click', () => {
    const liked = button.classList.toggle('is-liked');
    const base = Number(button.dataset.count);
    button.querySelector('span').textContent = base + (liked ? 1 : 0);
  }));
});
