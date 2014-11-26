/**
 * Angular Reftracker Tester module
 *
 * @author lukasz.frankowski@gmail.com
 */

var rtTester = angular.module('rtTester', ['refTracker', 'ngResource']);

rtTester.controller('listController',
['$scope', '$resource',
function($scope, $resource) {

    $scope.items = [];

    $resource('json/objects.json').query({}, function(data) {
        $scope.list = data;
    });

    $scope.add = function(item) {
        $scope.items.push(item);
    }

}]);

rtTester.controller('editController',
['$scope', '$resource',
function($scope, $resource) {
    // item goes from parent scope here, we use it to create separate reference in this controller
    $scope.element = $scope.item;
}]);
