/*
* Workers related task
*
*/


//Dependencies
var path = require('path');
var fs = require('fs');
var _data = require('./data');
var https = require('https');
var http = require('http');
var helpers = require('./helpers');
var url = require('url');
var _logs = require('./logs');


// Instantiate the worker object
var workers = {};


// Lookup all checks, get their data, send to a validator
workers.gatherAllChecks = function() {
  // Get all the checks
  _data.list('checks', function(err, checks){
     if(!err && checks && checks.length > 0) {
         checks.forEach(function(check){
            // read in the check data
            _data.read('checks', check, function(err, originalCheckData) {
               if(!err && originalCheckData) {
                   // Pass the data to the check validator and let that function continue or log errors as needed
                   workers.validateCheckData(originalCheckData);
               } else {
                   console.log('Error reading one of the check data');
               }
            });
         });
     } else {
         console.log('Error: Could not find any checks to process');
     }
  });
};


// Saity checking the check data
workers.validateCheckData = function(originalCheckData) {
    originalCheckData = typeof (originalCheckData) == 'object' && originalCheckData != null ? originalCheckData : false;
    originalCheckData.id = typeof (originalCheckData.id) == 'string' ? originalCheckData.id : false;
    originalCheckData.userPhone = typeof (originalCheckData.userPhone) == 'string' ? originalCheckData.userPhone : false;
    originalCheckData.protocol = typeof (originalCheckData.protocol) == 'string'  && ['http', 'https'].indexOf(originalCheckData.protocol) > -1 ? originalCheckData.protocol : false;
    originalCheckData.url = typeof (originalCheckData.url) == 'string' && originalCheckData.url.length > 0 ? originalCheckData.url : false;
    originalCheckData.method = typeof (originalCheckData.method) == 'string' && ['post', 'get', 'put', 'delete'].indexOf(originalCheckData.method) > -1 ? originalCheckData.method : false;
    originalCheckData.statusCodes = typeof (originalCheckData.statusCodes) == 'object' && originalCheckData.statusCodes instanceof Array && originalCheckData.statusCodes.length > 0 ? originalCheckData.statusCodes : false;
    originalCheckData.timeoutSeconds = typeof(originalCheckData.timeoutSeconds) == 'number' && originalCheckData.timeoutSeconds%1 == 0 && originalCheckData.timeoutSeconds >=1 && originalCheckData.timeoutSeconds <=5 ? originalCheckData.timeoutSeconds : false;

    // set the keys that may not be set(if the workers have never seen this check before)
    originalCheckData.state = typeof (originalCheckData.state) == 'string' && ['up', 'down'].indexOf(originalCheckData.state) > -1? originalCheckData.state : 'down';
    originalCheckData.lastChecked = typeof (originalCheckData.lastChecked) == 'number' ? originalCheckData.lastChecked : false;

    //If all the checks passed, pass the data along to the next step in the process
    if(originalCheckData.id &&
    originalCheckData.userPhone &&
    originalCheckData.protocol &&
    originalCheckData.url &&
    originalCheckData.method &&
    originalCheckData.successCodes &&
    originalCheckData.timeoutSeconds) {
        workers.performCheck(originalCheckData);
    } else {
        console.log('Error: One of the check is not properly formatted. Skipping it.')
    }
};

// Perform the check, send the originalCheckData and the outcome of the check process, to the next step in the process
workers.performCheck = function(originalCheckData) {
  // perpare the initial check outcome
  var checkOutcome = {
      'error': false,
      'responseCode': false
  };

  // Mark that the outcome has not been sent yet
    var outcomeSent = false;

   // parse the hostname and the path out of the original check data
   var parsedUrl = url.parse(originalCheckData.protoco+'://'+originalCheckData.url, true);
   var hostname = parsedUrl.hostname;
   var path = parsedUrl.path; //using path not "pathname" because we want the querystring

    // construct the request
    var requestDetails = {
      'protocol': originalCheckData.protocol+':',
      'hostname': hostname,
      'method': originalCheckData.method.toUpperCase(),
      'path': path,
      'timeout': originalCheckData.timeoutSeconds*1000
    };

    // Instantiate the request object (using either the http or https module)
    var _moduleToUse = originalCheckData.protocol == 'http' ? http : https;
    var req = _moduleToUse.request(requestDetails, function(res){
       // Grab the status of the sent request
       var status = res.statusCode;

       // update the checkOutcome and pass the data along
        checkOutcome.responseCode = status;
        if(!outcomeSent){
            workers.processCheckOutcome(originalCheckData, checkOutcome);
            outcomeSent = true;
        }
    });

    // Bind to the error so that it doesnt getthrown
    req.on('error', function(e){
       // Update the checkOutcome and pass the data along
       checkOutcome.error = {
           'error': true,
           'value': e
       } ;
       if(!outcomeSent) {
           workers.processCheckOutcome(originalCheckData, checkOutcome);
           outcomeSent = true;
       }
    });


    // Bind to the timeout event
    req.on('timeout', function(e){
        // Update the checkOutcome and pass the data along
        checkOutcome.error = {
            'error': true,
            'value': 'timeout'
        } ;
        if(!outcomeSent) {
            workers.processCheckOutcome(originalCheckData, checkOutcome);
            outcomeSent = true;
        }
    });

    // end the request
    req.end();
};


