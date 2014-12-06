#! /usr/bin/env node

require('apollojs');

var han = require('han');
var inquirer = require('inquirer');
var async = require('async');
var parseArgv = require('node-argv');
var abbrev = require('abbrev');
var chalk = require('chalk');
var fuzzy = require('fuzzy');
var util = require('util');
var fs = require('fs');

var kRootPath = __dirname + '/';
var kPlayerDbPath = kRootPath + 'players.json';
var kLogDbPath = kRootPath + 'log.json';

var pPlayer, pLog;

/**
 * funcs
 */
function fix() {
  for (var key in pPlayer.player) {
    var player = pPlayer.player[key];
    // player.warn = 0;
    if (player.join === 0)
      player.join = 16401;
  }
}

function lookup(initials) {
  return fuzzy.filter(String(initials || ''),
      Object.values(pPlayer.player), {
        extract: function(player) {
          return player.initials;
        }
      }).sort(function(lhv, rhv) {
        return rhv.score - lhv.score || lhv.index - rhv.index;
      }).map(function(entry) {
        return entry.original;
      });
}

function add(name, level, initials) {
  name = String(name || '')
  if (!initials)
    initials = han.letter(name, '-');
  var id = pPlayer.id++;
  pPlayer.player[id] = {
    id: id,
    active: true,
    name: name,
    initials: initials,
    level: level,
    title: null,
    join: pLog.currentDay,
    warn: 0
  };
}

function edit(player) {
  var options = this;
  for (var key in options) {
    if (key in player)
      player[key] = options[key];
  }
}

function warn(player) {
  player.warn++;
}

function unwarn(player) {
  player.warn = (player.warn - 1).clamp(0);
}

function playerToString(player) {
  return util.format('%s: %d', player.name, player.level);
}

function remove(player) {
  pPlayer.player[player.id].leave = pLog.currentDay;
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
    if (player.join < pLog.currentDay &&
        (!player.leave || player.leave >= pLog.currentDay)) {
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

function showLazy() {
  var players = [];
  for (var key in pPlayer.player) {
    var player = pPlayer.player[key];
    if (player.leave && player.leave < pLog.currentDay)
      continue;
    var startDay = player.join + 1;
    var endDay = player.leave || pLog.currentDay;
    var totalDay = endDay - startDay + 1;
    var missedDay = 0;
    var laybackDay = 0;
    for (var day = startDay; day <= endDay; day++) {
      if (!pLog.day[day][player.id]) {
        if (pLog.complete[day]) {
          laybackDay++;
        } else {
          missedDay++;
        }
      }
    }
    if (totalDay && (laybackDay || missedDay))
      players.push({
        player: player,
        totalDay: totalDay,
        missedDay: missedDay,
        laybackDay: laybackDay,
        score: (missedDay / totalDay) * 10 + (laybackDay / totalDay)
      });
  }
  console.log('%s/%s/%s\tPlayer',
      chalk.red('M'),
      chalk.yellow('L'),
      chalk.green('T'));
  players.sort(function(lhe, rhe) {
    return rhe.score - lhe.score;
  }).forEach(function(entry) {
    console.log('%s/%s/%s\t%s',
        chalk.red(entry.missedDay),
        chalk.yellow(entry.laybackDay),
        chalk.green(entry.totalDay),
        playerToString(entry.player));
  });
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
  remove: playerHandler.bind(null, remove),
  edit: playerHandler.bind(null, edit),
  setCurrentDate: rawHandler.bind(null, setCurrentDate),
  getCurrentDate: outputHandler.bind(null, getCurrentDate),
  mark: playerHandler.bind(null, mark),
  unmark: playerHandler.bind(null, unmark),
  warn: playerHandler.bind(null, warn),
  unwarn: playerHandler.bind(null, unwarn),
  complete: rawHandler.bind(null, complete),
  summary: rawHandler.bind(null, showSummary),
  lazy: rawHandler.bind(null, showLazy),
  player: playerHandler.bind(null, showPlayer),
  save: rawHandler.bind(null, save),
  quit: rawHandler.bind(null, quit)
};

var pCommandAbbrev = abbrev(Object.keys(pCommands));
pCommandAbbrev.rm = 'remove';

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
