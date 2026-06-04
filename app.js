const path = require('path');

process.chdir(path.join(__dirname, 'backend'));
require('./backend/src/index');
