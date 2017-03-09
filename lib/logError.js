// from here: https://gist.github.com/mikelehen/5398652
module.exports = (function() {
	let consoleError = console.error;
	//let timeStart = new Date().getTime();

	return function() {
		//let delta = new Date().getTime() - timeStart;
		let delta = new Date();
		let args = [];
		//args.push((delta / 1000).toFixed(2) + ':');
		args.push(`[${delta.toLocaleTimeString()}]:`);

		for(let i = 0; i < arguments.length; i++) {
			args.push(arguments[i]);
		}
		consoleError.apply(console, args);
	};
})();