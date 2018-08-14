/*
*
* Helpers for various task
*
*/

// Dependencies
var crypto = require('crypto');
var config = require('./config');

// container for helpers
var helpers = {};

// Create a SHA256 hash
helpers.hash = function(str) {
  if(typeof (str) == 'string' && str.length > 0) {
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







// export the module
module.exports = helpers;



