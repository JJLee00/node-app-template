
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

  const movieCatalog = JSON.parse(
    document.getElementById('movieCatalogData').textContent
  );

  const favorites = new Set(
    JSON.parse(localStorage.getItem('movieboxFavorites') || '[]')
  );

  // Tracks which movies are currently displayed.
  let currentMovies = movieCatalog;
  let showingTMDBResults = false;

  // -----------------------------
  // FILTER MOVIES
  // -----------------------------

  function filterMovies() {
    const term = query.value.trim().toLowerCase();
    let visible = 0;

    const cards = movieGrid.querySelectorAll('.movie-card');

    cards.forEach((card) => {
      const matchesTitle =
        showingTMDBResults ||
        !term ||
        card.dataset.title.includes(term);

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

      if (matches) {
        visible++;
      }
    });

    count.textContent =
      `${visible} ${visible === 1 ? 'movie' : 'movies'}`;

    empty.hidden = visible !== 0;
  }

  // -----------------------------
  // MOVIE DETAILS
  // -----------------------------

  function closeMovieDetails() {
    detailView.hidden = true;
    searchView.hidden = false;

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }

  function updateFavoriteButton(button, isFavorite) {
    button.classList.toggle('is-favorite', isFavorite);

    button.querySelector('span').textContent =
      isFavorite ? 'Favorited' : 'Favorite';
  }

  function renderMovieDetails(movie) {
    const detailImage = document.getElementById('detailImage');

    detailImage.src = movie.image || '';
    detailImage.alt = `${movie.title} poster`;

    document.getElementById('detailMeta').textContent =
      `${movie.genre} · ${movie.year}`;

    document.getElementById('detailTitle').textContent =
      movie.title;

    document.getElementById('detailRelease').textContent =
      movie.releaseDate || 'Unknown';

    document.getElementById('detailScore').textContent =
      movie.score;

    document.getElementById('detailReviews').textContent =
      movie.reviewCount == null
        ? 'Review count unavailable'
        : `${Number(movie.reviewCount).toLocaleString()} reviews`;

    document.getElementById('detailDescription').textContent =
      movie.description || 'No description available.';

    document.getElementById('reviewMovieLink').href =
      `/social?movie=${encodeURIComponent(movie.title)}`;

    // Display available movie images.
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

  // -----------------------------
  // CREATE MOVIE CARDS
  // -----------------------------

  function createMovieCard(movie) {
    const card = document.createElement('article');

    card.className = 'movie-card';

    card.dataset.title = movie.title.toLowerCase();
    card.dataset.genre = movie.genre;
    card.dataset.rating = movie.score;
    card.dataset.year = movie.year;

    card.style.cursor = 'pointer';

    card.innerHTML = `
      <div class="movie-card__image">
        <img alt="">
        <div class="movie-card__shade"></div>
        <span class="movie-score">⭐ ${movie.score}</span>
      </div>

      <div class="movie-card__body">
        <h3></h3>
        <p></p>
      </div>
    `;

    card.querySelector('img').src = movie.image || '';

    card.querySelector('img').alt =
      `${movie.title} poster`;

    card.querySelector('h3').textContent =
      movie.title;

    card.querySelector('.movie-card__body p').textContent =
      `${movie.year} · ${movie.genre}`;

    // CLICKING A POSTER OPENS ITS DETAILS!
    card.addEventListener('click', () => {
      renderMovieDetails(movie);
    });

    return card;
  }

  // -----------------------------
  // DISPLAY MOVIES
  // -----------------------------

  function displayMovies(movies) {
    currentMovies = movies;

    movieGrid.replaceChildren();

    movies.forEach((movie) => {
      const card = createMovieCard(movie);
      movieGrid.appendChild(card);
    });

    filterMovies();
  }

  // -----------------------------
  // TMDB SEARCH
  // -----------------------------

  async function searchMovies() {
    const movieTitle = query.value.trim();

    if (!movieTitle) {
      showingTMDBResults = false;
      displayMovies(movieCatalog);
      return;
    }

    try {
      count.textContent = 'Searching...';

      const response = await fetch(
        `/api/movies/search?query=${encodeURIComponent(movieTitle)}`
      );

      if (!response.ok) {
        throw new Error('Movie search failed');
      }

      const data = await response.json();

      console.log('TMDB movie results:', data.results);

      const movies = (data.results || []).map((movie) => {
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
          description: movie.description || 'No description available.',
          image: movie.poster || '',
          gallery: []
        };
      });

      showingTMDBResults = true;

      // Genre data is not included in our current API response.
      genre.value = 'All Genres';

      displayMovies(movies);

    } catch (error) {
      console.error('TMDB search error:', error);
      count.textContent = 'Search failed';
      alert('Unable to search movies.');
    }
  }

  // -----------------------------
  // SEARCH BUTTON
  // -----------------------------

  document.getElementById('searchButton')
    .addEventListener('click', searchMovies);

  // Allow searching with Enter.
  query.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      searchMovies();
    }
  });

  // Keep the original filtering behavior.
  query.addEventListener('input', () => {
    if (!showingTMDBResults) {
      filterMovies();
    }
  });

  [genre, rating, year].forEach((control) => {
    control.addEventListener('change', filterMovies);
  });

  // -----------------------------
  // BACK BUTTONS
  // -----------------------------

  document.getElementById('backToResults')
    .addEventListener('click', closeMovieDetails);

  document.getElementById('leaveDisplay')
    .addEventListener('click', closeMovieDetails);

  // -----------------------------
  // FAVORITE MOVIES
  // -----------------------------

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

  // -----------------------------
  // TRAILER BUTTON
  // -----------------------------

  document.getElementById('trailerButton')
    .addEventListener('click', () => {
      document.getElementById('trailerButton')
        .classList.toggle('is-playing');
    });

  // -----------------------------
  // INITIAL MOVIES
  // -----------------------------

  displayMovies(movieCatalog);
});
