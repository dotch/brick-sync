/* jshint expr: true */
/* global mocha, chai, before, describe, it */

mocha.setup('bdd');

var ready;

before(function (done) {
  ready = done;
});

var expect = chai.expect;

var keyAttribute = "k";
var indexAttribute = "v";
var timeout = 10000;
var n = 16;
var sampleItems = [];

var restApikKey = "tI5To9viL2ygoURZFN7uTnh439XXqkSRk0xFRfLH";
var appId = "Jex2pgGOUnZQHiSJOvbqUDoKO0qmJO948Rtcu4oy";
var className = 'item';

window.addEventListener('WebComponentsReady', function(e) {
  document.head.innerHTML += '<link rel="import" id="on-el" href="/base/bower_components/brick-storage-parse/src/brick-storage-parse.html">';
  document.head.innerHTML += '<link rel="import" id="off-el" href="/base/bower_components/brick-storage-indexeddb/src/brick-storage-indexeddb.html">';
  document.head.innerHTML += '<link rel="import" id="el" href="/base/src/brick-sync.html">';

  document.querySelector('#el').addEventListener('load', function() {

    window.online = document.createElement('brick-storage-parse');
    online.id = 'online';
    online.setAttribute('appid', appId);
    online.setAttribute('classname', className);
    online.setAttribute('restapikey', restApikKey);
    online.setAttribute('keyname', keyAttribute);
    document.body.appendChild(online);

    window.offline = document.createElement('brick-storage-indexeddb');
    offline.id = 'offline';
    offline.setAttribute('name', 'store-key');
    offline.setAttribute('keyname', keyAttribute);
    offline.setAttribute('indexname', indexAttribute);
    document.body.appendChild(offline);

    window.sync = document.createElement('brick-sync');
    sync.setAttribute('online', 'online');
    sync.setAttribute('offline', 'offline');
    document.body.appendChild(sync);

    ready();
  });
});

function randomContent() {
  return Math.random().toString(36).substr(2);
}

function generateSampleItems(n) {
  var collection = {};
  var items = [];
  while(Object.keys(collection).length < n) {
    var key = randomContent();
    collection[key] = randomContent();
  }
  for (var itemKey in collection) {
    var item = {};
    item[keyAttribute] = itemKey;
    item.v = collection[itemKey];
    items.push(item);
  }
  items = shuffleArray(items);
  for (var i = 0; i < items.length; i++) {
    items[i].i = i;
  }
  return items;
}

