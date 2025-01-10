// Importeren van de express module in node_modules
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const session = require('express-session');
require('dotenv').config();
const Database = require('./classes/database.js');
const path = require('path');

// Aanmaken van een express app
const app = express();

// Enable CORS
app.use(
  cors({
    origin: 'http://localhost:8080', // Allow requests from this origin
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // Allowed HTTP methods
    allowedHeaders: ['Content-Type', 'Authorization'], // Allowed headers
    credentials: true, // Zorg ervoor dat sessiecookies worden doorgestuurd
  })
);

// Middleware om JSON-requests te parsen
app.use(bodyParser.json());

// Middleware voor sessiebeheer
app.use(
  session({
    secret: 'your_secret_key', // Vervang door een veilige sleutel
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // Gebruik `true` voor HTTPS
  })
);

// Database instantie
const db = new Database();

// Statische bestanden configureren
app.use('/images', express.static(path.join(__dirname, 'images')));

// Endpoint: Registreren
app.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ message: 'Gebruikersnaam, e-mailadres en wachtwoord zijn verplicht.' });
  }

  try {
    const existingUser = await db.getQuery('SELECT * FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existingUser.length > 0) {
      return res.status(400).json({ message: 'Gebruikersnaam of e-mailadres bestaat al.' });
    }

    const isOwner = false;
    await db.getQuery(
      'INSERT INTO users (username, email, password, isOwner, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
      [username, email, password, isOwner, new Date(), new Date()]
    );

    res.status(201).json({ message: 'Gebruiker succesvol geregistreerd.' });
  } catch (error) {
    console.error('Fout bij registratie:', error);
    res.status(500).json({ message: 'Er is iets misgegaan bij het registreren.' });
  }
});

// Endpoint: Inloggen
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Gebruikersnaam en wachtwoord zijn verplicht.' });
  }

  try {
    const users = await db.getQuery('SELECT * FROM users WHERE username = ?', [username]);
    if (users.length === 0) {
      return res.status(400).json({ message: 'Gebruikersnaam of wachtwoord is onjuist.' });
    }

    const user = users[0];

    if (user.password !== password) {
      return res.status(400).json({ message: 'Gebruikersnaam of wachtwoord is onjuist.' });
    }

    // Sla userId op in de sessie
    req.session.userId = user.id;

    res.json({ message: 'Inloggen succesvol.', userId: user.id });
  } catch (error) {
    console.error('Fout bij inloggen:', error);
    res.status(500).json({ message: 'Er is iets misgegaan bij het inloggen.' });
  }
});

// Endpoint: Camping spots ophalen
app.get('/camping-spots', async (req, res) => {
  try {
    const campingSpots = await db.getQuery('SELECT * FROM camping_spots');
    res.json(campingSpots);
  } catch (error) {
    console.error('Fout bij het ophalen van camping spots:', error);
    res.status(500).json({ message: 'Er is iets misgegaan bij het ophalen van camping spots.' });
  }
});

// Endpoint: Boeking maken
app.post('/book', async (req, res) => {
  const { campingSpotId, startDate, endDate, userId, totalPrice } = req.body;

  if (!campingSpotId || !startDate || !endDate || !userId || !totalPrice) {
    return res.status(400).json({ message: 'Vul alle verplichte velden in.' });
  }

  try {
    await db.getQuery(
      `INSERT INTO bookings (campingSpotId, startDate, endDate, totalPrice, createdAt, updatedAt, userId)
       VALUES (?, ?, ?, ?, NOW(), NOW(), ?)`,
      [campingSpotId, startDate, endDate, totalPrice, userId]
    );

    res.status(200).json({ message: 'Boeking succesvol opgeslagen.' });
  } catch (error) {
    console.error('Fout bij boeken:', error);
    res.status(500).json({ message: 'Serverfout bij het boeken.' });
  }
});

// Endpoint: Boeking ophalen voor specifieke gebruiker
app.get('/bookings', async (req, res) => {
  const userId = req.session.userId; // Haal userId op uit de sessie

  if (!userId) {
    return res.status(400).json({ message: 'Gebruiker is niet ingelogd.' });
  }

  try {
    const bookings = await db.getQuery('SELECT * FROM bookings WHERE userId = ?', [userId]);
    res.json(bookings);
  } catch (error) {
    console.error('Fout bij het ophalen van boekingen:', error);
    res.status(500).json({ message: 'Fout bij het ophalen van boekingen.' });
  }
});

// Endpoint: Profiel updaten
app.post('/update-profile', async (req, res) => {
  const { username, password } = req.body;
  const userId = req.session.userId; // Haal userId op uit de sessie

  if (!userId) {
    return res.status(400).json({ message: 'Gebruiker is niet ingelogd.' });
  }

  if (!username && !password) {
    return res.status(400).json({ message: 'Gebruikersnaam of wachtwoord is vereist.' });
  }

  try {
    let query = 'UPDATE users SET ';
    const updates = [];

    if (username) {
      updates.push('username = ?');
    }
    if (password) {
      updates.push('password = ?');
    }

    query += updates.join(', ') + ' WHERE id = ?';

    const params = [...(username ? [username] : []), ...(password ? [password] : []), userId];
    await db.getQuery(query, params);

    res.status(200).json({ message: 'Profiel succesvol bijgewerkt.' });
  } catch (error) {
    console.error('Fout bij het bijwerken van profiel:', error);
    res.status(500).json({ message: 'Er is een fout opgetreden bij het bijwerken.' });
  }
});

// Endpoint: Uitloggen
app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: 'Fout bij het uitloggen.' });
    }

    res.status(200).json({ message: 'Succesvol uitgelogd.' });
  });
});

// Starten van de server
app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
