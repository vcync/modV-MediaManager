module.exports = function sendProfileAdd(MediaManager) {
  MediaManager.prototype.sendProfileAdd = function sendProfileAdd(data) {
    if (this.firstRun) return;

    this.server.connections.forEach((connection) => {
      connection.send(JSON.stringify({
        type: 'profile-add',
        data,
      }));
    });
  };
};
