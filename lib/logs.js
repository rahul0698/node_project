/*
* library for storing and rotating logs
*
*/


// Dependencies

var fs = require('fs');
var path = require('path');
var zlib = require('zlib');

// Container for the module
var lib = {};


// Base directory for the logs folder
lib.baseDir = path.join(__dirname, '/../.logs/');



// Append a string to file, create a file if does not exist
lib.append = function(file, str, callback) {
  // open the file for appending
  fs.open(lib.baseDir+file+'.log', 'a', function(err, fileDescriptor){
      if(!err && fileDescriptor){
          // Append to the file and close it
          fs.appendFile(fileDescriptor, str+'\n', function(err){
             if(!err) {
                 fs.close(fileDescriptor, function(err){
                    if(!err){
                        callback(false);
                    } else {
                        callback("Error closing the file");
                    }
                 });
             } else {
                 callback("Error appending the file");
             }
          });
      } else {
          callback("Could not open file for appending");
      }
  })
};

// List all the logs, optionally include the compressed logs
lib.list = function(includeCompressedLogs, callback){
  fs.readdir(lib.baseDir, function(err, data){
     if(!err && data && data.length>0){
         var trimmedFileNames = [];
         data.forEach(function(fileName){
            // Add the .log files
            if(fileName.indexOf('.log')>-1){
                trimmedFileNames.push(fileName.replace('.log',''));
            }

            // Add on the .gz files
             if(fileName.indexOf('.gz.b64') > -1 && includeCompressedLogs){
                trimmedFileNames.push(fileName.replace('.gz.b64',''));
             }
         });

         callback(false, trimmedFileNames);
     } else {
         callback(err, data);
     }
  });
};

// Compress the content of one .log file into a .gz.b64 file within the same directory
lib.compress = function(logId, newFileId, callback){
  var sourceFile = logId+'.log';
  var destFile = newFileId+'.gz.b64';

  // read the source file
    fs.readFile(lib.baseDir+sourceFile,'utf8', function(err, inputString){
        if(!err && inputString){
            // Compress the data using gzip
            zlib.gzip(inputString, function(err, buffer){
                if(!err && buffer){
                    // Send the data to destination file
                    fs.open(lib.baseDir+destFile,'wx', function(err, fileDescriptor){
                       if(!err && fileDescriptor){
                           // write to destination file
                           fs.write(fileDescriptor, buffer.toString('base64'), function(err){
                              if(!err){
                                  // close the destination file
                                  fs.close(fileDescriptor, function(err){
                                    if(!err){
                                        callback(false);
                                    } else {
                                        callback(err);
                                    }
                                  });
                              } else {
                                  callback(err);
                              }
                           });
                       } else {
                           callback(err);
                       }
                    });
                } else {
                    callback(err);
                }
            });
        } else {
            callback(err);
        }
    });
};


// Decompress the content of a .gz.b64 file into a string variable
lib.decompress = function(fileId, callback){
  var fileName = fileId+'.gz.b64';
  fs.readFile(lib.baseDir+fileName,'utf8', function(err, str){
     if(!err && str){
         // Decompress the data
         var inputBuffer = Buffer.from(str, 'base64');
         zlib.unzip(inputBuffer, function(err, outputBuffer){
            if(!err && outputBuffer){
                // callback
                var str = outputBuffer.toString();
                callback(false, str);
             } else {
                callback(err);
             }
         });
     } else{
         callback(err);
     }
  });
};


// Truncating a .log file
lib.truncate = function(logId, callback){
  fs.truncate(lib.baseDir+logId+'.log',0,function(err){
     if(!err){
         callback(false);
     } else{
         callback(err);
     }
  });
};





// Export the module
module.exports = lib;