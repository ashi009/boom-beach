#! /usr/bin/env node

var han = require('han');
var inquirer = require('inquirer');
var async = require('async');
var parseArgv = require('node-argv');
var abbrev = require('abbrev');
var chalk = require('chalk');
var util = require('util');
var fs = require('fs');

var kRootPath = __dirname + '/';
var kPlayerDbPath = kRootPath + 'players.json';
var kLogDbPath = kRootPath + 'log.json';

var pPlayer, pLog;

/**
 * fns
 */
function fix() {
  for (var key in pPlayer.player) {
    var player = pPlayer.player[key];
    delete player.active;
  }
}

function lookup(initials) {
  var pattern = new RegExp(initials.replace(/\W+/g, '').split('').join('.*'));
  var match = [];
  for (var key in pPlayer.player) {
    var player = pPlayer.player[key];
    if (pattern.test(player.initials))
      match.push(player);
  }
  return match;
}

function add(name, level, initials) {
  if (!initials)
    initials = han.letter(name);
  var id = pPlayer.id++;
  pPlayer.player[id] = {
    id: id,
    active: true,
    name: name,
    initials: initials,
    level: level,
    title: null,
    join: pLog.currentDay
  };
}

function edit(player) {
  var options = this;
  //
}

function playerToString(player) {
  return util.format('%s: %d', player.name, player.level);
}

function remove(player) {
  delete pPlayer.player[player.id];
}

function setCurrentDate(date) {
  pLog.currentDay = parseInt(Date.parse(date).valueOf() / 1000 / 3600 / 24);
  if (!pLog.day[pLog.currentDay])
    pLog.day[pLog.currentDay] = {};
}

function getCurrentDate() {
  return new Date(pLog.currentDay * 1000 * 3600 * 24);
}

function mark(player) {
  pLog.day[pLog.currentDay][player.id] = true;
}

function unmark(player) {
  delete pLog.day[pLog.currentDay][player.id];
}

function complete() {
  pLog.complete[pLog.currentDay] = true;
}

function showPlayer(player) {
  console.log(player);
}

function showSummary() {
  var count = 0, total = 0, lazy = [];
  var day = pLog.day[pLog.currentDay];
  for (var key in pPlayer.player) {
    var player = pPlayer.player[key];
    if (player.join < pLog.currentDay) {
      total++;
      if (day[player.id]) {
        count++;
      } else {
        lazy.push(player);
      }
    }
  }
  console.log('%s status %s %d/%d',
      getCurrentDate().toISOString().replace(/T.+/, ''),
      pLog.complete[pLog.currentDay] ?
          chalk.green('completed') : chalk.red('failed'),
      count,
      total);
  console.log('Lazy players:');
  console.log(lazy.map(playerToString).join('\n'));
}

/**
 * handlers
 */
function rawHandler(fn, callback, argv, options) {
  fn.apply(options, argv);
  setImmediate(callback);
}

function outputHandler(fn, callback, argv, options) {
  console.log(fn.apply(options, argv));
  setImmediate(callback);
}

function playerHandler(fn, callback, argv, options) {
  var initials = argv[0];
  async.waterfall([
    function(callback) {
      callback(null, lookup(initials));
    },
    function(players, callback) {
      if (players.length < 1) {
        console.log('Failed to find player %j', initials);
        callback(null, null);
      } else if (players.length == 1) {
        callback(null, players[0]);
      } else {
        inquirer.prompt([{
          type: 'list',
          name: 'index',
          message: 'Chose player:',
          choices: players.map(function(player, i) {
            return {
              name: playerToString(player),
              value: i
            };
          }),
          default: 0
        }], function(answers) {
          callback(null, players[answers.index]);
        });
      }
    },
    function(player, callback) {
      if (player)
        fn.call(options, player);
      callback();
    }
  ], function() {
    setImmediate(callback);
  });
}

/**
 * commands
 */
var pCommands = {
  fix: rawHandler.bind(null, fix),
  lookup: outputHandler.bind(null, lookup),
  add: rawHandler.bind(null, add),
  setCurrentDate: rawHandler.bind(null, setCurrentDate),
  getCurrentDate: outputHandler.bind(null, getCurrentDate),
  mark: playerHandler.bind(null, mark),
  unmark: playerHandler.bind(null, unmark),
  complete: rawHandler.bind(null, complete),
  summary: rawHandler.bind(null, showSummary),
  player: playerHandler.bind(null, showPlayer),
  save: rawHandler.bind(null, save),
  quit: rawHandler.bind(null, quit)
};

var pCommandAbbrev = abbrev(Object.keys(pCommands));

/**
 * routines
 */

function load() {
  pPlayer = JSON.parse(fs.readFileSync(kPlayerDbPath));
  pLog = JSON.parse(fs.readFileSync(kLogDbPath));
}

function save() {
  fs.writeFileSync(kPlayerDbPath, JSON.stringify(pPlayer, null, 2));
  fs.writeFileSync(kLogDbPath, JSON.stringify(pLog, null, 2));
}

function quit(code) {
  process.exit(code || 0);
}

process.on('exit', function(code) {
  if (code === 0)
    save();
});

/**
 * repl
 */
load();

async.forever(function(next) {
  inquirer.prompt([{
    name: 'command',
    message: '>'
  }], function(answers) {
    var argv = parseArgv(answers.command, {});
    var cmd = argv.commands.shift();
    var handler = pCommands[pCommandAbbrev[cmd]];
    if (!handler) {
      console.log('Command %j not found', cmd);
      console.log('Available commands: %s',
          Object.keys(pCommandAbbrev).join(', '));
      setImmediate(next);
    } else {
      handler(next, argv.commands, argv.options);
    }
  });
});
