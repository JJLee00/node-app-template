
require('dotenv').config();

const express = require('express');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const crypto = require('crypto');
const nunjucks = require('nunjucks');

const app = express();
const PORT = process.env.PORT || 3000;

// --------------------------------
// NUNJUCKS CONFIGURATION
// --------------------------------

nunjucks.configure(path.join(__dirname, 'templates'), {
  autoescape: true,
  express: app,
  noCache: process.env.NODE_ENV !== 'production'
});

app.set('view engine', 'html');
app.set('views', path.join(__dirname, 'templates'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
  '/static',
  express.static(path.join(__dirname, 'static'))
);

// Shared placeholder data
const sharedViewData = {
  user: {
    name: 'Alex Morgan',
    username: 'alexmorgan',
    initials: 'AM'
  }
};

// --------------------------------
// DATABASE CONNECTION
// --------------------------------

async function createConnection() {
  return await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });
}

// --------------------------------
// JWT AUTHENTICATION
// --------------------------------

async function authenticateToken(req, res, next) {
  const authorization = req.headers['authorization'];

  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice(7)
    : authorization;

  if (!token) {
    return res.status(401).json({
      message: 'Access denied. No token provided.'
    });
  }

  jwt.verify(
    token,
    process.env.JWT_SECRET,
    async (error, decoded) => {
      if (error) {
        return res.status(403).json({
          message: 'Invalid token.'
        });
      }

      let connection;

      try {
        connection = await createConnection();

        const [rows] = await connection.execute(
          'SELECT email FROM user WHERE email = ?',
          [decoded.email]
        );

        if (rows.length === 0) {
          return res.status(403).json({
            message: 'Account not found or deactivated.'
          });
        }

        req.user = decoded;
        next();

      } catch (dbError) {
        console.error(dbError);

        res.status(500).json({
          message: 'Database error during authentication.'
        });

      } finally {
        if (connection) {
          await connection.end();
        }
      }
    }
  );
}

// --------------------------------
// CREATE ACCOUNT
// --------------------------------

app.post('/api/create-account', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      message: 'Email and password are required.'
    });
  }

  let connection;

  try {
    connection = await createConnection();

    const hashedPassword = await bcrypt.hash(password, 10);

    await connection.execute(
      'INSERT INTO user (email, password) VALUES (?, ?)',
      [email, hashedPassword]
    );

    res.status(201).json({
      message: 'Account created successfully!'
    });

  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(409).json({
        message: 'An account with this email already exists.'
      });
    } else {
      console.error(error);

      res.status(500).json({
        message: 'Error creating account.'
      });
    }

  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

// --------------------------------
// LOGIN
// --------------------------------

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      message: 'Email and password are required.'
    });
  }

  let connection;

  try {
    connection = await createConnection();

    const [rows] = await connection.execute(
      'SELECT * FROM user WHERE email = ?',
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        message: 'Invalid email or password.'
      });
    }

    const user = rows[0];

    const isPasswordValid = await bcrypt.compare(
      password,
      user.password
    );

    if (!isPasswordValid) {
      return res.status(401).json({
        message: 'Invalid email or password.'
      });
    }

    const token = jwt.sign(
      { email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.status(200).json({ token });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: 'Error logging in.'
    });

  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

// --------------------------------
// GET USERS (PROTECTED)
// --------------------------------

