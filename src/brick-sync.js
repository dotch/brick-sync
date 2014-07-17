/* global SyncStore */

(function () {

  var BrickSyncElementPrototype = Object.create(HTMLElement.prototype);


  BrickSyncElementPrototype.attachedCallback = function () {
    this.offlineStorage = document.getElementById(this.getAttribute("offline"));
    this.onlineStorage = document.getElementById(this.getAttribute("online"));
    this.sync = new SyncStore(this.onlineStorage, this.offlineStorage);
  };

  BrickSyncElementPrototype.insert = function (object) {
    return this.sync.insert(object);
  };
  BrickSyncElementPrototype.set = function (key, object) {
    return this.sync.set(key, object);
  };
  BrickSyncElementPrototype.setMany = function (objects) {
    return this.sync.setMany(objects);
  };
  BrickSyncElementPrototype.get = function (key) {
    return this.sync.get(key);
  };
  BrickSyncElementPrototype.remove = function (key) {
    return this.sync.remove(key);
  };
  BrickSyncElementPrototype.getMany = function (options) {
    return this.sync.getMany(options);
  };
  BrickSyncElementPrototype.size = function () {
    return this.sync.size();
  };
  BrickSyncElementPrototype.clear = function () {
    return this.sync.clear();
  };


  // Register the element
  window.BrickSyncElement = document.registerElement('brick-sync', {
    prototype: BrickSyncElementPrototype
  });

})();
