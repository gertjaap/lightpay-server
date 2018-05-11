const WebSocket = require('ws');

var id = 1;

module.exports = {};
module.exports.connect = function(callback) {
    var host = process.env.LIT_HOST || 'lightpay-lit';
    console.log("Connecting to " + host);
    
    var ws = new WebSocket('ws://' + host + ':8001/ws', { origin: 'http://localhost' });
    ws.onopen = (e) => { callback(null, ws); }
    ws.onerror = (e) => { callback(e.data, null); }
};

module.exports.getBalance = function(ws, callback) {
    id++;
    var requestId = id;
    var request = {
        id : requestId,
        method: "LitRPC.Balance",
        params: []
    };
    ws.on('message', (dataString) => {
       var data = JSON.parse(dataString);
       if(data.id == requestId) {
         callback(null, data);
       }
    });
    ws.send(JSON.stringify(request));
}

module.exports.stateDump = function(ws, callback) {
    id++;
    var requestId = id;
    var request = {
        id : requestId,
        method: "LitRPC.StateDump",
        params: []
    };
    ws.on('message', (dataString) => {
       var data = JSON.parse(dataString);
       if(data.id == requestId) {
         callback(null, data);
       }
    });
    ws.send(JSON.stringify(request));
}
