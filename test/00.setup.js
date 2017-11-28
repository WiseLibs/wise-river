'use strict';
require('chai').use(require('chai-as-promised'));
process.on('unhandledRejection', (err) => { throw err; });
