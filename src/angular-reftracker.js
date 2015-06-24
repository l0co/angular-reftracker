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

    // default object extend function
    var extendFunc = angular.extend;

    /**
     * Update id resolver
     * @param {function} func function(object) returning unique string id of the object, or null if the object
     *                        has no id (so it won't be considered for reference management).
     */
    this.setIDResolver = function(func) {
        idResolver = func;
    };

    /**
     * Update extend function, ie. function extending object from cache by external reference on async event.
     * @param {function} func function with signature the same as angular.extend
     */
    this.setExtendFunc = function(func) {
        extendFunc = func;
    };

    this.$get = ['$log',
        function($log) {
            return new function RefCache() {
                var cache = {};
                this.cache = cache;

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

                this.resolveId = function(object) {
                    return idResolver(object);
                };

                this.extend = function(dst, src) {
                    extendFunc(dst, src);
                };

                /**
                 * Scans object/array recursively to look for references
                 * @param object Base object
                 * @param operation 'add', 'remove', 'remove-soft'
                 * @param visited {object[]} Visited objects
                 * @param visitedIds {object} Visited ids
                 * @return {*}
                 */
                function scanR(object, operation, visited, visitedIds) {
                    visited = visited || [];
                    visitedIds = visitedIds || {};

                    // array part
                    if (isArray(object)) {
                        var array = [];
                        angular.forEach(object, function(o) {
                            array.push(scanR(o, operation, visited, visitedIds));
                        });
                        return array;
                    }

                    // unknown part
                    if (!isObject(object))
                        return object;

                    // object part
                    var id = idResolver(object);
                    // if no id is resolved so far, we need proceed with recursive scan, but we won't track this
                    // object as a reference

                    // This is a little tricky, when json comes from the server and we have 'add' operation, we allow
                    // to add more same identity objects if they are present in json (eg. entity may go twice), but we
                    // shouldn't increase the refcounter for the reference added second time. This is because all these
                    // references will be then merged into a single one, and on 'remove' operation removed once.
                    var increaseCounter = true;
                    if (id) {
                        if (visitedIds[id] && operation == 'add')
                            increaseCounter = false;
                        visitedIds[id] = true;
                    }

                    if (visited.indexOf(object)==-1) {
                        visited.push(object);
                        var cacheEntry = id ? cache[id] : null;

                        if (operation == 'add') {

                            // add new reference

                            if (!cacheEntry && id) {
                                // object not in cache
                                cacheEntry = new CacheEntry(id);
                                cacheEntry.reference = object;
                                cache[id] = cacheEntry;
                            }

                            var ref = object;
                            if (cacheEntry) {
                                if (increaseCounter)
                                    cacheEntry.refCount++;
                                ref = cacheEntry.reference;
                                extendFunc(ref, object);
                            }

                            for (var prop in ref)
                                if (prop.substr(0,1)!='$') // skip special properties
                                    ref[prop] = scanR(ref[prop], operation, visited, visitedIds);

                            if (cacheEntry) {
                                if (increaseCounter)
                                    $log.debug('provider:refTracker', 'new object', id, ref, 'with refcount', cacheEntry.refCount);
                                else
                                    $log.debug('provider:refTracker', 'update object', id, ref, 'with refcount', cacheEntry.refCount);
                            }

                            return ref;

                        } else if (operation == 'remove' || operation == 'remove-soft') {

                            // remove reference

                            if (cacheEntry) {
                                cacheEntry.refCount--;

                                $log.debug('provider:refTracker', operation=='remove' ? 'remove object' : 'remove softly',
                                    id, cacheEntry.reference, 'with refcount', cacheEntry.refCount);

                                // do not remove overall entry yet on remove-soft operation (pre-update operation)
                                if (cacheEntry.refCount<=0 && operation!='remove-soft') {
                                    delete cache[id];
                                }

                                for (var prop in cacheEntry.reference)
                                    if (prop.substr(0,1)!='$') // skip special properties
                                        scanR(cacheEntry.reference[prop], operation, visited, visitedIds);
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
                 * @param callback {function} function(object, event) triggered on managed reference of object. Null
                 *                            assumes default behavior which is copy the event properties to the managed
                 *                            object reference using extendFunc.
                 */
                this.async = function(identity, event, callback) {
                    callback = callback || function(object, event) {
                        extendFunc(object, event);
                    };

                    event = event || identity;

                    var ref = this.findReference(identity);
                    if (ref) {
                        // we now have the entry to update in refCache, firstly we will softly remove its references
                        scanR(ref, 'remove-soft');

                        // now we may extend the referenced object with new data
                        callback(ref, event);

                        // and re-join object to the refCache
                        this.addReference(ref);

                        // now we can cleanup unused references from refCache (if they are still present)
                        angular.forEach(cache, function(cacheEntry, id) {
                            if (cacheEntry.refCount==0) {
                                $log.debug('provider:refTracker', 'cleanup unused reference',
                                    id, cacheEntry.reference, 'with refcount', cacheEntry.refCount);
                                delete cache[id];
                            }
                        });
                    }
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
                referenced.push(object);

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
