#Oahu Client

This is a Oahu Client for Node.js  
It uses a few modules to ensure smooth functionality.

* Redis for client-side caching
* Underscore.js for syntactic sugar
* yaml for configuration file parsing

##Installation
    npm install oahu

##Usage

    var Oahu = require("oahu");
    Oahu.parseConfig('./example/config.yml').setConfig('debug',true);

    Oahu.listMovies(null,function(response){
      console.log("ListMovies", response);
    })

    Oahu.getMovie('movie_id_or_slug',function(response){
      console.log("GetMovie", response);
    })

    Oahu.getPublicationsFor('movie_id_or_slug',function(response){
      console.log("Get Publications For movie",response)
    }, true);

##Example config.yml

    ---
		  oahu_host:        'api.oahu.fr'
		  connect_host:     'connect.oahu.fr'
		  client_id:        'CLIENT_ID_HERE'
		  pub_account_id:   'DEFAULT_PUB_ACCOUNT_ID'
		  consumer_id:      'YOUR_CONSUMER_ID_HERE'
		  consumer_secret:  'YOUR_CLIENT_SECRET_HERE'
		  no_cache:         false
		  expires_in:       3800
		  debug:            false


		