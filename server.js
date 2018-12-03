'use strict';

var express = require('express');
var mongo = require('mongodb');
var mongoose = require('mongoose');
var bodyParser = require('body-parser');
var dns = require('dns');

var cors = require('cors');

var app = express();

// Basic Configuration 
var port = process.env.PORT || 3000;

/** this project needs a db !! **/ 
mongoose.connect(process.env.MONGODB_URL, { useNewUrlParser: true });
// Create a "auto increment" counter
let counterSchema = new mongoose.Schema({
  seq: {type: Number, default: 1}
});
let counter = mongoose.model('counter', counterSchema);

// Define the url schema
let shortnerSchema = new mongoose.Schema({
  idx: {type: Number, required: true},
  url: {type: String, required: true}
});
let Shortner = mongoose.model('UrlShortner', shortnerSchema);

function getNextId(callback){
  counter.findOneAndUpdate({}, {$inc:{'seq': 1}}, {new: true, upsert: true}, (err, data) => {
    if(err) return;
    if (data) callback(data.seq);
  });
}

let protocolRegExp = /^https?:\/\/(.*)/i;
let hostnameRegExp = /^([a-z0-9\-_]+\.)+[a-z0-9\-_]+/i;

app.use(cors());

/** this project needs to parse POST bodies **/
// you should mount the body-parser here
app.use(bodyParser.urlencoded({ extended: false }));

app.use('/public', express.static(process.cwd() + '/public'));

app.get('/', function(req, res){
  res.sendFile(process.cwd() + '/views/index.html');
});

app.get('/api/shorturl/:id', (req, res) => {
  let urlIdx = req.params.id;
  if(!parseInt(urlIdx, 10)) {
    return res.json({error: 'Invalid format'});
  }
  Shortner.findOne({idx: urlIdx}, (err, entry) => {
    if(err) {
      return res.json({error: 'Invalid short url'});
    }
    if(entry) {
      res.redirect(entry.url);
    } else {
      res.json({error: 'Short url not found'});
    }
  });
});

app.post('/api/shorturl/new', (req, res) => {
  let url = req.body.url;
  if(url.match(/\/$/i)) { //handle the trailing slash
    url = url.slice(0,-1);
  }
  let protocolMatch = url.match(protocolRegExp);
  if (!protocolMatch) {
    return res.json({error: 'Invalid Url'});
  }
  let hostAndQuery = protocolMatch[1];
  let hostnameMatch = hostAndQuery.match(hostnameRegExp);
  
  if(!hostnameMatch) {
    return res.json({error: 'Invalid Url'});
  }
  
  dns.lookup(hostnameMatch[0], err => {
    if(err) {
      return res.json({error: 'invalid hostname'});
    }
  });
  
  Shortner.where({url: url}).findOne((err, entry) => {
    if(err) return;
    if(entry) {
      res.json({original_url: url, short_url: entry.idx});
    } else {
      getNextId(seq => {
        let nextEntry = new Shortner({
          idx: seq,
          url: url
        });
        nextEntry.save(e => {
          if(e) return;
          res.json({original_url: url, short_url: seq});
        });
      });
    }
  });
});

app.listen(port, function () {
  console.log('Node.js listening ...');
});
