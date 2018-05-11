var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var request = require('request');
var app = express();
var uuidv4 = require('uuid/v4');
var lit = require('./lit');
const { StringDecoder } = require('string_decoder');
const decoder = new StringDecoder('ascii');

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

var pendingPayments = [];

app.get('/payment', function(req,res,next) {
  var id = uuidv4().substr(0,32);
  var amountUSD = parseFloat(req.query.amount);
  var amountCryptos = [];
  currencies.forEach((cur) => {
    amountCryptos.push({
      symbol: cur.symbol,
      amount: amountUSD*cur.rate
    });
  });
  var payment = { id: id, amountUSD : amountUSD, amountCryptos : amountCryptos }
  pendingPayments.push(payment)
  io.emit('newPayment',payment);
  res.sendStatus(201);
});

var currencies = [];

app.get('/currencies', function(req, res, next) {
  res.json(currencies);
});

var updateCurrencies = function() { 
  request.get('https://min-api.cryptocompare.com/data/price?fsym=USD&tsyms=BTC,VTC,LTC', {json:true}, function(err, response, body) {
    if(err)return;
    var newCurrencies = [];
    for (var property in body) {
      if (body.hasOwnProperty(property)) {
          newCurrencies.push({
            symbol: property,
            rate: body[property]
          });
      }
    }
    currencies = newCurrencies;
  });
}

setInterval(updateCurrencies, 10000);
updateCurrencies();
var litConn = null;
lit.connect((err, ws) => {
  if(ws) {
    litConn = ws;
    setInterval(fetchPayments, 1000);
  }
});

var channelAmounts = {};

var fetchPayments = function() {
  lit.stateDump(litConn, (err, result) => {
    if(result.error) {
      console.error(result.error);
    } else {
      result.result.Txs.forEach((tx) => {
        var amount = tx.Amt;
        var channelId = Buffer.from(tx.Pkh).toString("hex");
        var txId = Buffer.from(tx.Txid).toString("hex");
        var data = decoder.write(Buffer.from(tx.Data));
        if(channelAmounts[channelId]) {
          if(channelAmounts[channelId] < amount) {
            var addedAmount = amount - channelAmounts[channelId];
            processPayment(channelId, data, txId, addedAmount);
            channelAmounts[channelId] = amount;
          }
        } else {
          processPayment(channelId, data, txId, amount);
          channelAmounts[channelId] = amount;
        }
        
        
      });
    }
  });
}

var processPayment = function(channelId, data, txId, amount) {
  console.log("Found payment of [", amount , "] in channel [" , channelId , "] with data [" , data , "] and TX ID [", txId , "]");
  pendingPayments.forEach((payment) => {
    if(payment.id == data) {
      io.emit('paymentComplete',{ id: payment.id });
    }
  });
}


// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.json(err);
});


var debug = require('debug')('lightpay-server:server');
var http = require('http');

/**
 * Get port from environment and store in Express.
 */

var port = normalizePort(process.env.PORT || '3000');
app.set('port', port);

/**
 * Create HTTP server.
 */

var server = http.createServer(app);

/**
 * Create websocket
 */


var io = require('socket.io')(server);

io.on('connection', function (socket) {
  
});


/**
 * Listen on provided port, on all network interfaces.
 */

server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
  var port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  var bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
  var addr = server.address();
  var bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port;
  debug('Listening on ' + bind);
}



module.exports = app;
