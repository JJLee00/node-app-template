
require('dotenv').config();

const express = require('express');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
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
