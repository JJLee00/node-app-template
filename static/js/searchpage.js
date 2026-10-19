document.addEventListener('DOMContentLoaded', () => {
  const query = document.getElementById('searchInput');
  const genre = document.getElementById('genreFilter');
  const rating = document.getElementById('ratingFilter');
  const year = document.getElementById('yearFilter');
  const cards = [...document.querySelectorAll('.movie-card')];
  const count = document.getElementById('resultCount');
  const empty = document.getElementById('emptyResults');

  function filterMovies() {
    const term = query.value.trim().toLowerCase();
    let visible = 0;
    cards.forEach((card) => {
      const matches = (!term || card.dataset.title.includes(term)) && (genre.value === 'All Genres' || card.dataset.genre === genre.value) && (rating.value === 'All Ratings' || Number(card.dataset.rating) >= Number(rating.value)) && (year.value === 'All Years' || card.dataset.year === year.value);
      card.hidden = !matches;
      if (matches) visible += 1;
    });
    count.textContent = `${visible} ${visible === 1 ? 'movie' : 'movies'}`;
    empty.hidden = visible !== 0;
  }

  [query, genre, rating, year].forEach((control) => control.addEventListener(control === query ? 'input' : 'change', filterMovies));
  document.getElementById('searchButton').addEventListener('click', filterMovies);
  document.querySelectorAll('.save-movie').forEach((button) => button.addEventListener('click', () => button.classList.toggle('is-saved')));
});
