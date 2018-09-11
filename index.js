/*
 * Primary file for the API
 *
 */

// Dependencies
var server = require('./lib/server');
var workers = require('./lib/workers');

// Declare the app
var app = {};


// Init function
app.init = function() {
    //Start the server
    server.init();

    //Start the workers
    workers.init();

};


// execute the function
app.init();


// export the function
module.exports = app;