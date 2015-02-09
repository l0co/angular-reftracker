/**
 * Angular Reftracker
 *
 * Copyright (c) 2014 l0co
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
 * @author l0co@wp.pl
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

    this.$get = ['$log',
        function($log) {
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

                function isString(object) {
                    return typeof object == "string";
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

                            $log.debug('new object', id, ref, 'with refcount', cacheEntry.refCount);

                            return ref;

                        } else {

                            // remove reference

                            if (cacheEntry) {
                                cacheEntry.refCount--;

                                $log.debug('remove object', id, cacheEntry.reference, 'with refcount',
                                    cacheEntry.refCount);

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
                    return scanR(object, 'add');
                };

                /**
                 * Removes the object reference from cache
                 * @param {object} object Object to remove (will be removed recursively)
                 */
                this.removeReference = function(object) {
                    if (!isObjectOrArray(object))
                        return;
                    scanR(object, 'remove');
                };

                /**
                 * Returns the managed object reference
                 * @param identity {object|string} Object reference or its id.
                 * @return {object} Managed object reference or null if such reference is not found.
                 */
                this.findReference = function(identity) {
                    var id = null;
                    if (isString(identity))
                        id = identity;

                    if (!id) {
                        if (!isObject(identity))
                            return null;

                        id = idResolver(identity);
                        if (!id)
                            return null;
                    }

                    var cacheEntry = cache[id];
                    if (cacheEntry)
                        return cacheEntry.reference;

                    return null;
                };

                /**
                 * Executed on asynchronous object event
                 * @param identity {object|string} Object changed asynchronously or its id
                 * @param event {object} The event object (if null, identity will be used as the event object)
                 * @param callback {function} function(object, event) triggered on manages reference of object. Null
                 *                            assumes default behavior which is copy the event properties to the managed
                 *                            object reference.
                 */
                this.async = function(identity, event, callback) {
                    callback = callback || function(object, event) {
                        angular.extend(object, event);
                    };

                    event = event || identity;

                    var ref = this.findReference(identity);
                    if (ref)
                        callback(ref, event);
                };

                /**
                 * Updates the object reference with new instance
                 * @param object {object} Object to update
                 */
                this.updateReference = function(object) {
                    this.async(object);
                }

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

            function removeFromReferenced(object) {
                // find out if the object is already referenced
                var idx = referenced.indexOf(object);
                if (idx>-1) {
                    refCache.removeReference(object); // remove from referenced objects
                    referenced.splice(idx, 1);
                }
            }

            /**
             * Creates new object reference and adds it to the $scope as $scope.propName
             * @param propName {string} Scope property name
             * @param object {object|object[]} Object to add
             */
            this.set = function(propName, object) {
                // remove already existing references of previous value
                if ($scope[propName])
                    removeFromReferenced($scope[propName]);


                object = refCache.addReference(object);
                referenced.push(object); // add to referenced objects

                $scope[propName] = object;
            };

            /**
             * This function needs to be called if you join new object not to the scope directly (for that is set()),
             * but to the object already set in managed scope and tracked by reftracker. If such new reference
             * is created in existing object, this function adds new reference to the object withing the scope.
             * @param object {object|object[]} Newly created object joined to already managed reference
             */
            this.add = function(object) {
                return refCache.addReference(object);
            };

            /**
             * This function needs to be called if you remove new object from the managed scope either it's
             * direct scope object, or is removed from already managed object structure.
             * @param object {object|object[]} Object removed from scope or already managed reference
             */
            this.remove = function(object) {
                removeFromReferenced(object);
                return refCache.removeReference(object);
            };

            /**
             * refCache cleanup function on scope destroy
             */
            $scope.$on('$destroy', function() {
                angular.forEach(referenced, function(object) {
                    refCache.removeReference(object);
                });
                referenced = [];
            });
        }

    }
]);
