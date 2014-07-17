(function() {

  function SyncStore(onlineStorage, offlineStorage, options) {

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
        self.timeout = setTimeout(resolve, ms);
      });
    },

    resetBackoff: function() {
      // reset backoff time
      this.backoff = 2;
      // cancel operation which are still waiting
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
      //     proceed with the next operation
      //   else
      //     if network error
      //       handleNetworkError (backoff, etc)
      //     else
      //       remove faulty operation
      //       proceed with the next operation
      var self = this;
      var operation = self.syncQueue[0];
      var method = self.onlineStorage[operation.methodName];
      method.call(self.onlineStorage,operation.param).then(function(res){
        // success
        self.syncQueue.shift();
        self.resetBackoff();
        if (!self.online) {self.online = true;}
        if (!self.syncing) {self.syncing = true;}
        if (self.syncQueue.length) {
          // go next!
          self.retry();
        } else {
          // done syncing
          self.syncing = false;
        }
      }, function(e){
        if (e.constructor.name ==="NetworkError") {
          // network error
          self.handleNetworkError();
        } else {
          // other error
          // remove this faulty operation so it does not block the others
          // and go next!
          self.syncQueue.shift();
          if (self.syncQueue.length) {
            // go next!
            self.retry();
          }
        }
      });
    },

    handleNetworkError: function() {
      // if definitely offline
      //   listen for back-online event
      //     then retry
      // else if possibly online
      //   wait(backoff)
      //     then retry and increase backoff
      var self = this;
      if (self.online) {self.online = false;}
      if (self.syncing) {self.syncing = false;}
      if ("onLine" in navigator && !navigator.onLine) {
        // we are offline!
        var onlineHandler = function(){
          self.retry();
          window.removeEventListener(onlineHandler);
        };
        window.addEventListener("online",onlineHandler);
      } else {
        // we may be online
        self._wait(self.backoff * 1000).then(function(){
          self.retry();
        });
        // quadratic backoff with a maximum of 256 seconds
        self.backoff = self.backoff < 256 ? self.backoff * 2 : 256;
      }
    },

    // methodName can be
    //  -insert
    //  -set
    //  -setMany
    _onlineWrite: function(methodName, object) {
      // if something is in queue
      //   add request to queue
      //   return info
      // else
      //   send online
      //     if works
      //       done
      //       return info
      //     else
      //       if network error
      //         add to queue and start the retry dance (handle network error)
      //         return info
      //       else
      //         return the (data)error
      var self = this;
      var fn = self.onlineStorage[methodName];
      if (self.syncQueue.length) {
        // add to queue if something is in sync queue
        self.syncQueue.push({methodName: methodName, param: object});
        return Promise.resolve("queued " + object[self.key] + " at position " + self.syncQueue.length);
      } else {
        // else send it online
        return fn.call(self.onlineStorage, object).catch(function(e){
          // error! check if data error or network error
          if (e.constructor.name ==="NetworkError") {
            // network is down.
            // add query to queue.
            // start retrying.
            self.syncQueue.push({methodName: methodName, param: object});
            self.handleNetworkError();
            return "queued " + object[self.key] + " at position 1";
          } else {
            return e;
          }
        });
      }
    },

    insert: function (object) {
      var self = this;
      return this.offlineStorage.insert(object).then(function(key){
        return self._onlineWrite("insert", object);
      });
    },

    set: function (object) {
      var self = this;
      return this.offlineStorage.set(object).then(function(key){
        return self._onlineWrite("set", object);
      });
    },

    setMany: function (objects) {
      var self = this;
      return this.offlineStorage.setMany(objects).then(function(key){
        return self._onlineWrite("setMany", objects);
      });
    },

    get: function (key) {
      // get from queue, queue is most recent version!
      // get online
      // get offline
    },

    remove: function (key) {
      var self = this;
      return self._awaitReady(self._remove, arguments);
    },

    getMany: function(options) {
      return this.onlineStorage.getMany(options);
    },

    size: function() {
      var self = this;
      return self._awaitReady(self._size);
    },

    clear: function () {
      var self = this;
      return self._awaitReady(self._clear);
    }

  };

  Object.defineProperties(SyncStore.prototype, {
    'online': {
      get: function(){
        return this.ns.online;
      },
      set: function(newVal){
        this.ns.online = newVal;
        console.log("online", this.ns.online);
      }
    },
    'syncing': {
      get: function(){
        return this.ns.syncing;
      },
      set: function(newVal){
        this.ns.syncing = newVal;
        console.log("syncing", this.ns.syncing, this.syncQueue.length);
      }
    }
  });
  window.SyncStore = SyncStore;

})();
