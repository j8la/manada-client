/*
Name    : host-discovery-clt.js
Author  : Julien Blanc
Version : 1.0.5
Date    : 17/06/2016
NodeJS  : 6.1.0+ 
*/

/*
The MIT License (MIT) 
Copyright (c) 2016 by Julien Blanc

Permission is hereby granted, free of charge, to any person obtaining a 
copy of this software and associated documentation files (the "Software"), 
to deal in the Software without restriction, including without limitation 
the rights to use, copy, modify, merge, publish, distribute, sublicense, 
and/or sell copies of the Software, and to permit persons to whom the 
Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included 
in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS 
OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL 
THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING 
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS 
IN THE SOFTWARE.

*/

//----------------------------------------- LOAD MODULES
var dgram       = require('dgram');
var eventTimer  = require('event-timer');
var event       = require('events').EventEmitter;
var util        = require('util');
var os          = require("os");


//----------------------------------------- GLOBALS
const timer = new eventTimer({
    interval: 5000,
    events:['tick']
});

var hosts       = [];
var port        = null;
var protocol    = null;
var service     = null;


//----------------------------------------- FUNCTIONS
function init(self) {
    
    //------ Default multicast address is IPv4
    var multicastAddr = '224.0.0.1';
    
    
    //------ Creates socket
    self.socket = dgram.createSocket({
        type: protocol,
        reuseAddr: true
    });
    
    
    //------ If IPv6, send to IPv6 multicast address
    if(self.socket.type == 'udp6') {
        multicastAddr = 'ff02::1';
    }
    
    
    //------ Listening
    self.socket.on('listening', () => {
        self.socket.addMembership(multicastAddr); // Add second parameter for using specific interface
    }); 
    
    
    //------ Receives packet
    self.socket.on('message', (message, rinfo) => {
        
        try {       
            
            var msg = JSON.parse(message);
            var isNew = true;
        
            if(msg.service == service) {
                
                // If the host is sending a message for the first time, an event 
                // occurs with his address
                if(hosts.hasOwnProperty(rinfo.address)) {
                    isNew = false;   
                }
                
                // Creates or overrides the host item  
                hosts[rinfo.address] = {
                    address: rinfo.address,
                    hostname: msg.host,
                    timestamp: Date.now()
                }
                
                if(isNew == true) { self.emit('join', rinfo.address); }

            }
            
        } catch(e) {}
       
    });
    
    
    //------ Timer which sends a packet to multicast address
    timer.on('tick', () => {
        
        /*const notify = new Buffer([
            '{',
            '"service":"' + service + '",',
            '"host":"' + os.hostname() + '"',
            '}'
        ].join('\r\n'));

        self.socket.send(notify, 0, notify.length, port, multicastAddr);*/
        
        // If the difference between the current time and the arrival packet time 
        // is greater than two times the timer interval, the member is removed 
        // from list
        for(host in hosts) {

            if((Date.now() - hosts[host].timestamp) > (timer.interval*2)) {
                delete hosts[host];
                self.emit('leave', host);
            }
            
        }
        
    });
    
}


//----------------------------------------- CLASS

//------ Constructor
function hd(options) {
    
    if(options == null) { options = {}; }
        
    protocol    = options.protocol  || 'udp4';
    service     = options.service   || 'all';
    port        = options.port      || 2900;
    
    if(service.length > 25 ) {
        throw('\'service\' is limited to a size of 25 bytes.');
    }
    
    if(protocol != 'udp4' && protocol != 'udp6') {
        throw('\'protocol\' must be \'udp4\' or \'udp6\'.');
    }
    
}


//------ Inherit from 'events' module
util.inherits(hd, event);


//------ Starts listening and sending packets to multicast address 
hd.prototype.start = function() {
    
    init(this);
    
    this.socket.bind({
        port: port,
        exclusive: true
    });

    timer.start();
    
}


//------ Stops listening and sending packets 
hd.prototype.stop = function() {
    
    this.socket.close();
    timer.stop();
    timer.removeAllListeners('tick');
    hosts = [];
    
}


//------ Returns active members
hd.prototype.hosts = function() {
    
    return hosts;
    
}


//----------------------------------------- EXPORT MODULE
module.exports = hd;