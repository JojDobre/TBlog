/**
 * Bytezone — globálna konfigurácia
 *
 * Toto je jediný súbor, kde sa miesia premenné z .env (citlivé) s
 * verejnými/odvoditeľnými hodnotami. Všetko ostatné v aplikácii sa pýta
 * tu, nie cez process.env.
 *
 * Citlivé veci (DB heslo, session secret) idú cez .env.
 * Konfiguračné defaulty (počty per page, limity) sú tu hardcoded — ak ich
 * admin neskôr bude meniť cez UI, prekryje ich tabuľka `settings` v DB.
 */

require('dotenv').config();
const path = require('path');

const env = process.env.NODE_ENV || 'development';
const isProd = env === 'production';

const required = (key) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const config = {
  // ---------------------------------------------------------------------------
  // Aplikácia
  // ---------------------------------------------------------------------------
  app: {
    name: 'Bytezone',
    description: 'Tech blog so zameraním na recenzie technológií.',
    env,
    isProd,
    isDev: !isProd,
    port: parseInt(process.env.PORT || '3000', 10),
    baseUrl: process.env.BASE_URL || 'http://localhost:3000',
    trustProxy: process.env.TRUST_PROXY === 'true',
  },

  // ---------------------------------------------------------------------------
  // Databáza (čítaná aj z knexfile.js)
  // ---------------------------------------------------------------------------
  db: {
    client: 'mysql2',
    host: required('DB_HOST'),
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: required('DB_USER'),
    password: required('DB_PASSWORD'),
    database: required('DB_NAME'),
    charset: 'utf8mb4',
    timezone: '+00:00', // všetko v UTC
    ssl: process.env.DB_SSL === 'true',
  },

  // ---------------------------------------------------------------------------
  // Sessions
  // ---------------------------------------------------------------------------
  session: {
    secret: required('SESSION_SECRET'),
    cookieMaxAgeMs: 14 * 24 * 60 * 60 * 1000, // 14 dní
    secure: isProd, // HTTPS-only v produkcii
    sameSite: 'lax',
    httpOnly: true,
    name: 'bytezone.sid',
  },

  // ---------------------------------------------------------------------------
  // Bezpečnosť
  // ---------------------------------------------------------------------------
  security: {
    bcryptCost: 12, // password + security answer hashing
    rateLimit: {
      // login attempts per IP / per identifier
      loginMaxPerWindow: 5,
      loginWindowMs: 15 * 60 * 1000, // 15 minút
      // všeobecný rate limit pre API
      apiMaxPerWindow: 100,
      apiWindowMs: 60 * 1000, // 1 minúta
    },
  },

  // ---------------------------------------------------------------------------
  // Uploads
  // ---------------------------------------------------------------------------
  uploads: {
    rootDir: path.resolve(__dirname, 'uploads'),
    publicPath: '/uploads', // ako sa servuje cez Express static
    image: {
      maxSizeBytes: 50 * 1024 * 1024, // 50 MB
      allowedMimes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
      thumbnailWidth: 400,
      mediumWidth: 1200,
    },
    video: {
      maxSizeBytes: 500 * 1024 * 1024, // 500 MB (revidovať podľa hostingu)
      allowedMimes: ['video/mp4', 'video/webm', 'video/quicktime'],
    },
  },

  // ---------------------------------------------------------------------------
  // Pagination & default counts (tieto môže prepísať tabuľka `settings`)
  // ---------------------------------------------------------------------------
  defaults: {
    articlesPerPage: 12,
    commentsPerPage: 20,
    autoRelatedCount: 4,
    revisionsKept: 5,
    trashRetentionDays: 30,
    rawStatsRetentionDays: 90,
  },

  // ---------------------------------------------------------------------------
  // Cesty (vypočítané)
  // ---------------------------------------------------------------------------
  paths: {
    root: __dirname,
    backend: path.resolve(__dirname, 'backend'),
    backendSrc: path.resolve(__dirname, 'backend', 'src'),
    migrations: path.resolve(__dirname, 'backend', 'migrations'),
    seeds: path.resolve(__dirname, 'backend', 'seeds'),
    frontendViews: path.resolve(__dirname, 'frontend', 'views'),
    frontendPublic: path.resolve(__dirname, 'frontend', 'public'),
    adminViews: path.resolve(__dirname, 'backend', 'src', 'views'),
    adminPublic: path.resolve(__dirname, 'backend', 'src', 'public'),
    uploads: path.resolve(__dirname, 'uploads'),
  },
};

module.exports = config;
