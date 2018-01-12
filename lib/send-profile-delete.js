module.exports = function sendProfileDelete(MediaManager) {
  MediaManager.prototype.sendProfileDelete = function sendProfileDelete(data) {
    if (this.firstRun) return;

    this.server.connections.forEach((connection) => {
      connection.send(JSON.stringify({
        type: 'profile-delete',
        data,
      }));
    });
  };
};
