/*
* Server related task
*
*/



//Dependencies
var http = require('http');
var https = require('https');
var url = require('url');
var StringDecoder = require('string_decoder').StringDecoder;
var config = require('./config');
var fs = require('fs');
var handlers = require('./handlers');
var helpers = require('./helpers');
var path = require('path');


// Instantiate server module object
var server = {};



// Instantiating the HTTP server
server.httpServer = http.createServer(function(req, res){
    server.unifiedServer(req, res);
});

// Instantiating the HTTPS server
server.httpsServerOptions = {
    'key' : fs.readFileSync(path.join(__dirname, '/../https/key.pem')),
    'cert' : fs.readFileSync(path.join(__dirname,'/../https/cert.pem'))
};

server.httpsServer = https.createServer(server.httpsServerOptions, function(req, res){
    server.unifiedServer(req, res);
});


// All the server logic for both the http and https server
server.unifiedServer = function(req, res) {
    //Get the URL and parse it
    var parsedUrl = url.parse(req.url,true);

    //Get the path
    var path = parsedUrl.pathname;
    var trimmedPath = path.replace(/^\/+|\/+$/g, '');

    //Get the query string as an object
    var queryStringObject = parsedUrl.query;

    //Get the HTTP method
    var method = req.method.toLowerCase();

    //Get the request Headers as ab object
    var headers = req.headers;

    //Get the payload, if any
    var decoder = new StringDecoder('utf-8');
    var buffer = '';
    req.on('data', function (data) {
        buffer += decoder.write(data);
    });

    req.on('end', function() {
        buffer += decoder.end();


        //Choose the handler this request should go to. If one is not found route to not found handler
        var chosenHandler = typeof(server.router[trimmedPath]) !== 'undefined' ? server.router[trimmedPath]: handlers.notFound;

        //construct the data object to send to handler
        var data = {
            'trimmedPath': trimmedPath,
            'queryStringObject': queryStringObject,
            'method': method,
            'headers': headers,
            'payload': helpers.parseJsonToObject(buffer)
        };
        // route the request to the handler specified in the router
        chosenHandler(data, function(statusCode, payload){
            //Use the status code called back by the handler, or default to 200
            statusCode = typeof(statusCode) == 'number'? statusCode : 200;

            //Use the payload called back by the handler, or default to an empty object
            payload = typeof(payload) == 'object'? payload : {};

            //Convert the payload to a string
            var payloadString = JSON.stringify(payload);

            //return the response
            res.setHeader('Content-Type', 'application/json');
            res.writeHead(statusCode);
            res.end(payloadString);

            //log the response
            console.log('returning this response: ', statusCode, payloadString);
        });

        //Log the buffer
        console.log('requested with payload ', buffer);
    });
};


//Define a request router
server.router = {
    'ping' : handlers.ping,
    'users': handlers.users,
    'tokens': handlers.tokens,
    'checks': handlers.checks
};


// Init script
server.init = function() {
    //Start the httpServer
    server.httpServer.listen(config.httpPort, function(){
        console.log("The server is listening on port "+config.httpPort);
    });

    // Start the HTTPS server
    server.httpsServer.listen(config.httpsPort, function(){
        console.log("The server is listening on port "+config.httpsPort);
    });
};


// Export the module
module.exports = server;


