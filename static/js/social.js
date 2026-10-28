document.addEventListener('DOMContentLoaded', () => {
  const searchForm = document.getElementById('socialMovieSearch');
  const queryInput = document.getElementById('socialMovieQuery');
  const searchStatus = document.getElementById('socialSearchStatus');
  const movieResults = document.getElementById('socialMovieResults');
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
  const communityRankings = document.getElementById('communityRankings');
  const communityRankingsEmpty = document.getElementById('communityRankingsEmpty');
  const myRankedList = document.getElementById('myRankedList');
  const myRankedListEmpty = document.getElementById('myRankedListEmpty');
  const myListStatus = document.getElementById('myListStatus');
  const myListShareStatus = document.getElementById('myListShareStatus');
  const toggleMyListButton = document.getElementById('toggleMyList');
  const shareDialog = document.getElementById('shareDialog');
  const shareLinkInput = document.getElementById('shareLinkInput');
  const shareDialogStatus = document.getElementById('shareDialogStatus');

  let selectedMovie = null;
  let selectedRating = 0;
  let myList = { title: 'My top movies', shared: false, shareUrl: null, items: [] };

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
      reviewPage.hidden = false;
      // Keep the address bar shareable for whichever movie is open.
      history.replaceState(null, '', `/social?movie=${selectedMovie.tmdbId}`);
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
    document.getElementById('socialMovieRank').textContent = data.summary.rank ? `#${data.summary.rank}` : '—';
    document.getElementById('socialMovieRankLabel').textContent = data.summary.rank
      ? `of ${data.summary.rankedMovieCount} ranked` : 'Not ranked yet';
    renderMyListToggle();
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
      // A new rating can move movies on the leaderboard.
      await Promise.all([loadReviews(), loadRankings()]);
    } catch (error) {
      postNotice.textContent = error.message;
    }
  }

  // --------------------------------
  // RANKINGS
  // --------------------------------

  function rankingRow(movie, { meta = '', controls = '' } = {}) {
    const li = document.createElement('li');
    li.className = 'ranking-row';
    li.innerHTML = `
      <span class="ranking-row__rank">${movie.rank}</span>
      ${movie.poster ? `<img class="ranking-row__poster" src="${escapeHtml(movie.poster)}" alt="">` : '<span class="ranking-row__poster ranking-row__poster--empty">No poster</span>'}
      <button class="ranking-row__body" type="button" data-open-movie>
        <strong>${escapeHtml(movie.title)}</strong>
        <small>${meta}</small>
      </button>
      ${controls}`;
    li.querySelector('[data-open-movie]').addEventListener('click', () => {
      selectMovie({ id: movie.tmdbId, title: movie.title });
    });
    return li;
  }

  async function loadRankings() {
    try {
      const response = await fetch('/api/social/rankings?limit=10', { headers: authHeaders() });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Unable to load rankings.');

      communityRankings.innerHTML = '';
      data.rankings.forEach((movie) => {
        const voters = `${movie.raterCount} rating${movie.raterCount === 1 ? '' : 's'}`;
        communityRankings.appendChild(rankingRow(movie, {
          meta: `${stars(Math.round(movie.averageRating))} ${Number(movie.averageRating).toFixed(1)} avg · ${voters}`
        }));
      });
      communityRankingsEmpty.hidden = data.rankings.length > 0;
    } catch (error) {
      communityRankings.innerHTML = '';
      communityRankingsEmpty.hidden = false;
      communityRankingsEmpty.querySelector('span').textContent = error.message;
    }
  }

  function renderMyList() {
    document.getElementById('myListTitle').textContent = myList.title;
    myRankedList.innerHTML = '';

    myList.items.forEach((movie, index) => {
      const year = (movie.releaseDate || '').slice(0, 4) || 'Release date unavailable';
      const row = rankingRow(movie, {
        meta: escapeHtml(year),
        controls: `
          <span class="ranking-row__controls">
            <button type="button" data-move="-1" aria-label="Move ${escapeHtml(movie.title)} up" ${index === 0 ? 'disabled' : ''}>↑</button>
            <button type="button" data-move="1" aria-label="Move ${escapeHtml(movie.title)} down" ${index === myList.items.length - 1 ? 'disabled' : ''}>↓</button>
            <button type="button" data-remove aria-label="Remove ${escapeHtml(movie.title)} from your list">✕</button>
          </span>`
      });

      row.querySelectorAll('[data-move]').forEach((button) => {
        button.addEventListener('click', () => moveListItem(index, Number(button.dataset.move)));
      });
      row.querySelector('[data-remove]').addEventListener('click', () => {
        saveMyList(myList.items.filter((item) => item.id !== movie.id), `Removed ${movie.title}.`);
      });
      myRankedList.appendChild(row);
    });

    myRankedListEmpty.hidden = myList.items.length > 0;
    myListShareStatus.hidden = !myList.shared;
    renderMyListToggle();
  }

  function renderMyListToggle() {
    if (!selectedMovie) return;
    const inList = myList.items.some((item) => item.id === selectedMovie.id);
    toggleMyListButton.classList.toggle('is-active', inList);
    toggleMyListButton.querySelector('span').textContent = inList
      ? `#${myList.items.findIndex((item) => item.id === selectedMovie.id) + 1} in my ranked list · Remove`
      : 'Add to my ranked list';
  }

  async function loadMyList() {
    try {
      const response = await fetch('/api/social/my-list', { headers: authHeaders() });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Unable to load your ranked list.');
      myList = data.list;
      renderMyList();
    } catch (error) {
      myListStatus.textContent = error.message;
    }
  }

  async function saveMyList(items, successMessage) {
    const previous = myList;
    // Update the screen right away; roll back if the server rejects the change.
    myList = { ...myList, items: items.map((item, index) => ({ ...item, rank: index + 1 })) };
    renderMyList();
    myListStatus.textContent = 'Saving…';

    try {
      const response = await fetch('/api/social/my-list', {
        method: 'PUT',
        headers: authHeaders(true),
        body: JSON.stringify({ title: myList.title, movieIds: myList.items.map((item) => item.id) })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Unable to save your ranked list.');
      myList = data.list;
      renderMyList();
      myListStatus.textContent = successMessage || data.message;
    } catch (error) {
      myList = previous;
      renderMyList();
      myListStatus.textContent = error.message;
    }
  }

  function moveListItem(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= myList.items.length) return;
    const items = [...myList.items];
    [items[index], items[target]] = [items[target], items[index]];
    saveMyList(items, `Moved ${items[target].title} to #${target + 1}.`);
  }

  function toggleSelectedInMyList() {
    if (!selectedMovie) return;
    if (myList.items.some((item) => item.id === selectedMovie.id)) {
      saveMyList(myList.items.filter((item) => item.id !== selectedMovie.id), `Removed ${selectedMovie.title}.`);
    } else {
      saveMyList([...myList.items, selectedMovie], `Added ${selectedMovie.title} at #${myList.items.length + 1}.`);
    }
  }

  // --------------------------------
  // SHARING
  // --------------------------------

  function openShareDialog({ title, subtitle, url }) {
    document.getElementById('shareDialogTitle').textContent = title;
    document.getElementById('shareDialogSubtitle').textContent = subtitle;
    shareLinkInput.value = url;
    shareDialogStatus.textContent = '';

    shareDialog.showModal();
    shareLinkInput.select();
  }

  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText(shareLinkInput.value);
      shareDialogStatus.textContent = 'Link copied to clipboard.';
    } catch {
      // Clipboard access can be blocked; the link is already selected for manual copying.
      shareLinkInput.select();
      shareDialogStatus.textContent = 'Press Ctrl+C / ⌘C to copy the selected link.';
    }
  }

  function shareSelectedMovie() {
    if (!selectedMovie) return;
    openShareDialog({
      title: `Share ${selectedMovie.title}`,
      subtitle: 'Send friends to this movie’s ratings and reviews.',
      url: `${window.location.origin}/social?movie=${selectedMovie.tmdbId}`
    });
  }

  async function setListSharing(enabled) {
    myListStatus.textContent = enabled ? 'Creating share link…' : 'Turning off sharing…';
    const response = await fetch('/api/social/my-list/share', {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify({ enabled })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Unable to update sharing.');
    myList = data.list;
    renderMyList();
    myListStatus.textContent = data.message;
  }

  async function shareMyList() {
    if (!myList.items.length) {
      myListStatus.textContent = 'Add at least one movie before sharing your list.';
      return;
    }
    try {
      if (!myList.shared) await setListSharing(true);
      openShareDialog({
        title: `Share “${myList.title}”`,
        subtitle: 'Anyone with this link can view your ranked list without logging in.',
        url: myList.shareUrl
      });
    } catch (error) {
      myListStatus.textContent = error.message;
    }
  }

  searchForm.addEventListener('submit', searchMovies);
  reviewText.addEventListener('input', updatePostButton);
  ratingButtons.forEach((button) => button.addEventListener('click', () => updateRating(Number(button.dataset.rating))));
  postButton.addEventListener('click', postReview);
  toggleMyListButton.addEventListener('click', toggleSelectedInMyList);
  document.getElementById('shareMovie').addEventListener('click', shareSelectedMovie);
  document.getElementById('shareMyList').addEventListener('click', shareMyList);
  document.getElementById('stopSharingList').addEventListener('click', () => {
    setListSharing(false).catch((error) => { myListStatus.textContent = error.message; });
  });
  document.getElementById('copyShareLink').addEventListener('click', copyShareLink);
  // Clicking the dark backdrop outside the dialog closes it.
  shareDialog.addEventListener('click', (event) => {
    if (event.target === shareDialog) shareDialog.close();
  });

  loadRankings();
  loadMyList();

  // A movie selected from Search can deep-link into Socials as /social?movie=<tmdb id>.
  const initialMovieId = new URLSearchParams(window.location.search).get('movie');
  if (initialMovieId && /^\d+$/.test(initialMovieId)) {
    selectMovie({ id: Number(initialMovieId), title: 'selected movie' });
  }
});