app.get('/api/users', authenticateToken, async (req, res) => {
  let connection;

  try {
    connection = await createConnection();

    const [rows] = await connection.execute(
      'SELECT email FROM user'
    );

    const emailList = rows.map(row => row.email);

    res.status(200).json({
      emails: emailList
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: 'Error retrieving email addresses.'
    });

  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

// --------------------------------
// TMDB MOVIE SEARCH
// --------------------------------

app.get('/api/movies/search', async (req, res) => {
  const query = String(req.query.query || '').trim();

  if (!query) {
    return res.status(400).json({
      message: 'Please enter a movie title.'
    });
  }

  if (!process.env.TMDB_API_KEY) {
    return res.status(500).json({
      message: 'TMDB API key is not configured.'
    });
  }

  try {
    const url = new URL(
      'https://api.themoviedb.org/3/search/movie'
    );

    url.searchParams.set('query', query);
    url.searchParams.set('language', 'en-US');
    url.searchParams.set('include_adult', 'false');
    url.searchParams.set(
      'api_key',
      process.env.TMDB_API_KEY
    );

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`TMDB returned ${response.status}`);
    }

    const data = await response.json();

    res.json({
      results: (data.results || []).map(movie => ({
        id: movie.id,
        title: movie.title,
        description: movie.overview,
        releaseDate: movie.release_date,
        rating: movie.vote_average,
        poster: movie.poster_path
          ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
          : null
      }))
    });

  } catch (error) {
    console.error('TMDB search error:', error);

    res.status(502).json({
      message: 'Unable to retrieve movies from TMDB.'
    });
  }
});

// --------------------------------
// NEW: RECENTLY RELEASED MOVIES
// --------------------------------

app.get('/api/movies/recent', async (req, res) => {
  if (!process.env.TMDB_API_KEY) {
    return res.status(500).json({
      message: 'TMDB API key is not configured.'
    });
  }

  try {
    const today = new Date();
    const threeMonthsAgo = new Date(today);

    threeMonthsAgo.setMonth(today.getMonth() - 3);

    const url = new URL(
      'https://api.themoviedb.org/3/discover/movie'
    );

    url.searchParams.set(
      'api_key',
      process.env.TMDB_API_KEY
    );

    url.searchParams.set('language', 'en-US');
    url.searchParams.set('sort_by', 'popularity.desc');
    url.searchParams.set('include_adult', 'false');
    url.searchParams.set('vote_count.gte', '10');

    url.searchParams.set(
      'primary_release_date.gte',
      threeMonthsAgo.toISOString().slice(0, 10)
    );

    url.searchParams.set(
      'primary_release_date.lte',
      today.toISOString().slice(0, 10)
    );

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`TMDB returned ${response.status}`);
    }

    const data = await response.json();

    res.json({
      results: (data.results || []).map(movie => ({
        id: movie.id,
        title: movie.title,
        description: movie.overview,
        releaseDate: movie.release_date,
        rating: movie.vote_average,
        poster: movie.poster_path
          ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
          : null
      }))
    });

  } catch (error) {
    console.error('Recent movies error:', error);

    res.status(502).json({
      message: 'Unable to load recent movies.'
    });
  }
});

// --------------------------------
// TMDB MOVIE TRAILERS
// --------------------------------

app.get('/api/movies/:id/trailer', async (req, res) => {
  const movieId = req.params.id;

  if (!/^\d+$/.test(movieId)) {
    return res.status(400).json({
      message: 'Invalid movie ID.'
    });
  }

  if (!process.env.TMDB_API_KEY) {
    return res.status(500).json({
      message: 'TMDB API key is not configured.'
    });
  }

  try {
    const url = new URL(
      `https://api.themoviedb.org/3/movie/${movieId}/videos`
    );

    url.searchParams.set(
      'api_key',
      process.env.TMDB_API_KEY
    );

    url.searchParams.set('language', 'en-US');

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`TMDB returned ${response.status}`);
    }

    const data = await response.json();

    // Prefer official YouTube trailers.
    const videos = (data.results || []).filter(video =>
      video.site === 'YouTube' &&
      video.key &&
      (video.type === 'Trailer' || video.type === 'Teaser')
    );

    const trailer =
      videos.find(video =>
        video.type === 'Trailer' && video.official
      ) ||
      videos.find(video => video.type === 'Trailer') ||
      videos[0];

    if (!trailer) {
      return res.status(404).json({
        message: 'No trailer available for this movie.'
      });
    }

    res.json({
      trailerUrl:
        `https://www.youtube.com/watch?v=${encodeURIComponent(trailer.key)}`
    });

  } catch (error) {
    console.error('TMDB trailer error:', error);

    res.status(502).json({
      message: 'Unable to retrieve movie trailer.'
    });
  }
});

