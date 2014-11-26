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

    }

}]);
