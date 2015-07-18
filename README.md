angular-reftracker
==================

Please note that this documentation concerns 1.0 version and is currently outdated for 2.0,
which is a complete reimplementation of concepts and uses scope id watching instead of counting object references.
There are some very complex usages with async update that appeared in my current project,
that cannot be supported by calculating object references, and 2.0 implementation gets rid of all of them.

## The motivation

I found it useful to design angular applications with domain driven backend in the way that I reuse the same JSON object references across all views/subpages/scopes. This gives a lot of simplicity in the code and allows the app to be really responsive. Here is the simple example:

![](https://sites.google.com/site/lifeinide/angular-reftracker/art-01.png?attredirects=0&d=1)

We have here some exemplary blog entries with comments structure. The objects from main tree can be used anywhere in the application in different scopes - eg. on some panels, footers and on hyphothetical different application views. Until we are starting from the main tree everything is fine and we can reuse the same object instance (same instances are marked by blue color on the screen). This gives me few interesting opportunities:
* If the object is changed somewhere, eg. user edits it, the change is propagated immediately to all views where the object exists.
* If async event comes with the information that the object has been changed by some other users, I don't have to listen for the change on each scope the object is present, but it's enough to change object properties in a single place (I can hold all my listeners in single place and communicate only with objects cache).

This second possibility is show on the following example:

![](https://sites.google.com/site/lifeinide/angular-reftracker/art-02.png?attredirects=0&d=1)

But because each scope/view works separately everything is always broken after refreshing some of the views with new JSON-s from the server. For example if we hold the paginated list, we can navigate page up and back to the previous page to have completely new objects list. On the tester this can be simulated by "Hard reload" button:

![](https://sites.google.com/site/lifeinide/angular-reftracker/art-03.png?attredirects=0&d=1)

Now the object from the list is disconnected from the others, because it represents other object reference. The same is for particular object details which can be "hard reloaded" as well:

![](https://sites.google.com/site/lifeinide/angular-reftracker/art-04.png?attredirects=0&d=1)
Now all three object references, representing the same entity are disconnected from each other. When the async even comes, all scopes need to listen for this event separately and a lot of additional effort needs to be done to keep it "connected". Otherwise only one object instance will be updated:

![](https://sites.google.com/site/lifeinide/angular-reftracker/art-05.png?attredirects=0&d=1)

## What's Angular Reftracker

Angular Reftracker is a simple angular module allowing to overcome the problem described above. It's a simple concept implementation of JSON objects reference tracker based on unique identified domain (or other) object coming from the server side.

Angular Reftracker is based on objects cache concept, but with thorough cleaning unused references at scope destroy event, that prevents from memory leaks.

## Configuration howto

Of course first we need to add the script to the page:

````html
<script type="text/javascript" src="../src/angular-reftracker.js"></script>
````

Now add the additional dependency for your module to ````refTracker```` module:

````js
var myModule = angular.module('myModule', ['refTracker']);
````

Now there's a good moment to register unique object ID resolver. You need to figure out the function to unique identify all your domain (or other) objects from the server. It's usually pretty easy, for example if you use UUID-s, the function needs only to return object ````id```` (this is the default implementation that doesn't need to be configured). Other common case is to have `long` identifiers, that makes the unique UI together with the object type (class, table ...). Here is the example of the second instance:

````js
myModule.config(['refCacheProvider', function(refCacheProvider) {
    refCacheProvider.setIDResolver(function(object) {
        if (object.type && object.id)
            return object.type + "/" + object.id;
        return null;
    });
}]);
````

The important part here is that if the unique ID can't be resolved, you need to return ````null````.

## Usage howto

The rest is simple. Let's first look on standard resource loading way:

````js
myModule.controller('myController',
['$scope',
function($scope) {

  // load list
  $resource('json/objects.json').query({}, function(data) {
    $scope.list = data;
  });

}
````

With the `refTracker` module this should be replaced with:

````js
myModule.controller('myController',
['$scope', 'ManagedScope',
function($scope, ManagedScope) {

  // create new managed scope for this scope
  $scope.$managed = new ManagedScope($scope);

  // load list
  $resource('json/objects.json').query({}, function(data) {
    $scope.$managed.set('list', data);
  });

}
````

Everything set in managed scope using `set()` function is now managed by objects references cache, and it appears normally under the `$scope` property (for both above examples the `$scope.list` property is available after resource load).

So, using `$scope.$managed.set()` in whatever controller, and updating the objects in whatever request, managed scope takes care for the object reference management. Even after reloading object from the server side, the new JSON object joined to the existing managed scope will be represented by the same reference, existing already in other scopes. If the object has new data, other scopes sharing the same object reference will be updated as well.

### Async

Now the asynchronous update of object data becomes easy and can be handled in a single place (eg. in a single listener service). If the object reference exists anywhere, it can be found in the references cache and updated:

````js
refCache.async('MY_OBJECT_ID', 'Hello from async event',
    function(object, event) {
        object.title = event;
    }
);
````

Or if the server returns full new object instances in async events, the object update can be done automatically:

````js
function onAsync(object) {
    refCache.async(object, object);
}
````