// --------------------------------
// SOCIALS: MOVIE + REVIEW DATA
// --------------------------------

async function ensureSocialTables(connection) {
  // TMDB IDs are the stable external identifier. Titles are display data only.
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS social_movie (
      id INT NOT NULL AUTO_INCREMENT,
      tmdb_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      release_date DATE NULL,
      poster_url VARCHAR(500) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_social_movie_tmdb (tmdb_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS social_review (
      id INT NOT NULL AUTO_INCREMENT,
      social_movie_id INT NOT NULL,
      reviewer_email VARCHAR(255) NOT NULL,
      rating TINYINT NOT NULL,
      review_text TEXT NOT NULL,
      visibility ENUM('Public', 'Private') NOT NULL DEFAULT 'Public',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_social_review_movie (social_movie_id),
      KEY idx_social_review_reviewer (reviewer_email),
      CONSTRAINT fk_social_review_movie
        FOREIGN KEY (social_movie_id) REFERENCES social_movie(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Each member keeps one personal ranked list. share_token is only set while
  // the list is shared, so a revoked link stops working immediately.
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS social_ranked_list (
      id INT NOT NULL AUTO_INCREMENT,
      owner_email VARCHAR(255) NOT NULL,
      title VARCHAR(100) NOT NULL DEFAULT 'My top movies',
      share_token CHAR(32) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_social_ranked_list_owner (owner_email),
      UNIQUE KEY uq_social_ranked_list_token (share_token)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS social_ranked_list_item (
      list_id INT NOT NULL,
      social_movie_id INT NOT NULL,
      position SMALLINT NOT NULL,
      PRIMARY KEY (list_id, social_movie_id),
      KEY idx_social_ranked_list_item_position (list_id, position),
      CONSTRAINT fk_social_ranked_list_item_list
        FOREIGN KEY (list_id) REFERENCES social_ranked_list(id)
        ON DELETE CASCADE,
      CONSTRAINT fk_social_ranked_list_item_movie
        FOREIGN KEY (social_movie_id) REFERENCES social_movie(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

// Weighted ("Bayesian") average: movies with only a couple of ratings are
// pulled toward the site-wide mean so one 5-star review cannot top the chart.
const RANKING_MIN_RATERS = 3;

async function getCommunityRankings(connection) {
  // Average each member's ratings per movie first, so posting several reviews
  // for the same movie does not count as several votes.
  const [rows] = await connection.execute(
    `SELECT m.id, m.tmdb_id, m.title,
            DATE_FORMAT(m.release_date, '%Y-%m-%d') AS release_date, m.poster_url,
            COUNT(*) AS rater_count, AVG(per_user.rating) AS average_rating,
            SUM(per_user.rating) AS rating_total
     FROM (
       SELECT social_movie_id, reviewer_email, AVG(rating) AS rating
       FROM social_review
       GROUP BY social_movie_id, reviewer_email
     ) AS per_user
     JOIN social_movie m ON m.id = per_user.social_movie_id
     GROUP BY m.id, m.tmdb_id, m.title, m.release_date, m.poster_url`
  );

  const totalVotes = rows.reduce((sum, row) => sum + Number(row.rater_count), 0);
  const totalRating = rows.reduce((sum, row) => sum + Number(row.rating_total), 0);
  const siteMean = totalVotes ? totalRating / totalVotes : 0;

  return rows
    .map(row => {
      const votes = Number(row.rater_count);
      const average = Number(row.average_rating);
      const score = (votes / (votes + RANKING_MIN_RATERS)) * average +
        (RANKING_MIN_RATERS / (votes + RANKING_MIN_RATERS)) * siteMean;

      return {
        id: row.id,
        tmdbId: row.tmdb_id,
        title: row.title,
        releaseDate: row.release_date,
        poster: row.poster_url,
        raterCount: votes,
        averageRating: Math.round(average * 100) / 100,
        score: Math.round(score * 1000) / 1000
      };
    })
    .sort((a, b) =>
      b.score - a.score ||
      b.raterCount - a.raterCount ||
      a.title.localeCompare(b.title)
    )
    .map((movie, index) => ({ rank: index + 1, ...movie }));
}

async function getRankedList(connection, where, params) {
  const [lists] = await connection.execute(
    `SELECT id, owner_email, title, share_token, updated_at
     FROM social_ranked_list WHERE ${where}`,
    params
  );
  if (!lists.length) return null;

  const list = lists[0];
  const [items] = await connection.execute(
    `SELECT m.id, m.tmdb_id, m.title,
            DATE_FORMAT(m.release_date, '%Y-%m-%d') AS release_date, m.poster_url
     FROM social_ranked_list_item i
     JOIN social_movie m ON m.id = i.social_movie_id
     WHERE i.list_id = ?
     ORDER BY i.position`,
    [list.id]
  );

  return {
    id: list.id,
    ownerEmail: list.owner_email,
    title: list.title,
    shareToken: list.share_token,
    updatedAt: list.updated_at,
    items: items.map((movie, index) => ({
      rank: index + 1,
      id: movie.id,
      tmdbId: movie.tmdb_id,
      title: movie.title,
      releaseDate: movie.release_date,
      poster: movie.poster_url
    }))
  };
}

function shareUrlFor(req, token) {
  return token ? `${req.protocol}://${req.get('host')}/lists/${token}` : null;
}

function serializeMyList(req, list) {
  return {
    title: list ? list.title : 'My top movies',
    shared: Boolean(list && list.shareToken),
    shareUrl: list ? shareUrlFor(req, list.shareToken) : null,
    items: list ? list.items : []
  };
}

async function fetchTmdbMovie(movieId) {
  if (!process.env.TMDB_API_KEY) {
    const error = new Error('TMDB API key is not configured.');
    error.status = 500;
    throw error;
  }

  const url = new URL(`https://api.themoviedb.org/3/movie/${movieId}`);
  url.searchParams.set('api_key', process.env.TMDB_API_KEY);
  url.searchParams.set('language', 'en-US');

  const response = await fetch(url);
  if (response.status === 404) {
    const error = new Error('That movie does not exist in TMDB.');
    error.status = 404;
    throw error;
  }
  if (!response.ok) throw new Error(`TMDB returned ${response.status}`);

  return await response.json();
}

// Validate the selected TMDB movie and lazily add it to the Socials catalog.
app.post('/api/social/movies/resolve', authenticateToken, async (req, res) => {
  const tmdbId = Number(req.body.tmdbId);
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
    return res.status(400).json({ message: 'A valid TMDB movie ID is required.' });
  }

  let connection;
  try {
    const tmdbMovie = await fetchTmdbMovie(tmdbId);
    connection = await createConnection();
    await ensureSocialTables(connection);

    const posterUrl = tmdbMovie.poster_path
      ? `https://image.tmdb.org/t/p/w500${tmdbMovie.poster_path}`
      : null;

    // Upsert keeps the local Socials record synchronized without duplicating it.
    await connection.execute(
      `INSERT INTO social_movie (tmdb_id, title, release_date, poster_url)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         title = VALUES(title),
         release_date = VALUES(release_date),
         poster_url = VALUES(poster_url)`,
      [tmdbMovie.id, tmdbMovie.title, tmdbMovie.release_date || null, posterUrl]
    );

    const [rows] = await connection.execute(
      `SELECT id, tmdb_id, title, DATE_FORMAT(release_date, '%Y-%m-%d') AS release_date, poster_url
       FROM social_movie WHERE tmdb_id = ?`,
      [tmdbMovie.id]
    );
    const movie = rows[0];

    res.json({
      movie: {
        id: movie.id,
        tmdbId: movie.tmdb_id,
        title: movie.title,
        releaseDate: movie.release_date,
        poster: movie.poster_url
      }
    });
  } catch (error) {
    console.error('Social movie resolve error:', error);
    res.status(error.status || 502).json({
      message: error.message || 'Unable to validate this movie.'
    });
  } finally {
    if (connection) await connection.end();
  }
});

// Return aggregate Socials ratings, the current user's reviews, and other
// users' public reviews for the selected movie.
app.get('/api/social/movies/:id/reviews', authenticateToken, async (req, res) => {
  const movieId = Number(req.params.id);
  if (!Number.isInteger(movieId) || movieId <= 0) {
    return res.status(400).json({ message: 'Invalid Socials movie ID.' });
  }

  let connection;
  try {
    connection = await createConnection();
    await ensureSocialTables(connection);

    const [movies] = await connection.execute(
      'SELECT id FROM social_movie WHERE id = ?', [movieId]
    );
    if (!movies.length) return res.status(404).json({ message: 'Movie not found in Socials.' });

    const [summaryRows] = await connection.execute(
      `SELECT COUNT(*) AS review_count, ROUND(AVG(rating), 2) AS average_rating
       FROM social_review WHERE social_movie_id = ?`,
      [movieId]
    );

    const [myRows] = await connection.execute(
      `SELECT id, rating, review_text, visibility, created_at
       FROM social_review
       WHERE social_movie_id = ? AND reviewer_email = ?
       ORDER BY created_at DESC`,
      [movieId, req.user.email]
    );

    const [publicRows] = await connection.execute(
      `SELECT id, reviewer_email, rating, review_text, created_at
       FROM social_review
       WHERE social_movie_id = ?
         AND visibility = 'Public'
         AND reviewer_email <> ?
       ORDER BY created_at DESC`,
      [movieId, req.user.email]
    );

    const publicReviews = publicRows.map(review => {
      // The current user table stores email but no public display name. Do not
      // expose another member's email address in the Socials response.
      return {
        id: review.id,
        reviewerName: 'MovieBox member',
        initials: 'MB',
        rating: review.rating,
        reviewText: review.review_text,
        createdAt: review.created_at
      };
    });

    const rankings = await getCommunityRankings(connection);
    const ranking = rankings.find(movie => movie.id === movieId);

    const [listRows] = await connection.execute(
      `SELECT 1 FROM social_ranked_list l
       JOIN social_ranked_list_item i ON i.list_id = l.id
       WHERE l.owner_email = ? AND i.social_movie_id = ?`,
      [req.user.email, movieId]
    );

    res.json({
      summary: {
        reviewCount: Number(summaryRows[0].review_count || 0),
        averageRating: Number(summaryRows[0].average_rating || 0),
        rank: ranking ? ranking.rank : null,
        rankedMovieCount: rankings.length,
        inMyList: listRows.length > 0
      },
      myReviews: myRows.map(review => ({
        id: review.id,
        rating: review.rating,
        reviewText: review.review_text,
        visibility: review.visibility,
        createdAt: review.created_at
      })),
      publicReviews
    });
  } catch (error) {
    console.error('Social reviews error:', error);
    res.status(500).json({ message: 'Unable to load reviews.' });
  } finally {
    if (connection) await connection.end();
  }
});

app.post('/api/social/movies/:id/reviews', authenticateToken, async (req, res) => {
  const movieId = Number(req.params.id);
  const rating = Number(req.body.rating);
  const reviewText = String(req.body.reviewText || '').trim();
  const visibility = req.body.visibility === 'Private' ? 'Private' : 'Public';

  if (!Number.isInteger(movieId) || movieId <= 0) {
    return res.status(400).json({ message: 'Invalid Socials movie ID.' });
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ message: 'Choose a rating from 1 to 5 stars.' });
  }
  if (!reviewText) return res.status(400).json({ message: 'Write a review before posting.' });
  if (reviewText.length > 2000) return res.status(400).json({ message: 'Review must be 2,000 characters or fewer.' });

  let connection;
  try {
    connection = await createConnection();
    await ensureSocialTables(connection);

    const [movies] = await connection.execute(
      'SELECT id FROM social_movie WHERE id = ?', [movieId]
    );
    if (!movies.length) return res.status(404).json({ message: 'Movie not found in Socials.' });

    await connection.execute(
      `INSERT INTO social_review
       (social_movie_id, reviewer_email, rating, review_text, visibility)
       VALUES (?, ?, ?, ?, ?)`,
      [movieId, req.user.email, rating, reviewText, visibility]
    );

    res.status(201).json({ message: `Your ${visibility.toLowerCase()} review was posted.` });
  } catch (error) {
    console.error('Post social review error:', error);
    res.status(500).json({ message: 'Unable to post review.' });
  } finally {
    if (connection) await connection.end();
  }
});

// --------------------------------
// SOCIALS: RANKINGS + SHARING
// --------------------------------

const MAX_RANKED_LIST_ITEMS = 25;

// Community leaderboard built from every member's star ratings.
app.get('/api/social/rankings', authenticateToken, async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);

  let connection;
  try {
    connection = await createConnection();
    await ensureSocialTables(connection);

    const rankings = await getCommunityRankings(connection);
    res.json({
      minimumRaters: RANKING_MIN_RATERS,
      totalRanked: rankings.length,
      rankings: rankings.slice(0, limit)
    });
  } catch (error) {
    console.error('Social rankings error:', error);
    res.status(500).json({ message: 'Unable to load rankings.' });
  } finally {
    if (connection) await connection.end();
  }
});

app.get('/api/social/my-list', authenticateToken, async (req, res) => {
  let connection;
  try {
    connection = await createConnection();
    await ensureSocialTables(connection);

    const list = await getRankedList(connection, 'owner_email = ?', [req.user.email]);
    res.json({ list: serializeMyList(req, list) });
  } catch (error) {
    console.error('Load ranked list error:', error);
    res.status(500).json({ message: 'Unable to load your ranked list.' });
  } finally {
    if (connection) await connection.end();
  }
});

// Replace the member's ranked list with the given order of Socials movie IDs.
// Sending the whole order keeps add, remove, and reorder in one simple call.
app.put('/api/social/my-list', authenticateToken, async (req, res) => {
  const title = String(req.body.title ?? 'My top movies').trim() || 'My top movies';
  const movieIds = Array.isArray(req.body.movieIds) ? req.body.movieIds.map(Number) : null;

  if (!movieIds || movieIds.some(id => !Number.isInteger(id) || id <= 0)) {
    return res.status(400).json({ message: 'movieIds must be a list of Socials movie IDs.' });
  }
  if (new Set(movieIds).size !== movieIds.length) {
    return res.status(400).json({ message: 'A movie can only appear once in your list.' });
  }
  if (movieIds.length > MAX_RANKED_LIST_ITEMS) {
    return res.status(400).json({ message: `Ranked lists can hold up to ${MAX_RANKED_LIST_ITEMS} movies.` });
  }
  if (title.length > 100) {
    return res.status(400).json({ message: 'List title must be 100 characters or fewer.' });
  }

  let connection;
  try {
    connection = await createConnection();
    await ensureSocialTables(connection);

    if (movieIds.length) {
      const [found] = await connection.query(
        'SELECT id FROM social_movie WHERE id IN (?)', [movieIds]
      );
      if (found.length !== movieIds.length) {
        return res.status(404).json({ message: 'One or more movies were not found in Socials.' });
      }
    }

    await connection.beginTransaction();

    await connection.execute(
      `INSERT INTO social_ranked_list (owner_email, title) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE title = VALUES(title), updated_at = CURRENT_TIMESTAMP`,
      [req.user.email, title]
    );
    const [lists] = await connection.execute(
      'SELECT id FROM social_ranked_list WHERE owner_email = ?', [req.user.email]
    );
    const listId = lists[0].id;

    await connection.execute('DELETE FROM social_ranked_list_item WHERE list_id = ?', [listId]);
    if (movieIds.length) {
      await connection.query(
        'INSERT INTO social_ranked_list_item (list_id, social_movie_id, position) VALUES ?',
        [movieIds.map((movieId, index) => [listId, movieId, index + 1])]
      );
    }

    await connection.commit();

    const list = await getRankedList(connection, 'id = ?', [listId]);
    res.json({ message: 'Your ranked list was saved.', list: serializeMyList(req, list) });
  } catch (error) {
    if (connection) await connection.rollback().catch(() => {});
    console.error('Save ranked list error:', error);
    res.status(500).json({ message: 'Unable to save your ranked list.' });
  } finally {
    if (connection) await connection.end();
  }
});

// Turn the public share link for the member's ranked list on or off.
app.post('/api/social/my-list/share', authenticateToken, async (req, res) => {
  const enabled = req.body.enabled !== false;

  let connection;
  try {
    connection = await createConnection();
    await ensureSocialTables(connection);

    await connection.execute(
      `INSERT INTO social_ranked_list (owner_email) VALUES (?)
       ON DUPLICATE KEY UPDATE owner_email = owner_email`,
      [req.user.email]
    );

    if (enabled) {
      // Keep an existing token so links that were already sent keep working.
      await connection.execute(
        `UPDATE social_ranked_list
         SET share_token = COALESCE(share_token, ?)
         WHERE owner_email = ?`,
        [crypto.randomBytes(16).toString('hex'), req.user.email]
      );
    } else {
      await connection.execute(
        'UPDATE social_ranked_list SET share_token = NULL WHERE owner_email = ?',
        [req.user.email]
      );
    }

    const list = await getRankedList(connection, 'owner_email = ?', [req.user.email]);
    res.json({
      message: enabled ? 'Your list is now shared.' : 'Your list is no longer shared.',
      list: serializeMyList(req, list)
    });
  } catch (error) {
    console.error('Share ranked list error:', error);
    res.status(500).json({ message: 'Unable to update sharing for your list.' });
  } finally {
    if (connection) await connection.end();
  }
});


// --------------------------------
// HTML PAGE ROUTES
// --------------------------------

app.get('/', (req, res, next) => {
  try {
    res.render('landing.html');
  } catch (error) {
    next(error);
  }
});

app.get('/logon', (req, res, next) => {
  try {
    res.render('logon.html');
  } catch (error) {
    next(error);
  }
});

app.get('/dashboard', (req, res, next) => {
  try {
    res.render('dashboard.html', {
      ...sharedViewData
    });
  } catch (error) {
    next(error);
  }
});

app.get('/settings', (req, res, next) => {
  try {
    res.render('settings.html', {
      ...sharedViewData
    });
  } catch (error) {
    next(error);
  }
});

app.get('/searchpage', (req, res, next) => {
  try {
    res.render('searchpage.html', {
      ...sharedViewData
    });
  } catch (error) {
    next(error);
  }
});

app.get('/social', (req, res, next) => {
  try {
    res.render('social.html', {
      ...sharedViewData
    });
  } catch (error) {
    next(error);
  }
});

app.get('/theatres', (req, res, next) => {
  try {
    res.render('theatres.html', {
      ...sharedViewData
    });
  } catch (error) {
    next(error);
  }
});

// Public, read-only view of a shared ranked list. No login is required so the
// link works when posted outside MovieBox; the owner's email is never shown.
app.get('/lists/:token', async (req, res, next) => {
  if (!/^[a-f0-9]{32}$/.test(req.params.token)) {
    return res.status(404).render('shared_list.html', { list: null });
  }

  let connection;
  try {
    connection = await createConnection();
    await ensureSocialTables(connection);

    const list = await getRankedList(connection, 'share_token = ?', [req.params.token]);
    res.status(list ? 200 : 404).render('shared_list.html', {
      list: list && {
        title: list.title,
        updatedAt: list.updatedAt,
        items: list.items
      },
      shareUrl: list ? shareUrlFor(req, list.shareToken) : null
    });
  } catch (error) {
    next(error);
  } finally {
    if (connection) await connection.end();
  }
});

// --------------------------------
// ERROR HANDLING
// --------------------------------

app.use((req, res) => {
  res.status(404).send('Page not found');
});

app.use((error, req, res, next) => {
  console.error(error);

  res.status(500).send('Internal server error');
});

// --------------------------------
// START SERVER
// --------------------------------

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(
      `MovieBox running at http://localhost:${PORT}`
    );
  });
}

module.exports = app;
