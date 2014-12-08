/**
 * Angular Reftracker
 *
 * Copyright (c) 2014 Lukasz Frankowski
 *
 * The MIT License (MIT)
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 * @author lukasz.frankowski@gmail.com
 * @license MIT
 */

'use strict';

var refTracker = angular.module('refTracker', []);

/**
 * References cache
 */
refTracker.provider('refCache', function() {

    // default id resolver working with UUID id-s in "id" object field
    var idResolver = function(object) {
        if (object.id)
            return object.id;
        return null;
    };

    /**
     * Update id resolver
     * @param {function} func function(object) returning unique string id of the object, or null if the object
     *                        has no id (so it won't be considered for reference management).
     */
    this.setIDResolver = function(func) {
        idResolver = func;
    };

    this.$get = [
        function() {
            return new function RefCache() {
                var cache = {};

                function CacheEntry(id) {
                    this.id = id;
                    this.refCount = 0;
                    this.reference = null;
                }

                function isObjectOrArray(object) {
                    return object && typeof object === "object";
                }

                function isArray(object) {
                    return Array.isArray(object);
                }

                function isObject(object) {
                    return isObjectOrArray(object) && !isArray(object);
                }

                /**
                 * Scans object/array recursively to look for references
                 * @param object Base object
                 * @param operation 'add' or 'remove'
                 * @param visited Visited elements
                 * @return {*}
                 */
                function scanR(object, operation, visited) {
                    visited = visited || {};

                    // array part
                    if (isArray(object)) {
                        var array = [];
                        angular.forEach(object, function(o) {
                            array.push(scanR(o, operation, visited));
                        });
                        return array;
                    }

                    // unknown part
                    if (!isObject(object))
                        return object;

                    // object part
                    var id = idResolver(object);
                    if (!id)
                        return object;

                    // TODOLF remove
                    console.log('meet', id, object);

                    if (!visited[id]) {
                        visited[id] = true;
                        var cacheEntry = cache[id];

                        if (operation == 'add') {

                            // add new reference

                            if (!cacheEntry) {
                                // object not in cache
                                cacheEntry = new CacheEntry(id);
                                cacheEntry.reference = object;
                                cache[id] = cacheEntry;
                            }

                            cacheEntry.refCount++;

                            var ref = cacheEntry.reference;
                            angular.extend(ref, object);
                            for (var prop in ref)
                                ref[prop] = scanR(ref[prop], operation, visited);

                            // TODOLF remove
                            console.log('new refcount', id, ref, cacheEntry.refCount);

                            return ref;

                        } else {

                            // remove reference
                            if (cacheEntry) {
                                cacheEntry.refCount--;

                                // TODOLF remove
                                console.log('remove refcount', id, cacheEntry.reference, cacheEntry.refCount);

                                if (cacheEntry.refCount<=0) {
                                    delete cache[id];
                                }

                                for (var prop in cacheEntry.reference)
                                    scanR(cacheEntry.reference[prop], operation, visited);
                            }

                        }
                    }

                    return object;
                }

                /**
                 * Adds new object reference to cache
                 * @param {object} object Object to add (will be added recursively)
                 * @returns {object} referenced object
                 */
                this.addReference = function(object) {
                    if (!isObjectOrArray(object))
                        return object;

                    // TODOLF impl
                    console.log('add reference', object);
                    return scanR(object, 'add');
                };

                /**
                 * Removes the object reference from cache
                 * @param {object} object Object to remove (will be removed recursively)
                 */
                this.removeReference = function(object) {
                    if (!isObjectOrArray(object))
                        return object;

                    // TODOLF impl
                    console.log('remove reference', object);
                    scanR(object, 'remove');
                };

            };
        }
    ];

});

/**
 * Managed references scope
 */
refTracker.factory('ManagedScope', ['refCache',
    function(refCache) {

        /**
         * Managed references scope constructor
         * @param {object} $scope scope to join
         */
        return function ManagedScope($scope) {
            var referenced = [];

            /**
             * Creates new object reference and adds it to the $scope as $scope.propName
             * @param propName {string} Scope property name
             * @param object {object|object[]} Object to add
             */
            this.set = function(propName, object) {
                // remove already existing references of previous value
                if ($scope[propName]) {
                    // find out if the object is already referenced
                    var idx = referenced.indexOf($scope[propName]);
                    if (idx>-1) {
                        refCache.removeReference($scope[propName]); // remove from referenced objects
                        referenced.splice(idx, 1);
                    }
                }

                object = refCache.addReference(object);
                referenced.push(object); // add to referenced objects

                $scope[propName] = object;
            };

            $scope.$on('$destroy', function() {
                angular.forEach(referenced, function(object) {
                    refCache.removeReference(object);
                });
                referenced = [];
            });
        }

    }
]);
