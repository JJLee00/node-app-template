require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const nunjucks = require('nunjucks');

const app = express();
const PORT = process.env.PORT || 3000;

nunjucks.configure(path.join(__dirname, 'templates'), {
    autoescape: true,
    express: app,
    noCache: process.env.NODE_ENV !== 'production'
});

app.set('view engine', 'html');
app.set('views', path.join(__dirname, 'templates'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/static', express.static(path.join(__dirname, 'static')));

// Shared placeholder data. Replace with API/service results as backend data is connected.
const sharedViewData = {
    user: { name: 'Alex Morgan', username: 'alexmorgan', initials: 'AM' }
};

//HELPER FUNCTIONS AND AUTHENTICATION MIDDLEWARE
/////////////////////////////////////////////////
// Helper function to create a MySQL connection
async function createConnection() {
    return await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    });
}

// **Authorization Middleware: Verify JWT Token and Check User in Database**
async function authenticateToken(req, res, next) {
    const token = req.headers['authorization'];

    if (!token) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid token.' });
        }

        try {
            const connection = await createConnection();

            // Query the database to verify that the email is associated with an active account
            const [rows] = await connection.execute(
                'SELECT email FROM user WHERE email = ?',
                [decoded.email]
            );

            await connection.end();  // Close connection

            if (rows.length === 0) {
                return res.status(403).json({ message: 'Account not found or deactivated.' });
            }

            req.user = decoded;  // Save the decoded email for use in the route
            next();  // Proceed to the next middleware or route handler
        } catch (dbError) {
            console.error(dbError);
            res.status(500).json({ message: 'Database error during authentication.' });
        }
    });
}
/////////////////////////////////////////////////
//END HELPER FUNCTIONS AND AUTHENTICATION MIDDLEWARE
/////////////////////////////////////////////////



//////////////////////////////////////
//ROUTES TO HANDLE API REQUESTS
//////////////////////////////////////
// Route: Create Account
app.post('/api/create-account', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
    }

    try {
        const connection = await createConnection();
        const hashedPassword = await bcrypt.hash(password, 10);  // Hash password

        const [result] = await connection.execute(
            'INSERT INTO user (email, password) VALUES (?, ?)',
            [email, hashedPassword]
        );

        await connection.end();  // Close connection

        res.status(201).json({ message: 'Account created successfully!' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(409).json({ message: 'An account with this email already exists.' });
        } else {
            console.error(error);
            res.status(500).json({ message: 'Error creating account.' });
        }
    }
});

// Route: Logon
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
    }

    try {
        const connection = await createConnection();

        const [rows] = await connection.execute(
            'SELECT * FROM user WHERE email = ?',
            [email]
        );

        await connection.end();  // Close connection

        if (rows.length === 0) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        const user = rows[0];

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        const token = jwt.sign(
            { email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.status(200).json({ token });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error logging in.' });
    }
});

// Route: Get All Email Addresses
app.get('/api/users', authenticateToken, async (req, res) => {
    try {
        const connection = await createConnection();

        const [rows] = await connection.execute('SELECT email FROM user');

        await connection.end();  // Close connection

        const emailList = rows.map((row) => row.email);
        res.status(200).json({ emails: emailList });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error retrieving email addresses.' });
    }
});

// Search for movies using the TMDB API
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

        url.searchParams.set('api_key', process.env.TMDB_API_KEY);

const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`TMDB returned ${response.status}`);
        }

        const data = await response.json();

        res.json({
            results: data.results.map(movie => ({
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
//////////////////////////////////////
//END ROUTES TO HANDLE API REQUESTS
//////////////////////////////////////


//////////////////////////////////////
// ROUTES TO SERVE HTML PAGES
//////////////////////////////////////
app.get('/', (req, res, next) => {
    try { res.render('landing.html'); } catch (error) { next(error); }
});

app.get('/logon', (req, res, next) => {
    try { res.render('logon.html'); } catch (error) { next(error); }
});

app.get('/dashboard', (req, res, next) => {
    try { res.render('dashboard.html', { ...sharedViewData }); } catch (error) { next(error); }
});

app.get('/settings', (req, res, next) => {
    try { res.render('settings.html', { ...sharedViewData }); } catch (error) { next(error); }
});

app.get('/searchpage', (req, res, next) => {
    try { res.render('searchpage.html', { ...sharedViewData }); } catch (error) { next(error); }
});

app.get('/social', (req, res, next) => {
    try { res.render('social.html', { ...sharedViewData }); } catch (error) { next(error); }
});

app.get('/theatres', (req, res, next) => {
    try { res.render('theatres.html', { ...sharedViewData }); } catch (error) { next(error); }
});

app.get('/dashboard', async (req, res, next) => {
    try {
        res.render('dashboard.html', {
            ...sharedViewData
        });
    } catch (error) {
        next(error);
    }
});

// 404 and error handlers must stay after every HTML and API route.
app.use((req, res) => res.status(404).send('Page not found'));
app.use((error, req, res, next) => {
    console.error(error);
    res.status(500).send('Internal server error');
});

if (require.main === module) {
    app.listen(PORT, () => console.log(`MovieBox running at http://localhost:${PORT}`));
}

module.exports = app;
