document.addEventListener('DOMContentLoaded', () => {
  const searchForm = document.getElementById('socialMovieSearch');
  const queryInput = document.getElementById('socialMovieQuery');
  const searchStatus = document.getElementById('socialSearchStatus');
  const movieResults = document.getElementById('socialMovieResults');
  const emptyState = document.getElementById('socialEmptyState');
  const reviewPage = document.getElementById('socialReviewPage');
  const myReviews = document.getElementById('myReviews');
  const myReviewsEmpty = document.getElementById('myReviewsEmpty');
  const publicReviews = document.getElementById('publicReviews');
  const publicReviewsEmpty = document.getElementById('publicReviewsEmpty');
  const reviewText = document.getElementById('reviewText');
  const visibility = document.getElementById('reviewVisibility');
  const postButton = document.getElementById('postReview');
  const postNotice = document.getElementById('postNotice');
  const ratingButtons = [...document.querySelectorAll('[data-rating]')];

  let selectedMovie = null;
  let selectedRating = 0;

  function authHeaders(includeJson = false) {
    const token = localStorage.getItem('movieboxToken');
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (includeJson) headers['Content-Type'] = 'application/json';
    return headers;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function stars(rating) {
    return `<span class="feed-stars" aria-label="${rating} out of 5 stars">${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}</span>`;
  }

  function formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.valueOf()) ? value : date.toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  }

  function renderSearchResults(movies) {
    movieResults.innerHTML = '';

    if (!movies.length) {
      movieResults.hidden = true;
      searchStatus.textContent = 'No matching movies were found in TMDB.';
      return;
    }

    movies.slice(0, 8).forEach((movie) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'social-movie-option';
      button.innerHTML = `
        ${movie.poster ? `<img src="${escapeHtml(movie.poster)}" alt="">` : '<span class="social-movie-option__poster">No poster</span>'}
        <span><strong>${escapeHtml(movie.title)}</strong><small>${escapeHtml((movie.releaseDate || '').slice(0, 4) || 'Release date unavailable')}</small></span>
        <svg class="icon icon--small"><use href="#icon-arrow"/></svg>`;
      button.addEventListener('click', () => selectMovie(movie));
      movieResults.appendChild(button);
    });

    movieResults.hidden = false;
    searchStatus.textContent = `${Math.min(movies.length, 8)} matching movie${movies.length === 1 ? '' : 's'} found. Select one to view reviews.`;
  }

  async function searchMovies(event) {
    event.preventDefault();
    const query = queryInput.value.trim();
    if (!query) return;

    searchStatus.textContent = 'Searching the movie database…';
    movieResults.hidden = true;

    try {
      const response = await fetch(`/api/movies/search?query=${encodeURIComponent(query)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Movie search failed.');
      renderSearchResults(data.results || []);
    } catch (error) {
      searchStatus.textContent = error.message;
    }
  }

  async function selectMovie(movie) {
    searchStatus.textContent = `Opening reviews for ${movie.title}…`;

    try {
      // The server validates this TMDB ID and inserts the movie into the
      // Socials catalog only when it is not already stored in MySQL.
      const response = await fetch('/api/social/movies/resolve', {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify({ tmdbId: movie.id })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Unable to open this movie.');

      selectedMovie = data.movie;
      queryInput.value = selectedMovie.title;
      movieResults.hidden = true;
      searchStatus.textContent = '';
      emptyState.hidden = true;
      reviewPage.hidden = false;
      renderMovieSummary(selectedMovie);
      await loadReviews();
      reviewPage.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      searchStatus.textContent = error.message;
      if (error.message.toLowerCase().includes('token')) {
        searchStatus.textContent += ' Please log in again.';
      }
    }
  }

  function renderMovieSummary(movie) {
    const poster = document.getElementById('socialMoviePoster');
    poster.hidden = !movie.poster;
    if (movie.poster) poster.src = movie.poster;
    poster.alt = movie.poster ? `${movie.title} poster` : '';

    document.getElementById('socialMovieTitle').textContent = movie.title;
    document.getElementById('socialMovieMeta').textContent = movie.releaseDate
      ? `Movie · ${movie.releaseDate.slice(0, 4)}` : 'Movie';
    document.getElementById('socialMovieRelease').textContent = movie.releaseDate
      ? `Released ${formatDate(movie.releaseDate)}` : 'Release date unavailable';
    document.getElementById('myReviewsDescription').textContent = `Reviews you have shared for ${movie.title}.`;
    document.getElementById('reviewComposerMovie').textContent = `Share your take on ${movie.title}.`;
  }

  function renderReviewCard(review, own = false) {
    const article = document.createElement('article');
    article.className = own ? 'social-review-card social-review-card--mine' : 'social-review-card';
    const name = own ? 'Your review' : (review.reviewerName || 'MovieBox member');
    const initials = own ? 'You' : (review.initials || 'MB');
    article.innerHTML = `
      <div class="social-review-card__header">
        <div class="avatar avatar--small">${escapeHtml(initials)}</div>
        <div><strong>${escapeHtml(name)}</strong><span>${escapeHtml(formatDate(review.createdAt))}${own ? ` · ${escapeHtml(review.visibility)}` : ' · Public'}</span></div>
        ${stars(Number(review.rating))}
      </div>
      <p>${escapeHtml(review.reviewText)}</p>`;
    return article;
  }

  async function loadReviews() {
    if (!selectedMovie) return;

    const response = await fetch(`/api/social/movies/${selectedMovie.id}/reviews`, {
      headers: authHeaders()
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Unable to load reviews.');

    document.getElementById('socialAverageRating').textContent = data.summary.reviewCount
      ? Number(data.summary.averageRating).toFixed(1) : '—';
    document.getElementById('socialReviewCount').textContent = data.summary.reviewCount;
    document.getElementById('publicReviewCount').textContent = `${data.publicReviews.length} shown`;

    myReviews.innerHTML = '';
    data.myReviews.forEach((review) => myReviews.appendChild(renderReviewCard(review, true)));
    myReviewsEmpty.hidden = data.myReviews.length > 0;

    publicReviews.innerHTML = '';
    data.publicReviews.forEach((review) => publicReviews.appendChild(renderReviewCard(review, false)));
    publicReviewsEmpty.hidden = data.publicReviews.length > 0;
  }

  function updateRating(rating) {
    selectedRating = rating;
    ratingButtons.forEach((button) => {
      button.classList.toggle('is-selected', Number(button.dataset.rating) <= rating);
    });
    updatePostButton();
  }

  function updatePostButton() {
    postButton.disabled = !selectedMovie || !reviewText.value.trim() || !selectedRating;
  }

  async function postReview() {
    if (postButton.disabled || !selectedMovie) return;
    postNotice.hidden = false;
    postNotice.textContent = 'Posting your review…';

    try {
      const response = await fetch(`/api/social/movies/${selectedMovie.id}/reviews`, {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify({
          rating: selectedRating,
          reviewText: reviewText.value.trim(),
          visibility: visibility.value
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Unable to post review.');

      postNotice.textContent = data.message || 'Your review was posted.';
      reviewText.value = '';
      updateRating(0);
      await loadReviews();
    } catch (error) {
      postNotice.textContent = error.message;
    }
  }

  searchForm.addEventListener('submit', searchMovies);
  reviewText.addEventListener('input', updatePostButton);
  ratingButtons.forEach((button) => button.addEventListener('click', () => updateRating(Number(button.dataset.rating))));
  postButton.addEventListener('click', postReview);

  // A movie selected from Search can deep-link into Socials as /social?movie=<tmdb id>.
  const initialMovieId = new URLSearchParams(window.location.search).get('movie');
  if (initialMovieId && /^\d+$/.test(initialMovieId)) {
    selectMovie({ id: Number(initialMovieId), title: 'selected movie' });
  }
});
