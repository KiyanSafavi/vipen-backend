const express = require('express');
const db = require('./db');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

const auth = require('./auth');
const channel = require('./channel');

app.use('/api/auth', auth);
app.use('/api/channel', channel);

app.get('/', (req, res) => {
  res.json({ message: 'Vipen API is running' });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});