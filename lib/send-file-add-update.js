module.exports = function sendFileAddUpdate(MediaManager) {
  MediaManager.prototype.sendFileAddUpdate = function sendFileAddUpdate(data) {
    if (this.firstRun) return;

    this.server.connections.forEach((connection) => {
      connection.send(JSON.stringify({
        type: 'file-update-add',
        data,
      }));
    });
  };
};
