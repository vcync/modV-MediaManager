// from here: https://gist.github.com/mikelehen/5398652
module.exports = (function iife() {
  const consoleLog = console.log;

  return function log(...argsIn) {
    const delta = new Date();
    const args = [];
    args.push(`[${delta.toLocaleTimeString()}]:`);

    for (let i = 0; i < argsIn.length; i += 1) {
      args.push(argsIn[i]);
    }
    consoleLog.apply(console, args);
  };
}());
