module.exports = function sendFileDeleteUpdate(MediaManager) {
  MediaManager.prototype.sendFileDeleteUpdate = function sendFileDeleteUpdate(data) {
    if (this.firstRun) return;

    this.server.connections.forEach((connection) => {
      connection.send(JSON.stringify({
        type: 'file-update-delete',
        data,
      }));
    });
  };
};
