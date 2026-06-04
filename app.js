const path = require('path');

process.chdir(path.join(__dirname, 'backend'));
const { startServer } = require('./backend/src/index');

startServer();
