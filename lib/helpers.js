/*
*
* Helpers for various task
*
*/

// Dependencies
var crypto = require('crypto');
var config = require('./config');
var https = require('https');
var querystring = require('querystring');

// container for helpers
var helpers = {};

// Create a SHA256 hash
helpers.hash = function(str) {
  if(typeof(str) == 'string' && str.length > 0) {
      var hash = crypto.createHmac('sha256', config.hashingSecret).update(str).digest('hex');
      return hash;
  }  else {
      return false;
  }
};

// Parse a json string to an object in all cases, without throwing
helpers.parseJsonToObject = function(str) {
    try {
        var obj = JSON.parse(str);
        return obj;
    }catch (e) {
        return {};
    }
}

// Create a string of random alphanumeric character, of a given length
helpers.createRandomString = function(strLength) {
    strlength = typeof (strLength) == 'number' && strLength > 0? strLength : false;
    if(strLength) {
        // Define all the possible characters that could go into a string
        var possibleCharacters = 'abcdefghijklmnopqrstuvwxyz0123456789';

        // Start the final string
        var str = '';
        for(i=1; i<strLength; i++) {
            // Get a random character from the possibleCharacters string
            var randomCharacter = possibleCharacters.charAt(Math.floor(Math.random()*possibleCharacters.length));
            // Appends this character to the final string
            str += randomCharacter;
        }

        // Return the final string
        return str;
    } else {
        return false;
    }
}


// Send an sms message via Twilio
helpers.sendTwilioSms = function(phone, msg, callback){
    // Validating parameters
    phone = typeof(phone) == 'string' ? phone.trim() : false;
    msg = typeof(msg) == 'string' && msg.trim().length > 0 && msg.trim.length <=1600 ? msg.trim() : false;

    if(phone && msg){
        // Config the request payload
        var payload = {
            'From': config.twilio.fromPhone,
            'To': '+91'+phone,
            'Body': msg
        };
        // stringify the payload
        var stringPayload = querystring.stringify(payload);

        // Configure the request details
        var requestDetails = {
            'protocol': 'https:',
            'hostname': 'api.twilio.com',
            'method': 'POST',
            'path': '/2010-04-01/Accounts/'+config.twilio.accountSid+'/Messages.json',
            'auth': config.twilio.accountSid+':'+config.twilio.authToken,
            'headers': {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(stringPayload)
            }
        };

        // instantiate the request object
        var req = https.request(requestDetails, function(res){
            // grab the status of the sent request
            var status = res.statusCode;

            // callback successfully if the request went through
            if(status == 200 || status == 201){
                callback(false);
            } else {
                callback('status code returned was '+status);
            }
        });

        // Bind to the error even, so it doesn't thrown
        req.on('error', function(e){
            callback(e);
        });

        // add the payload
        req.write(stringPayload);

        // end the request
        req.end();
    } else {
        callback('given parameters are missing or invalid.')
    }
}




// export the module
module.exports = helpers;



