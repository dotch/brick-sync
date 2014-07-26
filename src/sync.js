(function() {

  function Queue() {
    this.items = [];
  }
  Queue.prototype.get = function(index){
    return this.items[index];
  };
  Queue.prototype.push = function(item){
    this.items.push(item);
  };
  Queue.prototype.shift = function(){
    this.items.shift();
  };
  Queue.prototype.length = function(){
    return this.items.length;
  };
  Queue.prototype.contains = function(key){
    for (var i = 0; i < this.items.length; i++) {
      if (this.items[i].key === key) {
        return true;
      }
    }
    return false;
  };
  Queue.prototype.keys = function(){
    var keys = [];
    for (var i = 0; i < this.items.length; i++) {
      keys.push(this.items[i].key);
    }
    return keys;
  };

  function SyncStore(onlineStorage, offlineStorage) {
    this.onlineStorage = onlineStorage;
    this.offlineStorage = offlineStorage;
    if (!this.onlineStorage.hasAttribute("keyname") ||
        !this.offlineStorage.hasAttribute("keyname") ||
        this.onlineStorage.getAttribute("keyname") !== this.offlineStorage.getAttribute("keyname")) {
      throw new Error("online and offline storage have to use the same keyname!");
    }
    this.keyname = this.onlineStorage.getAttribute("keyname");
    this.syncQueue = new Queue();
    this.backoff = 2;
    this.online = true;
    this.syncing = false;
  }

  SyncStore.prototype = {
    ns: {},

    _wait: function(ms) {
      var self = this;
      return new Promise(function(resolve) {
        // save reference to be able to cancel the timeout
        self.timeout = setTimeout(resolve, ms);
      });
    },

    resetBackoff: function() {
      // reset backoff time
      this.backoff = 2;
    },

    clearTimeout: function() {
      if (this.timeout) {
        clearTimeout(this.timeout);
        this.timeout = null;
      }
    },

    // switch to async sync..
    sync: function() {
      // sync first operation in queue
      //   if success
      //     remove operation from queue
      //     reset backoff
      //     set sync and online flag to true
      //     if queue not empty
      //       proceed with the next operation
      //     else
      //       set sync-flag to false
      //   else
      //     if network error
      //       handleNetworkError (backoff, etc)
      //     else
      //       remove faulty operation
      //       proceed with the next operation
      var self = this;
      var operation = self.syncQueue.get(0);
      var method = self.onlineStorage[operation.methodName];
      method.call(self.onlineStorage,operation.param).then(function(){
        // success
        self.syncQueue.shift();
        self.resetBackoff();
        self.online = true;
        self.syncing = true;
        if (self.syncQueue.length()) {
          self.sync(); // go next!
        } else {
          self.syncing = false; // done syncing
        }
      }, function(e){
        if (e.constructor.name ==="NetworkError") {
          self.handleNetworkError();
        } else {
          // remove this faulty operation so it does not block
          // and go next!
          self.syncQueue.shift();
          if (self.syncQueue.length()) {
            self.sync();
          }
        }
      });
    },

    handleNetworkError: function() {
      // set the state to offline
      // if definitely offline (!navigator.onLine)
      //   listen for back-online event
      //     then sync
      // else if possibly online
      //   wait backoff time
      //     then sync and increase backoff time
      var self = this;
      self.online = false;
      self.syncing = false;
      if ("onLine" in navigator && !navigator.onLine) {
        var onlineHandler = function(){
          self.sync();
          window.removeEventListener(onlineHandler);
        };
        window.addEventListener("online",onlineHandler);
      } else {
        // we may be online, keep syncing
        self._wait(self.backoff * 1000).then(function(){
          self.sync();
        });
        // quadratic backoff with a maximum of 256 seconds
        self.backoff = self.backoff < 256 ? self.backoff * 2 : 256;
      }
    },

    _write: function(methodName, param) {
      // write to offlineStorage
      //   if success
      //      add to queue
      //      if necessary start sync (will be handled by queue later)
      //      return info
      //   else
      //      return error
      var self = this;
      var method = self.offlineStorage[methodName];
      var objKey = param ? param[self.keyname] : undefined;
      return method.call(self.offlineStorage, param)
        .then(function(res){
          self.syncQueue.push({
            methodName: methodName,
            param: param,
            key: objKey
          });
          // to be changed!
          if (self.syncQueue.length() === 1) {
            // start sync!
            self.sync();
          }
          return res;
        });
    },

    insert: function (object) {
      return this._write("insert", object);
    },

    set: function (object) {
      return this._write("set", object);
    },

    setMany: function (objects) {
      return this._write("setMany", objects);
    },

    remove: function (key) {
      return this._write("remove", key);
    },

    clear: function () {
      return this._write("clear");
    },

    get: function (key) {
      // if key in syncQueue || offline
      //    return getoffline
      // else
      //    getOnline
      //      if success
      //        cache result
      //        return result
      //      else
      //        if network error
      //          add get to queue
      //          handleNetworkError
      //        else
      //          return error
      var self = this;
      if (self.syncQueue.contains(key) || !self.online){
        return self.offlineStorage.get(key);
      } else {
        return self.onlineStorage.get(key).then(function(result){
          self.offlineStorage.set(result);
          return result;
        }, function(e){
          if (e.constructor.name ==="NetworkError") {
            // add this get to the queue so we have something
            // to test online status with.
            self.syncQueue.push({
              methodName: 'get',
              param: key,
              key: undefined
            });
            self.handleNetworkError();
            return self.offlineStorage.get(key);
          } else {
            return Promise.reject(e);
          }
        });
      }
    },


    // still has some issues.
    getMany: function(options) {
      // if !online or syncQueue > 0
      //   return getManyOffline
      // else
      //   getOnline
      //     if success
      //       cache results
      //       return results
      //     else
      //       return getoffline
      var self = this;
      if (!self.online || self.syncQueue.length() > 0) {
        return self.offlineStorage.getMany(options);
      } else {
        return self.onlineStorage.getMany(options).then(function(result){
          self.offlineStorage.setMany(result);
          return result;
        }, function(e){
          if (e.constructor.name ==="NetworkError") {
            // add this get to the queue so we have something
            // to test online status with.
            self.syncQueue.push({
              methodName: 'getMany',
              param: options,
              key: undefined
            });
            self.handleNetworkError();
            return self.offlineStorage.getMany(options);
          } else {
            return Promise.reject(e);
          }
        });
      }
    },


    size: function() {
      // todod. make better!.
      return this.offlineStorage.size();
    }

  };

  Object.defineProperties(SyncStore.prototype, {
    'online': {
      get: function(){
        return this.ns.online;
      },
      set: function(newVal){
        if (this.ns.online !== newVal) {
          this.ns.online = newVal;
          console.info("online", this.ns.online);
        }
      }
    },
    'syncing': {
      get: function(){
        return this.ns.syncing;
      },
      set: function(newVal){
        if (this.ns.syncing !== newVal) {
          this.ns.syncing = newVal;
          console.info("syncing", this.ns.syncing, this.syncQueue.length());
        }
      }
    },
    'queueSize': {
      get: function() {
        return this.syncQueue.length;
      }
    }
  });
  window.SyncStore = SyncStore;

})();
