// require the Express module
const express = require('express');
const router = require('./routes')

// creates an instance of an Express server
const app = express();

app.use('/', router);

// define the port
const port = 3000;

// run the server
app.listen(port, () => console.log(`Listening on port: ${port}.`));