// process the checkoutcome and update the checkdata as needed and trigger the alert if needed
// special logic to accomodate for a check that has never been tested before(don't want to alert)

workers.processCheckOutcome = function(originalCheckData, checkOutcome) {
  // Decide if the check is considered up or down
  var state = !checkOutcome.err && checkOutcome.responseCode && originalCheckData.successCodes.indexOf(checkOutcome.responseCode) > -1?'up': 'down';

  // Decide if an alert is warranted
    var alertWarranted = originalCheckData.lastChecked && originalCheckData.state != state ? true : false;

    // log the outcome of the check
    var timeOfCheck = Date.now();
    workers.log(originalCheckData, checkOutcome, state, alertWarranted, timeOfCheck);


    // update the check Data
    var newCheckdata = originalCheckData;
    newCheckdata.state = state;
    newCheckdata.lastChecked = timeOfCheck;


    // save the data
    _data.update('checks', newCheckdata.id, newCheckdata, function (err) {
       if(!err){
           // Send the new check data to the next phase in the process
           if(alertWarranted){
               workers.alertUserToStatusChange(newCheckdata);
           } else {
               console.log('Check outcome has not changed, no alert warranted');
           }
       } else {
           console.log("Error trying to save update to one of the check");
       }
    });
};

// Alert the user as to a change in their check status
workers.alertUserToStatusChange = function(newCheckData) {
  var msg = 'Alert: Your check for '+newCheckData.method.toUpperCase()+' '+newCheckData.protocol+'://'+newCheckData.url+' is currently '+newCheckData.state;
  helpers.sendTwilioSms(newCheckData.userPhone,msg,function(err){
     if(!err){
         console.log('Success: User was alerted to a status change in their check, via sms: ', msg);
     } else{
         console.log('Error: could not alert who had a state change in their check');
     }
  });
};

workers.log = function(originalCheckData, checkOutcome, state, alertWarranted, timeOfCheck) {
    // form the log object
    var logData = {
        'check': originalCheckData,
        'outcome': checkOutcome,
        'state': state,
        'alert': alertWarranted,
        'time': timeOfCheck
    };

    // convert data to a string
    var logString = JSON.stringify(logData);

    // Determine the name of the log file
    var logFileName = originalCheckData.id;

    // append the log string to the file
    _logs.append(logFileName, logString, function(err){
        if(!err) {
            console.log("Logging to file succeeded");
        } else {
            console.log("Logging to file failed");
        }
    });
};


// Timer to execute the worker-process once per minute
workers.loop = function() {
    setInterval(function(){
        workers.gatherAllChecks();
    }, 1000*60);
};

// Rotate(compress) the log files
workers.rotateLogs = function (){
    // List all the (non compressed files
    _logs.list(false,function(err, logs){
       if(!err && logs && logs.length > 0){
           logs.forEach(function(logName){
              // Compress the data to a differentFile
              var logId = logName.replace('.log','');
              var newFileId = logId+'-'+Date.now();
              _logs.compress(logId, newFileId, function(err){
                 if(!err){
                     // Truncate the log
                     _logs.truncate(logId, function(err){
                        if(!err){
                            console.log("Success truncating logFile");
                        } else {
                            console.log("Error truncating logFile");
                        }
                     });
                 } else{
                     console.log("Error compressing one of the log files", err);
                 }
              });
           });
       } else {
           console.log("Error: Could not find any logs to rotate");
       }
    });
};

// Timer to execute log rotation process once per day
workers.logRotationLoop = function() {
    setInterval(function(){
        workers.rotateLogs();
    }, 1000*60*60*24);
};


// Init script
workers.init = function() {
  // execute all the checks immediately
    workers.gatherAllChecks();


  // call the loop so the checks will execute later on
  workers.loop();

  // Compress all the logs immediately
    workers.rotateLogs();

    // Call the compression loop so logs will be compressec later on
    workers.logRotationLoop();
};

// Export the module
module.exports = workers;