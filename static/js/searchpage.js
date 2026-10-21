document.addEventListener('DOMContentLoaded', () => {
  const query = document.getElementById('searchInput');
  const genre = document.getElementById('genreFilter');
  const rating = document.getElementById('ratingFilter');
  const year = document.getElementById('yearFilter');
  const cards = [...document.querySelectorAll('.movie-card')];
  const count = document.getElementById('resultCount');
  const empty = document.getElementById('emptyResults');
  const searchView = document.getElementById('movieSearchView');
  const detailView = document.getElementById('movieDetailView');
  const movieCatalog = JSON.parse(document.getElementById('movieCatalogData').textContent);
  const favorites = new Set(JSON.parse(localStorage.getItem('movieboxFavorites') || '[]'));

  // Keep the original client-side filtering behavior from v0.1.
  function filterMovies() {
    const term = query.value.trim().toLowerCase();
    let visible = 0;

    cards.forEach((card) => {
      const matches = (!term || card.dataset.title.includes(term))
        && (genre.value === 'All Genres' || card.dataset.genre === genre.value)
        && (rating.value === 'All Ratings' || Number(card.dataset.rating) >= Number(rating.value))
        && (year.value === 'All Years' || card.dataset.year === year.value);

      card.hidden = !matches;
      if (matches) visible += 1;
    });

    count.textContent = `${visible} ${visible === 1 ? 'movie' : 'movies'}`;
    empty.hidden = visible !== 0;
  }

  function closeMovieDetails() {
    detailView.hidden = true;
    searchView.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderMovieDetails(movie) {
    document.getElementById('detailImage').src = movie.image;
    document.getElementById('detailImage').alt = `${movie.title} trailer backdrop`;
    document.getElementById('detailMeta').textContent = `${movie.genre} · ${movie.year}`;
    document.getElementById('detailTitle').textContent = movie.title;
    document.getElementById('detailRelease').textContent = movie.releaseDate;
    document.getElementById('detailScore').textContent = movie.score;
    document.getElementById('detailReviews').textContent = `${Number(movie.reviewCount).toLocaleString()} reviews`;
    document.getElementById('detailDescription').textContent = movie.description;
    document.getElementById('reviewMovieLink').href = `/social?movie=${encodeURIComponent(movie.title)}`;

    const gallery = document.getElementById('detailGallery');
    gallery.replaceChildren();
    [movie.image, ...movie.gallery].forEach((image, index) => {
      const img = document.createElement('img');
      img.src = image;
      img.alt = `${movie.title} still ${index + 1}`;
      gallery.appendChild(img);
    });

    const favoriteButton = document.getElementById('favoriteMovie');
    favoriteButton.dataset.movieTitle = movie.title;
    updateFavoriteButton(favoriteButton, favorites.has(movie.title));

    searchView.hidden = true;
    detailView.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function updateFavoriteButton(button, isFavorite) {
    button.classList.toggle('is-favorite', isFavorite);
    button.querySelector('span').textContent = isFavorite ? 'Favorited' : 'Favorite';
  }

  [query, genre, rating, year].forEach((control) => {
    control.addEventListener(control === query ? 'input' : 'change', filterMovies);
  });

  document.getElementById('searchButton').addEventListener('click', filterMovies);

  document.querySelectorAll('.movie-details-button').forEach((button) => {
    button.addEventListener('click', () => {
      const card = button.closest('.movie-card');
      renderMovieDetails(movieCatalog[Number(card.dataset.movieIndex)]);
    });
  });

  document.getElementById('backToResults').addEventListener('click', closeMovieDetails);
  document.getElementById('leaveDisplay').addEventListener('click', closeMovieDetails);

  document.getElementById('favoriteMovie').addEventListener('click', (event) => {
    const button = event.currentTarget;
    const title = button.dataset.movieTitle;

    if (favorites.has(title)) favorites.delete(title);
    else favorites.add(title);

    localStorage.setItem('movieboxFavorites', JSON.stringify([...favorites]));
    updateFavoriteButton(button, favorites.has(title));
  });

  // The Figma export presents a trailer control but does not provide a video URL.
  document.getElementById('trailerButton').addEventListener('click', () => {
    document.getElementById('trailerButton').classList.toggle('is-playing');
  });
});
