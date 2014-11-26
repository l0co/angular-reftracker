/**
 * Angular Reftracker Tester module
 *
 * @author lukasz.frankowski@gmail.com
 */

var rtTester = angular.module('rtTester', ['refTracker', 'ngResource']);

rtTester.controller('listController',
['$scope', '$resource',
function($scope, $resource) {

    $scope.add = function(item) {
        $scope.items.push(item);
    };

    $scope.hardReload = function() {
        $resource('json/objects.json').query({}, function(data) {
            $scope.list = data;
        });
    };

    $scope.reset = function(item) {
        $scope.items = [];
        $scope.hardReload();
    };

    $scope.reset();

}]);

rtTester.controller('editController',
['$scope', '$resource',
function($scope, $resource) {

    // item goes from parent scope here, we use it to create separate reference in this controller
    $scope.element = $scope.item;

    $scope.hardReload = function() {
        $resource($scope.element.link).get({}, function(data) {
            $scope.element = data;
        });
    };

}]);
