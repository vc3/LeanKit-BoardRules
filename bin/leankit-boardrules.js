#! /usr/bin/env node

var path = require('path');
var fs = require('fs');
var leankit = require('leankit-client');
var boardRules = require('../LeanKit-BoardRules.js');


// Get arguments
var args = process.argv.slice(2);

if(args.length == 0)
	usageAndExit('No arguments specified');

var email = args[0];
if (!email)
	usageAndExit('Email not specified');

var password = args[1];
if (!password)
	usageAndExit('Password not specified');

if (typeof (args[2]) !== 'string' || ['execute', 'report'].indexOf(args[2]) < 0)
	usageAndExit('Either excute or report must be specified');
var execute = args[2] === 'execute';

var configFile = args[3];
if (!configFile)
	usageAndExit('configFile not specified');


// Load rules
if(!fs.existsSync(configFile))
	usageAndExit('File not found: ' + configFile);

var config = require(path.resolve(configFile.replace(/\\/, '/')));

if (!config.account) {
	usageAndExit('configFile did not export an account. Set: exports = {account, boardId, rules}');
}
if (!config.boardId) {
	usageAndExit('configFile did not export a boardId. Set: exports = {account, boardId, rules}');
}
if (!config.rules) {
	usageAndExit('configFile did not export rules. Set: exports = {account, boardId, rules}');
}

// Run the rules
var client = leankit.newClient(config.account, email, password);
boardRules.run(client, config.boardId, execute, config.rules, function (error) {
	console.log('');

	if (error) {
		console.log('');
		console.log('ERROR!!!');
		console.log(error);
	}
	else
		console.log('Done');
});


function usageAndExit(errorMessage) {
	if (errorMessage) {
		console.log('');
		console.log('ERROR: ' + errorMessage);
		console.log('');
	}

	console.log('USAGE: leankit-boardrules email password <execute|report> configFile');
	console.log('  email:      Email address of user to connect as');
	console.log('  password:   Password of user to connect as');
	console.log('  execute:    Specify to execute the rules');
	console.log('  report:     Specify to show a report of what will occur if rules are executed');
	console.log('  configFile:  Javascript file that should export the configuration (exports = {account, boardId, rules})');
	console.log('');

	process.exit(errorMessage ? -1 : 0);
}