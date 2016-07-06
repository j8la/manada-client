/*
Name    : manadaclt.js
Author  : Julien Blanc
Version : 0.9.0
Date    : 29/06/2016
NodeJS  : 6.2.2
*/

/*
Copyright (c) 2016 Manada Client by Julien Blanc

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/


//----------------------------------------- MODULES

//------ External modules
var expr    = require('express');
var bdyp    = require('body-parser');
var nrcl    = require('node-rest-client').Client;
var baut    = require('basic-auth');
var pug     = require('pug');
var heme    = require('helmet');
var exse    = require('express-session');
var argp    = require('argparse').ArgumentParser;
var asyn    = require('async');


//------ Node modules
var crypt   = require('crypto');
var https   = require('https');
var fs      = require('fs');


//------ PRIV modules
var hstd    = require('./host-discovery-clt.js');


//----------------------------------------- ARGUMENTS
var parser = new argp({
    version: '0.9.0',
    addHelp: true,
    description: 'Manada Client.'
})

parser.addArgument(
    ['-c', '--cluster'],
    { 
        help: 'Cluster ID for multicast discovery.',
        required: true,
        metavar: 'ID'
    }
)

var args = parser.parseArgs();


//------ Express settings
var appl = expr();

appl.use(exse({
    secret:'G2ppKiMton8ooTy',
    resave: false,
    saveUninitialized: false,
    proxy: false,
    cookie: { secure: true },
    unset: 'destroy'
}));
appl.set('views', './views');
appl.set('view engine', 'pug');
appl.use(heme());
appl.use(expr.static('public'));
appl.use(bdyp.json());
appl.use(bdyp.urlencoded({ extended: true }));
appl.locals.pretty = true;
appl.use(function (req, res, next) {
    res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.header('Expires', '-1');
    res.header('Pragma', 'no-cache');
    next()
});


//----------------------------------------- COMMON FUNCTIONS

//----------- Sort JSON by property
var sortByProperty = function (property) {
    return function (x, y) {
        return ((x[property] === y[property]) ? 0 : ((x[property] > y[property]) ? 1 : -1));
    };
};

//----------- Checksum
function getHash(str) {
    return crypt
        .createHash('md5')
        .update(str, 'utf8')
        .digest('hex')
}


//----------------------------------------- HTTPS Server
var wsrv = https.createServer({
    key: fs.readFileSync('key.pem'),
    cert: fs.readFileSync('cert.pem')
}, appl);


//----------------------------------------- Host discovery client
var htds = new hstd({
    service: args.cluster,   
    protocol: 'udp4',                       
    port: 2900                              
});


//----------- Events 
htds.on('join', (addr) => { hostsHaveChanged = true; });
htds.on('leave', (addr) => { hostsHaveChanged = true; });


//----------------------------------------- REST CLIENT MULTI-SESSION
var recl = [];


//----------------------------------------- SERVE HTML

//----------- Application
appl.get('/', function(req, res) {

    if(req.session.user == null && req.session.password == null) {
        res.redirect('/login');
    } else {
        res.render('index', { 
            rub:		'Manada',
            title: 		'Manada Client'
        });
    }

});


//----------- Login prompt
appl.get('/login', function(req,res) {

    if(req.session.user == null && req.session.password == null) {
        res.render('login', {});
    } else {
        res.redirect('/');
    }

});


//----------- Creates session
appl.post('/login', function(req,res) {

    if(req.body.login != "" && req.body.password != "" && req.body.clusterID != "") {
        req.session.user        = req.body.login;
        req.session.password    = req.body.password;

        recl[req.session.id] = {}

        recl[req.session.id].o = {
            user: req.session.user,
            password: req.session.password,
            connection: {
                rejectUnauthorized: false
	        },
            timeout: 1000
        }

        recl[req.session.id].f    = new nrcl(recl[req.session.id].o);
    }
    res.redirect('/');

});


//----------- Logout and destroy session
appl.get('/logout', function(req,res) {
    delete recl[req.session.id]
    req.session.destroy();
    res.redirect('/');
});


//----------- jsTree management
appl.get('/tree/:func', function(req,res) {
    if(req.xhr) {
        var json = htds.hosts();
        var addr = [];

        for(var val in json) {
            addr.push(json[val].address);
        }

        switch(req.params.func) {
            case "refresh" :

                var jsonTree = [];
                var asyncTasks = [];

                jsonTree.push({ id: "root", parent: "#", text: args.cluster, icon: "./img/cluster.png", state: { opened: true }});

                addr.forEach(function(item) {
                    asyncTasks.push(function(callback) {
                        recl[req.session.id].f.get("https://" + item + ":8000/api/v2/status", function(data,res) {
                            if(res.statusCode == 401) {
                                jsonTree.push({ id: "root_" + item, parent: "root", text: item, icon: "./img/host_warn.png"});
                            } else {
                                jsonTree.push({ id: "root_" + item, parent: "root", text: item, icon: "./img/host.png", state: { opened: true } });
                                jsonTree.push({ id: "root_" + item + "_Status", parent: "root_" + item, text: "Status", icon: "./img/status.png"});
                                jsonTree.push({ id: "root_" + item + "_Log", parent: "root_" + item, text: "Log", icon: "./img/log.png"});
                                jsonTree.push({ id: "root_" + item + "_Store", parent: "root_" + item, text: "Store", icon: "./img/store.png"});
                                jsonTree.push({ id: "root_" + item + "_Search", parent: "root_" + item, text: "Search", icon: "./img/search.png"});
                            }
                            callback();
                        }).on('error', function(err) { 
                            jsonTree.push({ id: "root_" + item, parent: "root", text: item, icon: "./img/host_err.png"}); 
                        });
                    });
                });

                asyn.parallel(asyncTasks, function() {
                    res.render('tree', { 
                        tree: jsonTree.sort(sortByProperty('id'))
                    });
                });

                break;

            case "size":

                res.render('tree', { 
                    size: addr.length
                });

                break;

        }
    } else {
        res1.redirect('/');
    }
});


//----------- Status
appl.get('/status/:ip', function(req,res1) {
    if(req.xhr) {
        recl[req.session.id].f.get("https://" + req.params.ip + ":8000/api/v2/status", function(data,res2) {
            if(res2.statusCode == 401) {
                res1.render('status', { status: "Unauthorized" });
            } else {
                res1.render('status', { status: data });
            }
        }).on('error', function(err) { 
            res1.render('status', { status: req.params.ip + " not responding!" });
        });
    } else {
        res1.redirect('/');
    }
});


//----------- Log
appl.get('/log/:ip', function(req,res1) {
    if(req.xhr) {
        recl[req.session.id].f.get("https://" + req.params.ip + ":8000/api/v2/log", function(data,res2) {
            if(res2.statusCode == 401) {
                res1.render('log', { log: "Unauthorized" });
            } else {
                res1.render('log', { log: data });
            }
        }).on('error', function(err) { 
            res1.render('log', { log: req.params.ip + " not responding!" });
        });
    } else {
        res1.redirect('/');
    }
});


//----------- Store
appl.get('/store/:ip', function(req,res1) {
    if(req.xhr) {
        recl[req.session.id].f.get("https://" + req.params.ip + ":8000/api/v2/store", function(data,res2) {
            if(res2.statusCode == 401) {
                res1.render('store', { store: "Unauthorized" });
            } else {
                res1.render('store', { ip: req.params.ip, store: data });
            }
        }).on('error', function(err) { 
            res1.render('store', { store: req.params.ip + " not responding!" });
        });
    } else {
        res1.redirect('/');
    }
});

//----------- Search
appl.get('/search/:ip', function(req,res1) {
    if(req.xhr) {
        res1.render('search', { ip: req.params.ip });
    } else {
        res1.redirect('/');
    }
});

appl.post('/search', function(req, res1) {
    recl[req.session.id].f.get(req.body.url, function(data1,res2) {
        if(res2.statusCode !== 200) {
            res1.render('result', { statusCode: res2.statusCode, store: [] });
        } else {
            if(data1.length == 0 ) {
                res1.render('result', { statusCode: 404, store: [] });
            } else {
                res1.render('result', { statusCode: res2.statusCode, store: data1 });
            }
            
        }
    });
});


//----------- Store operations
appl.post('/store', function(req, res1) {

    switch(req.body.method) {
        case "GET":
            recl[req.session.id].f.get(req.body.url, function(data1,res2) {
                if(res2.statusCode !== 200) {
                    res1.render('result', { statusCode: res2.statusCode, store: null });
                } else {
                    res1.render('result', { statusCode: res2.statusCode, store: data1 });
                }
            });

            break;

        case "POST":
            var args = {
                data: req.body.data,
                headers: { "Content-Type": "application/json" }
            }

            recl[req.session.id].f.post(req.body.url, args, function(data1,res2) {
                recl[req.session.id].f.get("https://" + req.body.ip + ":8000/api/v2/store", function(data2,res3) {
                    res1.render('result', { statusCode: res2.statusCode, store: data2 });
                });
            });

            break;

        case "PUT":
            var args = {
                data: req.body.data,
                headers: { "Content-Type": "application/json" }
            }

            recl[req.session.id].f.put(req.body.url, args, function(data1,res2) {
                recl[req.session.id].f.get("https://" + req.body.ip + ":8000/api/v2/store", function(data2,res3) {
                    res1.render('result', { statusCode: res2.statusCode, store: data2 });
                });
            });
    
            break;

        case "DELETE":
            recl[req.session.id].f.delete(req.body.url, function(data1,res2) {
                recl[req.session.id].f.get("https://" + req.body.ip + ":8000/api/v2/store", function(data2,res3) {
                    res1.render('result', { statusCode: res2.statusCode, store: data2 });
                });
            });

            break;
    }

});


//----------- Redirect unmatched routes
appl.all('*', function(req, res) {
  res.redirect("/");
});


//----------------------------------------- PROCESS EVENTS
process.on('SIGTERM', function() {
    htds.stop();
    process.exit(0);
});


//----------------------------------------- GO!!

//----------- DISCOVERY
htds.start();

//----------- EXPRESS LISTENING
setTimeout(function(){
    wsrv.listen(8080);
}, 6000);