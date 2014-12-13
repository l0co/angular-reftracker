/**
 * Angular Reftracker Tester module
 *
 * @author l0co@wp.pl
 */

'use strict';

var rtTester = angular.module('rtTester', ['refTracker', 'ngResource', 'ui.bootstrap']);

// register our objects id resolver
rtTester.config(['refCacheProvider', function(refCacheProvider) {
    refCacheProvider.setIDResolver(function(object) {
        if (object.type && object.id)
            return object.type + "/" + object.id;
        return null;
    });
}]);

rtTester.controller('listController',
['$scope', '$resource', 'ManagedScope', 'refCache',
function($scope, $resource, ManagedScope, refCache) {

    $scope.$managed = new ManagedScope($scope);

    $scope.hardReload = function() {
        $resource('json/objects.json').query({}, function(data) {
            $scope.list = data;
        });
    };

    $scope.reload = function() {
        $resource('json/objects.json').query({}, function(data) {
            $scope.$managed.set('list', data);
        });
    };

    $scope.reset = function(item) {
        $scope.items = [];
        $scope.reload();
    };

    $scope.add = function(item) {
        $scope.items.push(item);
    };

    $scope.removeOne = function() {
        $scope.items.splice($scope.items.length-1, 1);
    };

    $scope.reset();

    // async simulation support

    $scope.asyncId = 'BlogEntry/1';

    $scope.simulateAsync = function() {
        refCache.async($scope.asyncId, 'Hello from async event',
            function(object, event) {
                object.title = event;
            }
        );
    }

}]);

rtTester.controller('editController',
['$scope', '$resource', 'ManagedScope',
function($scope, $resource, ManagedScope) {

    $scope.$managed = new ManagedScope($scope);

    // item goes from parent scope here, we use it to create separate reference in this controller
    $scope.$managed.set('element', $scope.item);
    var url = $scope.element.link;

    $scope.hardReload = function() {
        $resource(url).get({}, function(data) {
            $scope.element.highlight = false;
            $scope.element = data;
        });
    };

    $scope.reload = function() {
        $resource(url).get({}, function(data) {
            $scope.element.highlight = false;
            $scope.$managed.set('element', data);
        });
    };

}]);