function shuffleArray(o){
    for(var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
    return o;
}

function sortArray(array, property){
  var arr = array.slice(0);
  return arr.sort(function(a,b){
    var a1=typeof a[property], b1=typeof b[property];
    return a1<b1 ? -1 : a1>b1 ? 1 : a[property]<b[property] ? -1 : a[property]>b[property] ? 1 : 0;
  });
}

function populateDb(database){
  var array = sampleItems.slice(0);
  return database.clear()
    .then(function() {
      return array.reduce(function (prev, cur, i) {
        return prev.then(function() {
          return database.insert(cur);
        });
      }, Promise.resolve());
    })
    .then(function(){
      return Promise.resolve();
    });
}

describe("the key value store with key", function(){
  this.timeout(timeout);

  before(function(done){
    sampleItems = generateSampleItems(n);
    singleItem = generateSampleItems(1)[0];
    populateDb(sync)
      .then(function(){
        done();
      });
  });

  it("should return size() == " + n + " after saving " + n + " items with insert()", function(){
    var promise = sync.size();
    return expect(
      promise
    ).to.eventually.equal(sampleItems.length);
  });

  it("should getMany() all items orderedBy the key attribute", function(){
    var arr = sortArray(sampleItems, keyAttribute);
    return expect(
      sync.getMany()
    ).to.eventually.deep.equal(arr);
  });

  it("should getMany({'reverse': true}) all items ordered by the key attribute reversed", function(){
    var arr = sortArray(sampleItems, keyAttribute);
    arr.reverse();
    return expect(
      sync.getMany({
        'reverse': true
      })
    ).to.eventually.deep.equal(arr);
  });

  it("should getMany({'orderby': indexAttribute}) all items ordered by an index attribute", function(){
    var arr = sortArray(sampleItems, indexAttribute);
    return expect(
      sync.getMany({
        'orderby': indexAttribute
      })
    ).to.eventually.deep.equal(arr);
  });

  it("should getMany({'orderby': indexAttribute, 'reverse': true}) all items ordered by an index attribute reversed", function(){
    var arr = sortArray(sampleItems, indexAttribute).reverse();
    return expect(
      sync.getMany({
        'orderby': indexAttribute,
        'reverse': true
      })
    ).to.eventually.deep.equal(arr);
  });

  it("should getMany({count: 5}) 5 items ordered by the key attribute", function(){
    var arr = sortArray(sampleItems, keyAttribute).slice(0,5);
    return expect(
      sync.getMany({
        'count': 5
      })
    ).to.eventually.deep.equal(arr);
  });

  it("should getMany({count: 5, offset: 10}) 5 items ordered by the key attribute starting after item 10", function(){
    var arr = sortArray(sampleItems, keyAttribute).slice(10,10+5);
    return expect(
      sync.getMany({
        'count': 5,
        'offset': 10
      })
    ).to.eventually.deep.equal(arr);
  });

  it("should getMany({count: 5, offset: 10, orderby: indexAttribute}) 5 items ordered by an index attribute starting after item 10", function(){
    var arr = sortArray(sampleItems, indexAttribute).slice(10,10+5);
    return expect(
      sync.getMany({
        'count': 5,
        'offset': 10,
        'orderby': indexAttribute
      })
    ).to.eventually.deep.equal(arr);
  });

  it("should getMany({count: 5, start: <key of item 10>, orderby keyAttribute}) 5 items ordered by the key attribute starting after item 10", function(){
    var arr = sortArray(sampleItems, keyAttribute).slice(10,10+5);
    return expect(
      sync.getMany({
        'count': 5,
        'start': arr[0][keyAttribute],
        'orderby': keyAttribute
      })
    ).to.eventually.deep.equal(arr);
  });

  it("should getMany({start: <key of item 10>, end: <key of item 14>, 'orderby': keyAttribute}) 5 items ordered by key starting after item 10", function(){
    var arr = sortArray(sampleItems, keyAttribute).slice(10,14);
    return expect(
      sync.getMany({
        'start': arr[0][keyAttribute],
        'end': arr[3][keyAttribute],
        'orderby': keyAttribute
      })
    ).to.eventually.deep.equal(arr);
  });

  it("should getMany({start: <indexAttribute of item 10>, end: <indexAttribute of item 14>, 'orderby': indexAttribute}) 5 items ordered by indexAttribute starting after item 10", function(){
    var arr = sortArray(sampleItems, indexAttribute).slice(10,14);
    return expect(
      sync.getMany({
        'start': arr[0][indexAttribute],
        'end': arr[3][indexAttribute],
        'orderby': indexAttribute
      })
    ).to.eventually.deep.equal(arr);
  });

  it("should get consecutive items in chunks of 5 by using getMany with offset and count multiple times", function(){
    var arr = sortArray(sampleItems, keyAttribute).slice(0,15);
    var res = [];
    return expect(
      sync.getMany({
        'offset': 0,
        'count': 5,
        'orderby': keyAttribute
      }).then(function(items){
        res.push.apply(res,items);
        return sync.getMany({
          'offset': 5,
          'count': 5,
          'orderby': keyAttribute
        });
      }).then(function(items){
        res.push.apply(res,items);
        return sync.getMany({
          'offset': 10,
          'count': 5,
          'orderby': keyAttribute
        });
      }).then(function(items){
        res.push.apply(res,items);
        return res;
      })
    ).to.eventually.deep.equal(arr);
  });

  it("should set(key) an item and get(key) it", function(){
    var newItem = generateSampleItems(1)[0];
    return expect(
      sync.set(newItem)
        .then(function(k){
          expect(k).to.equal(newItem[keyAttribute]);
          return sync.get(newItem[keyAttribute]);
        })
    ).to.eventually.deep.equal(newItem);
  });

  it("should set(key) an item, update it with set(key, obj) and get(key) it", function(){
    var newItem = generateSampleItems(1)[0];
    var updatedItem = JSON.parse(JSON.stringify(newItem));
    updatedItem[indexAttribute] = randomContent();
    return expect(
      sync.set(newItem)
        .then(function(k){
          expect(k).to.equal(newItem[keyAttribute]);
          return sync.get(newItem[keyAttribute]);
        })
        .then(function(item){
          expect(item).to.deep.equal(newItem);
          return sync.set(updatedItem);
        })
        .then(function(k){
          expect(k).to.equal(newItem[keyAttribute]);
          return sync.get(newItem[keyAttribute]);
        })
    ).to.eventually.deep.equal(updatedItem);
  });

  it("should set(key) an item, update it by reomiving a property with set(key, obj) and get(key) it", function(){
    var newItem = generateSampleItems(1)[0];
    var updatedItem = JSON.parse(JSON.stringify(newItem));
    delete(updatedItem[indexAttribute]);
    return expect(
      sync.set(newItem)
        .then(function(k){
          expect(k).to.equal(newItem[keyAttribute]);
          return sync.get(newItem[keyAttribute]);
        })
        .then(function(item){
          expect(item).to.deep.equal(newItem);
          return sync.set(updatedItem);
        })
        .then(function(k){
          expect(k).to.equal(newItem[keyAttribute]);
          return sync.get(newItem[keyAttribute]);
        })
    ).to.eventually.deep.equal(updatedItem);
  });

  it("should throw a ConstraintError when you try to insert() an item with an already existing key", function(){
    var newItem = generateSampleItems(1)[0];
    return expect(
      sync.insert(newItem)
        .then(function() {
          return sync.insert(newItem);
        })
    ).to.be.rejected;
  });

  it("should insert(obj) an item, remove(key) it and not get(key) it again", function(){
    var newItem = generateSampleItems(1)[0];
    var newItemKey;
    return expect(
      sync.insert(newItem)
        .then(function(id){
          newItemKey = id;
          return sync.get(newItemKey);
        })
        .then(function(item){
          expect(item).to.deep.equal(newItem);
          return sync.remove(newItemKey);
        })
        .then(function(id){
          return sync.get(newItemKey);
        })
    ).to.eventually.deep.equal(undefined);
  });

  it("should be empty again after clear()", function(){
    return expect(
      sync.clear()
        .then(function(){ return sync.size(); })
    ).to.eventually.equal(0);
  });
});
