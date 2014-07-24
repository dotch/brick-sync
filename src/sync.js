(function() {

  function SyncStore(onlineStorage, offlineStorage) {
    this.onlineStorage = onlineStorage;
    this.offlineStorage = offlineStorage;
    if (!this.onlineStorage.hasAttribute("keyname") ||
        !this.offlineStorage.hasAttribute("keyname") ||
        this.onlineStorage.getAttribute("keyname") !== this.offlineStorage.getAttribute("keyname")) {
      throw new Error("online and offline storage have to use the same keyname!");
    }
    this.key = this.onlineStorage.getAttribute("keyname");
    this.syncQueue = [];
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

    retry: function() {
      // retry first operation in queue
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
      var operation = self.syncQueue[0];
      var method = self.onlineStorage[operation.methodName];
      method.call(self.onlineStorage,operation.param).then(function(){
        // success
        self.syncQueue.shift();
        self.resetBackoff();
        self.online = true;
        self.syncing = true;
        if (self.syncQueue.length) {
          self.retry(); // go next!
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
          if (self.syncQueue.length) {
            self.retry();
          }
        }
      });
    },

    handleNetworkError: function() {
      // if definitely offline (!navigator.onLine)
      //   listen for back-online event
      //     then retry
      // else if possibly online
      //   wait backoff time
      //     then retry and increase backoff time
      var self = this;
      self.online = false;
      self.syncing = false;
      if ("onLine" in navigator && !navigator.onLine) {
        var onlineHandler = function(){
          self.retry();
          window.removeEventListener(onlineHandler);
        };
        window.addEventListener("online",onlineHandler);
      } else {
        // we may be online, keep retrying
        self._wait(self.backoff * 1000).then(function(){
          self.retry();
        });
        // quadratic backoff with a maximum of 256 seconds
        self.backoff = self.backoff < 256 ? self.backoff * 2 : 256;
      }
    },

    _write: function(methodName, param) {
      // write to offlinestorage
      //   then
      //     if something is in queue
      //       add request to queue
      //       return info
      //     else
      //       send online
      //         if success
      //           return res
      //         else
      //           if network error
      //             add request to queue
      //             start the retry dance (handle network error)
      //             return info
      //           else
      //             return the (data)error
      var self = this;
      var fnOnline = self.onlineStorage[methodName];
      var fnOffline = self.offlineStorage[methodName];
      return fnOffline.call(self.offlineStorage, param).then(function(){
        if (self.syncQueue.length) {
          // add to queue if something is in sync queue
          self.syncQueue.push({methodName: methodName, param: param});
          return Promise.resolve("queued " + methodName + " at position " + self.syncQueue.length);
        } else {
          // else send it online
          return fnOnline.call(self.onlineStorage, param).catch(function(e){
            // error! check if data error or network error
            if (e.constructor.name ==="NetworkError") {
              // network is down.
              // add query to queue and start retrying.
              self.syncQueue.push({methodName: methodName, param: param});
              self.handleNetworkError();
              return "queued " + methodName + " at position 1";
            } else {
              return e;
            }
          });
        }
      });

    },

    insert: function (object) {
      return this.write("insert", object);
    },

    set: function (object) {
      return this.write("set", object);
    },

    setMany: function (objects) {
      return this.write("setMany", objects);
    },

    remove: function (key) {
      return this.write("remove", key);
    },

    clear: function () {
      return this.write("clear");
    },

    // get: function (key) {
    //   // if syncQueue > 0
    //   //   if !syncing
    //   //     return getOffline
    //   //   else if syncing
    //   //     if key in syncqueue
    //   //       return getOffline/queue
    //   //     else
    //   //       getOnline
    //   // else if syncQueue empty
    //   //   getOnline
    //   //      if success
    //   //        return item
    //   //      else
    //   //        queue up get
    //   //        return getOffline
    //   //
    //   // Note: usually it does not make sence to queue a get,
    //   // because the result will not be returned to the user and
    //   // does not change anything. but it can be used to test the online
    //   // status if there is no other operation in the queue.
    //   // so we queue up a get if it fails and the queue is empty.


    //   var self = this;
    //   return self.onlineStorage.get(key).catch(function(e){
    //     if (e.constructor.name === "NetworkError") {
    //       // network is down.
    //       // get from offline storage.
    //       return self.offlineStorage.get(key);
    //     } else {
    //       return e;
    //     }
    //   });
    // },



    getMany: function(options) {
      var self = this;
      return self.onlineStorage.getMany(options).catch(function(e){
        if (e.constructor.name === "NetworkError") {
          // network is down.
          // get from offline storage.
          return self.offlineStorage.getMany(options);
        } else {
          return e;
        }
      });
    },

    size: function() {
      var self = this;
      return self._awaitReady(self._size);
    },



  };

  Object.defineProperties(SyncStore.prototype, {
    'online': {
      get: function(){
        return this.ns.online;
      },
      set: function(newVal){
        if (this.ns.online !== newVal) {
          this.ns.online = newVal;
          console.log("online", this.ns.online);
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
          console.log("syncing", this.ns.syncing, this.syncQueue.length);
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
