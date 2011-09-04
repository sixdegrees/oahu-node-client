#Oahu Client

This is a Oahu Client for Node.js  
It uses a few modules to ensure smooth functionality.

* Redis for client-side caching
* Underscore.js for syntactic sugar
* yaml for configuration file parsing

##Installation
    npm install oahu

##Usage
    var oahu = require('oahu');
    oahu.parseConfig('./config/config.yml').setConfig('debug',true).getConfig();
    oahu.listMovies(function(movies){
      //movies
    });