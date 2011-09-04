
// OahuClient.js - Core - Copyright Oahu <contact@oahu.fr> (MIT Licensed)

/**
 * Version triplet.
 */
exports.version ="0.0.1";

/**
 * Module dependencies.
 */
var fs = require('fs'),
    yaml = require('yaml') ,
    _ = require('underscore')._ ,
    http = require("http") ,
    uri = require("url") , 
    redis_client = require("redis").createClient(),
    querystring = require('querystring');

/**
 * Configuration defaults, overridden by config file.
 */
var config={
  oahu_host:        'api.oahu.fr',
  connect_host:     'connect.oahu.fr',
  client_id:        'CLIENT_ID_HERE',
  pub_account_id:   'DEFAULT_PUB_ACCOUNT_ID',
  consumer_id:      'YOUR_CONSUMER_ID_HERE',
  consumer_secret:  'YOUR_CLIENT_SECRET_HERE',
  debug:            false, 
  no_cache:         false,
  expires_in:    3600
};

/**
 * Data structures.
 */

var modelTypes = {
  'Project':['Movie'],
  'Resource':['Image','Video']
};

var modelFields = {
  'Project':['title','release_date','synopsis','genres'],
  'Resource':['source','name','description']
};

var projectFilters = [null, "soon", "live", "featured", "recommended"];

var utils = {};

utils.resources = {
  cleanup : function(r) {
    delete r.embedded_images;
    delete r.embedded_videos;
    delete r.updated_at;
    delete r.parent_ids;
    delete r.child_ids;
    delete r.children;
    return r;
  },
  getType: function(r) {
    return r._type.replace('Resources::', '').toLowerCase();
  }
};


redis_client.on("error",function(err) {
  console.log("Redis error : " + redis_client.host + ":" + redis_client.port + " - " + err);
});

var _exec = function(request, callback){
  var req = http.request({
    host:config.oahu_host,
    port:80,
    method:request.method,
    path:request.path,
    headers:request.headers
  },function(response){
    if(response.statusCode!=200){
      console.log('Bad Statuscode',response.statusCode);
      return response.statusCode;
    }
    var result = "";
    response.setEncoding('utf8');
    response.on('data',function(chunk){
      result+=chunk;
    });
    response.on('end',function(){
      var parsed_result = JSON.parse(result);
      if(callback){ callback(parsed_result); }
      redis_client.set(request.path,result);
      redis_client.expire(request.path, request.expires_in);
      //REDIS CACHING HERE;
    });
  });

  req.end();

};
var _request = function(request, callback){
  if(!request.path){
    callback(false);
  }
  request.params = request.params || {};
  request.params.consumer_id = config.consumer_id;
  request.params.consumer_secret = config.consumer_secret;
  request.params.format = 'json';
  request.id = request.id || 'data';

  request.headers = request.headers || {};
  request.headers["Content-type"]= "application/json";

  if(config.no_cache){ request.headers["Cache-Control"] = "no-cache"; }

  //Ensure not everything is timing out at the same time…
  request.expires_in = randomized_expiration(request.expires_in || config.expires_in);

  qs = querystring.stringify(request.params);
  request.path = "/v1/clients/" + config.client_id + request.path;

  if(qs){
    request.path = request.path+'?'+qs;
  }

  redis_client.get(request.path, function(err,doc){
    if (doc !== null && !err){
      console.log('Cached Fetch : ',request.path)
      callback(JSON.parse(doc));
    } else {
      console.log('Fetching : ',request.path)
      _exec(request, callback)
    }
  });
};
var _get =  function(request, callback){
  request.method = 'GET';
  if(!request.path){ return false; }
  _request(request, callback);
};
var _post = function(request, callback){
  request.method = 'POST';
  if(!request.path){ return false; }
  _request(request, callback);
};
var _queue = function(requests, callback){
  var responses = [];
  var requestCount = requests.length;
  var finalCallback = callback;
  _.each(requests,function(request){
    _request(request,function(response){
      if(response){
        responses[request.id] = response;
      }
      requestCount--;
      if(requestCount<=0){
        finalCallback(responses);
      }
    });
  });
};
var _batch = function(callback){
  var requests = [];
  var fetch = function(){
    console.log("fetching",requests);
    _queue(requests,callback);
  }
  var add = function(request){
    requests.push(request);
  }
  return {
    fetch:fetch,
    add:add
  }
}

var randomized_expiration = function(base){
  return parseInt(base*0.8 + (parseInt(base/20)*Math.random()));
};

var parseConfig = function(configFile){
  fileContents = fs.readFileSync(configFile).toString();
  config = _.extend(config,yaml.eval(fileContents));
  return this;
};
var getConfig = function(name){
  if(!name){
     return config;
   } else {
     return config[name];
   }
};
var setConfig = function(name,value){
  if(typeof(name)==='string' && value!==undefined){
    if(name in config){
      config[name]=value;
    }
  } else if (typeof(name)==='object') {
    _.each(name,function(value,key){
      if(config[key]){
        config[key]=value;
      }
    });
  }
  return this;
};
var listMovies = function(filter, callback){
  var params = {
    limit:300
  };
  filter = _.include(projectFilters,filter)?filter:null;
  var path = '/projects';
  if(filter){
    path +='/'+filter;
  }
  path +='.json';
  _get({path:path, params:params },callback);
};
var getMovie = function(id,callback){
  _get({path:'/projects/'+id+'.json'},callback)
}
var getPublicationsFor = function(id,callback, deep){
  if(deep){
    var publications = {};
    var finalCallback = callback; 
    var batch = new _batch(function(response){
      _.each(publications,function(publication){
        if(publication.resource._type.indexOf('List')>=0){
          publication.resource = utils.resources.cleanup(response[publication.resource._id]);
        } else {
          publication.resource = utils.resources.cleanup(publication.resource);
        }
      });
      finalCallback(publications);
    });
    var callback = function(response){
      publications = response;
      _.each(publications,function(publication){
        if(publication.resource._type.indexOf('List')>=0){
          batch.add({ id: publication.resource._id, path:'/projects/'+id+'/resources/'+publication.resource._id+'.json'})
        }
      });
      batch.fetch();
    }
  }
  _get({
    path:'/projects/'+id+'/publications.json',
    params:{
      limit:10,
      pub_account_id:config.pub_account_id
    }
  }, callback)
}

exports.parseConfig = parseConfig;
exports.getConfig = getConfig;
exports.setConfig = setConfig;
exports.listMovies = listMovies;
exports.getMovie = getMovie;
exports.getPublicationsFor=getPublicationsFor;
