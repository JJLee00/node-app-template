
document.addEventListener('DOMContentLoaded', () => {
  const query = document.getElementById('searchInput');
  const genre = document.getElementById('genreFilter');
  const rating = document.getElementById('ratingFilter');
  const year = document.getElementById('yearFilter');

  const movieGrid = document.getElementById('movieGrid');
  const count = document.getElementById('resultCount');
  const empty = document.getElementById('emptyResults');
  const searchView = document.getElementById('movieSearchView');
  const detailView = document.getElementById('movieDetailView');

  const movieCatalogElement = document.getElementById('movieCatalogData');

  const movieCatalog = movieCatalogElement
    ? JSON.parse(movieCatalogElement.textContent)
    : [];

  const favorites = new Set(
    JSON.parse(localStorage.getItem('movieboxFavorites') || '[]')
  );

  let currentMovies = movieCatalog;
  let showingTMDBResults = false;
  let selectedMovieId = null;
  let activeRequest = 0;

  // --------------------------------
  // FILTER MOVIES
  // --------------------------------

  function filterMovies() {
    const term = query.value.trim().toLowerCase();
    let visible = 0;

    const cards = movieGrid.querySelectorAll('.movie-card');

    cards.forEach((card) => {
      const matchesTitle =
        showingTMDBResults ||
        !term ||
        (card.dataset.title || '').includes(term);

      const matchesGenre =
        genre.value === 'All Genres' ||
        card.dataset.genre === genre.value;

      const matchesRating =
        rating.value === 'All Ratings' ||
        Number(card.dataset.rating) >= Number(rating.value);

      const matchesYear =
        year.value === 'All Years' ||
        card.dataset.year === year.value;

      const matches =
        matchesTitle &&
        matchesGenre &&
        matchesRating &&
        matchesYear;

      card.hidden = !matches;

      if (matches) visible++;
    });

    count.textContent =
      `${visible} ${visible === 1 ? 'movie' : 'movies'}`;

    empty.hidden = visible !== 0;
  }

  // --------------------------------
  // CLOSE MOVIE DETAILS
  // --------------------------------

  function closeMovieDetails() {
    detailView.hidden = true;
    searchView.hidden = false;

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }

  // --------------------------------
  // FAVORITE BUTTON APPEARANCE
  // --------------------------------

  function updateFavoriteButton(button, isFavorite) {
    button.classList.toggle('is-favorite', isFavorite);

    const label = button.querySelector('span');

    if (label) {
      label.textContent =
        isFavorite ? 'Favorited' : 'Favorite';
    }
  }

  // --------------------------------
  // DISPLAY MOVIE DETAILS
  // --------------------------------

  function renderMovieDetails(movie) {
    selectedMovieId = movie.id || null;

    const detailImage = document.getElementById('detailImage');

    detailImage.src = movie.image || '';
    detailImage.alt = `${movie.title} poster`;

    document.getElementById('detailMeta').textContent =
      `${movie.genre || 'Movie'} · ${movie.year || 'Unknown'}`;

    document.getElementById('detailTitle').textContent =
      movie.title;

    document.getElementById('detailRelease').textContent =
      movie.releaseDate || 'Unknown';

    document.getElementById('detailScore').textContent =
      movie.score ?? 'N/A';

    document.getElementById('detailReviews').textContent =
      movie.reviewCount == null
        ? 'Review count unavailable'
        : `${Number(movie.reviewCount).toLocaleString()} reviews`;

    document.getElementById('detailDescription').textContent =
      movie.description || 'No description available.';

    document.getElementById('reviewMovieLink').href =
      `/social?movie=${encodeURIComponent(movie.title)}`;

    const gallery = document.getElementById('detailGallery');

    gallery.replaceChildren();

    const images = [
      movie.image,
      ...(movie.gallery || [])
    ].filter(Boolean);

    images.forEach((image, index) => {
      const img = document.createElement('img');

      img.src = image;
      img.alt = `${movie.title} image ${index + 1}`;

      gallery.appendChild(img);
    });

    const favoriteButton = document.getElementById('favoriteMovie');

    favoriteButton.dataset.movieTitle = movie.title;

    updateFavoriteButton(
      favoriteButton,
      favorites.has(movie.title)
    );

    searchView.hidden = true;
    detailView.hidden = false;

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }

  // --------------------------------
  // CREATE MOVIE CARD
  // --------------------------------

  function createMovieCard(movie) {
    const card = document.createElement('article');

    card.className = 'movie-card';
    card.style.cursor = 'pointer';

    card.dataset.title = movie.title.toLowerCase();
    card.dataset.genre = movie.genre || 'Movie';
    card.dataset.rating = movie.score ?? 0;
    card.dataset.year = movie.year || 'Unknown';

    card.innerHTML = `
      <div class="movie-card__image">
        <img alt="">
        <div class="movie-card__shade"></div>
        <span class="movie-score"></span>
      </div>

      <div class="movie-card__body">
        <h3></h3>
        <p></p>
      </div>
    `;

    const poster = card.querySelector('img');

    poster.src = movie.image || '';
    poster.alt = `${movie.title} poster`;

    card.querySelector('.movie-score').textContent =
      `⭐ ${movie.score ?? 'N/A'}`;

    card.querySelector('h3').textContent =
      movie.title;

    card.querySelector('.movie-card__body p').textContent =
      `${movie.year || 'Unknown'} · ${movie.genre || 'Movie'}`;

    // Clicking the poster opens movie details.
    card.addEventListener('click', () => {
      renderMovieDetails(movie);
    });

    return card;
  }

  // --------------------------------
  // DISPLAY MOVIES
  // --------------------------------

  function displayMovies(movies) {
    currentMovies = movies;

    movieGrid.replaceChildren();

    movies.forEach((movie) => {
      movieGrid.appendChild(createMovieCard(movie));
    });

    filterMovies();
  }

  // --------------------------------
  // FORMAT TMDB MOVIES
  // --------------------------------

  function formatTMDBMovies(results) {
    return (results || []).map((movie) => {
      const releaseYear =
        movie.releaseDate?.slice(0, 4) || 'Unknown';

      return {
        id: movie.id,
        title: movie.title || 'Untitled',
        year: releaseYear,
        genre: 'Movie',
        score: Number(movie.rating || 0).toFixed(1),
        reviewCount: null,
        releaseDate: movie.releaseDate || 'Unknown',
        description:
          movie.description || 'No description available.',
        image: movie.poster || '',
        gallery: []
      };
    });
  }

  // --------------------------------
  // LOAD RECENTLY RELEASED MOVIES
  // --------------------------------

  async function loadRecentMovies() {
    const requestId = ++activeRequest;

    try {
      count.textContent = 'Loading recent movies...';

      const response = await fetch('/api/movies/recent');

      if (!response.ok) {
        throw new Error('Unable to load recent movies');
      }

      const data = await response.json();

      // Ignore an outdated response if a search started.
      if (requestId !== activeRequest) return;

      const movies = formatTMDBMovies(data.results);

      showingTMDBResults = true;

      // Reset filters for the new movie list.
      genre.value = 'All Genres';
      rating.value = 'All Ratings';
      year.value = 'All Years';

      displayMovies(movies);

    } catch (error) {
      if (requestId !== activeRequest) return;

      console.error('Recent movies error:', error);

      // Keep the page usable if TMDB is unavailable.
      showingTMDBResults = false;
      displayMovies(movieCatalog);
    }
  }

  // --------------------------------
  // SEARCH TMDB MOVIES
  // --------------------------------

  async function searchMovies() {
    const movieTitle = query.value.trim();

    // Empty search returns to recently released movies.
    if (!movieTitle) {
      loadRecentMovies();
      return;
    }

    const requestId = ++activeRequest;

    try {
      count.textContent = 'Searching...';

      const response = await fetch(
        `/api/movies/search?query=${encodeURIComponent(movieTitle)}`
      );

      if (!response.ok) {
        throw new Error('Movie search failed');
      }

      const data = await response.json();

      if (requestId !== activeRequest) return;

      console.log('TMDB movie results:', data.results);

      const movies = formatTMDBMovies(data.results);

      showingTMDBResults = true;

      genre.value = 'All Genres';
      rating.value = 'All Ratings';
      year.value = 'All Years';

      displayMovies(movies);

    } catch (error) {
      if (requestId !== activeRequest) return;

      console.error('TMDB search error:', error);

      count.textContent = 'Search failed';

      alert('Unable to search movies.');
    }
  }

  // --------------------------------
  // SEARCH BUTTON
  // --------------------------------

  document.getElementById('searchButton')
    .addEventListener('click', searchMovies);

  // Press Enter to search.
  query.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      searchMovies();
    }
  });

  query.addEventListener('input', () => {
    if (!showingTMDBResults) {
      filterMovies();
    }
  });

  [genre, rating, year].forEach((control) => {
    control.addEventListener('change', filterMovies);
  });

  // --------------------------------
  // BACK BUTTONS
  // --------------------------------

  document.getElementById('backToResults')
    .addEventListener('click', closeMovieDetails);

  document.getElementById('leaveDisplay')
    .addEventListener('click', closeMovieDetails);

  // --------------------------------
  // FAVORITE MOVIES
  // --------------------------------

  document.getElementById('favoriteMovie')
    .addEventListener('click', (event) => {
      const button = event.currentTarget;
      const title = button.dataset.movieTitle;

      if (favorites.has(title)) {
        favorites.delete(title);
      } else {
        favorites.add(title);
      }

      localStorage.setItem(
        'movieboxFavorites',
        JSON.stringify([...favorites])
      );

      updateFavoriteButton(
        button,
        favorites.has(title)
      );
    });

  // --------------------------------
  // WATCH TRAILER
  // --------------------------------

  const trailerButton = document.getElementById('trailerButton');

  trailerButton.addEventListener('click', async (event) => {
    event.preventDefault();

    if (!selectedMovieId) {
      alert('Trailer unavailable for this movie.');
      return;
    }

    // Open a tab immediately to avoid popup blockers.
    const trailerTab = window.open('about:blank', '_blank');

    if (trailerTab) {
      trailerTab.document.title = 'Loading trailer...';
      trailerTab.opener = null;
    }

    try {
      const response = await fetch(
        `/api/movies/${selectedMovieId}/trailer`
      );

      if (!response.ok) {
        throw new Error(
          `Trailer request failed: ${response.status}`
        );
      }

      const data = await response.json();

      if (!data.trailerUrl) {
        if (trailerTab && !trailerTab.closed) {
          trailerTab.close();
        }

        alert('No trailer available for this movie.');
        return;
      }

      console.log('Opening trailer:', data.trailerUrl);

      if (trailerTab && !trailerTab.closed) {
        trailerTab.location.replace(data.trailerUrl);
      } else {
        window.location.assign(data.trailerUrl);
      }

    } catch (error) {
      console.error('Trailer error:', error);

      if (trailerTab && !trailerTab.closed) {
        trailerTab.close();
      }

      alert('Unable to load trailer for this movie.');
    }
  });

  // --------------------------------
  // INITIAL MOVIES
  // --------------------------------

  // Automatically show recently released movies
  // instead of the six placeholder movies.
  loadRecentMovies();
});
