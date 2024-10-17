const express = require("express");
const serverless = require("serverless-http");
const OAuthClient = require('intuit-oauth');
const fs = require('fs');
const axios = require('axios');

const app = express();
const router = express.Router();

// Check for required environment variables
const requiredEnvVars = ['CLIENT_ID', 'CLIENT_SECRET', 'REDIRECT_URL', 'ENVIRONMENT'];
requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    throw new Error(`Environment variable ${varName} is required.`);
  }
});

// Default company (realm) ID
const defaultRealmId = '9341453270941131';

// OAuth client setup
const oauthClient = new OAuthClient({
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  environment: process.env.ENVIRONMENT,
  redirectUri: process.env.REDIRECT_URL
});

// Load tokens from a file
const loadTokens = () => {
  try {
    const data = fs.readFileSync('tokens.json', 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading tokens:', error);
    return null;
  }
};

// Save tokens to a file
const saveTokens = (tokens) => {
  try {
    fs.writeFileSync('tokens.json', JSON.stringify(tokens));
  } catch (error) {
    console.error('Error saving tokens:', error);
  }
};

// Refresh access token if expired
const refreshAccessToken = async (refreshToken) => {
  try {
    const authResponse = await oauthClient.refreshUsingToken(refreshToken);
    const newAccessToken = authResponse.getJson().access_token;
    const newRefreshToken = authResponse.getJson().refresh_token;

    saveTokens({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      realmId: oauthClient.getToken().realmId || defaultRealmId
    });

    return newAccessToken;
  } catch (error) {
    console.error('Error refreshing access token:', error.response ? error.response.data : error.message);
    if (error.response && error.response.status === 400) {
      throw new Error('Refresh token invalid or expired. Please reauthorize.');
    }
    throw new Error('Unable to refresh access token');
  }
};

// Fetch invoices from QuickBooks
const fetchInvoices = async (accessToken, realmId) => {
  try {
    realmId = realmId || defaultRealmId;

    const response = await axios.get(`https://sandbox-quickbooks.api.intuit.com/v3/company/${realmId}/query?query=select * from Invoice&minorversion=40`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    return response.data.QueryResponse.Invoice || [];
  } catch (error) {
    console.error('Error fetching invoices:', error);
    throw error;
  }
};

// Automatically check and refresh tokens before fetching invoices
const ensureAuthenticated = async (req, res, next) => {
  try {
    let tokens = loadTokens();
    if (!tokens) {
      console.log('No tokens found, initiating OAuth flow...');
      return res.redirect('/auth');
    }

    let { accessToken, refreshToken, realmId } = tokens;

    // Try to fetch invoices with the existing token
    try {
      const invoices = await fetchInvoices(accessToken, realmId);
      req.invoices = invoices;
      next();
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('Access token expired, refreshing...');
        try {
          accessToken = await refreshAccessToken(refreshToken);
          req.invoices = await fetchInvoices(accessToken, realmId);
          next();
        } catch (refreshError) {
          console.error('Refresh token expired or invalid, reinitiating OAuth flow...');
          return res.redirect('/auth');
        }
      } else {
        console.error('Error fetching invoices after authentication check:', error);
        res.status(500).send('Error fetching invoices');
      }
    }
  } catch (error) {
    console.error('Error ensuring authentication:', error);
    res.status(500).send('Error ensuring authentication');
  }
};

// OAuth callback for initial authorization (run this once)
router.get('/callback', async (req, res) => {
  try {
    const authResponse = await oauthClient.createToken(req.url);
    const accessToken = authResponse.getJson().access_token;
    const refreshToken = authResponse.getJson().refresh_token;
    const realmId = oauthClient.getToken().realmId || defaultRealmId;

    saveTokens({
      accessToken,
      refreshToken,
      realmId
    });

    res.send('Authorization successful, tokens saved. You can now access /invoices');
  } catch (error) {
    console.error('Error exchanging code for token:', error.response ? error.response.data : error.message);
    res.status(500).send('Error exchanging code for token');
  }
});

// Endpoint to get invoices
router.get('/invoices', ensureAuthenticated, async (req, res) => {
  try {
    const invoices = req.invoices;
    res.json(invoices);
  } catch (error) {
    console.error('Error handling /invoices request:', error);
    res.status(500).send('Error fetching invoices');
  }
});

// For starting OAuth flow (run once to generate tokens)
router.get('/auth', (req, res) => {
  const state = Math.random().toString(36).substring(2);
  const authUri = oauthClient.authorizeUri({
    scope: [OAuthClient.scopes.Accounting, OAuthClient.scopes.OpenId],
    state: state
  });

  res.redirect(authUri);
});

app.use(`/.netlify/functions/api`, router);

module.exports = app;
module.exports.handler = serverless(app);

