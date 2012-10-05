var fs = require('fs'), path = require('path');
var exec = require('child_process').exec;

var that = this;

that.tempdir = process.platform === 'win32' ? process.env.TEMP + '\\' : '/tmp/';

var lastcommand, lastrandom = [], lastrandom_time = 0;

function uniquerandom() {
	var newtime = (new Date()).getTime(), random;
	
	if (lastrandom_time != newtime && lastrandom.length > 0) {
		lastrandom = [];
	}
	
	do {
		random = Math.floor(Math.random() * 9999);
	} while (lastrandom.indexOf(random) != -1);
	
	lastrandom.push(random);
	
	return (newtime * 10000) + random;
}

this.uniquerandom = uniquerandom;

var isoDateReviver_re = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*)?)(?:([\+-])(\d{2})\:(\d{2}))?Z?$/;

function isoDateReviver(key, value) {
	if (typeof value === 'string') {
		var a = isoDateReviver_re.exec(value);
		if (a) {
			var utcMilliseconds = Date.UTC(+a[1], +a[2] - 1, +a[3], +a[4], +a[5], +a[6]);
			return new Date(utcMilliseconds);
		}
	}
	return value;
}

function show_error(error, stdout, stderr) {
	if (stdout) console.log('node_spreadsheet_stdout: ' + stdout);
	if (stderr) console.log('node_spreadsheet_stderr: ' + stderr);
	if (error !== null) {
		console.log('node-spreadsheet last command: ' + lastcommand);
		console.log('node-spreadsheet error: ' + error);
	}
}

var exec_option = {
	timeout: 1500
};

function tocolnames(list, colnamesarr, eachcall) {
	var retlist = [];
	var cols_len = colnamesarr.length

	for (var i = 0, l = list.length; i < l; i++) {
		var obj = {};
		for (var j = 0, items_len = list[i].length; j < cols_len && j < items_len; j++) {
			obj[colnamesarr[j]] = list[i][j];
		}
		if (eachcall) eachcall(obj);
		retlist[i] = obj;
	}
	return retlist;
}

function readcols(inputfile, colnamesarr, callback, options) {
	read(inputfile, function(list) {

		var listofobjs = tocolnames(list, colnamesarr);
		delete list;
		callback(listofobjs);

	}, options);
};

this.readcols = readcols;

function readcols_each(inputfile, colnamesarr, eachcall, callback, options) {
	read(inputfile, function(list) {

		var listofobjs = tocolnames(list, colnamesarr, eachcall);
		delete list;
		callback(listofobjs);

	}, options);
};

this.readcols_each = readcols_each;

function read(inputfile, callback, options) {
	if (!options) options = {};
	var file = ('file' in options) ? that.tempdir + options['file'] : that.tempdir + that.uniquerandom() + '.json';

	var args_str = '';
	var args = [];

	//options usage example
	//if defined then use value:
	//if('indent' in options)       args.push('--indent='+options['indent']);
	//if defined then use boolean:
	//if(('no-auto-dir' in options) && options['no-auto-dir'])    args.push('--no-auto-dir');

	args.push('-f'); // add text
	args.push(__dirname + '/convert.php'); // add text  
	args.push(inputfile); // add text
	args.push(file); // save to file only

	for (var i = 0; i < args.length; i++) {
		args_str += " " + args[i].replace(/[^\\]'/g, function(m) {
			return m.slice(0, 1) + '\\\'';
		}) + "";
	}

	var cmd = process.platform === 'win32' ? 'SET ' : 'export ';

	cmd += 'LANG=en_US.UTF-8 && php ' + args_str, exec_option;

	//var cmd='export 
	lastcommand = cmd;
	var child = exec(cmd, show_error);

	//var child = exec('export LANG=en_US.UTF-8;env ',  show_error );
	child.on('exit', function(code, signal) {
		if (code == 0) {
			fs.readFile(file, 'utf-8', function(err, data) {
				if (err) throw err;
				fs.unlink(file, function(err2) {
					if (err2) throw err;
					callback(JSON.parse(data, isoDateReviver));
				});
			});
		} 
		else {
			callback([
				["FILE NOT FOUND"]
			]);
		}
	});
}

this.read = read;

function write(options, callback) {
	// add missing options from this.options
	var this_options = that.options;

	if (this_options) for (name in this_options) {
		if (Object.hasOwnProperty.call(this_options, name)) {
			if (!(name in options)) {
				options[name] = this_options[name];
			}
		}
	}
	//

	var args_str = '-f "' + addslashes(__dirname + '/convert.php') + '"';

	var cmd = process.platform === 'win32' ? 'SET ' : 'export ';
	cmd += 'LANG=en_US.UTF-8;php ' + args_str + "", exec_option;

	lastcommand = cmd;

	var child = exec(cmd, show_error);
	child.stdin.write(JSON.stringify(options));
	child.stdin.end();

	//var child = exec('export LANG=en_US.UTF-8;env ',  show_error );
	child.on('exit', function(code, signal) {
		if (callback) {
			if (code == 0) {
				callback(true);
			} 
			else {
				callback(false)
			}
		}
	});
}
this.write = write;