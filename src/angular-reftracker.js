/**
 * Angular Reftracker 2.0
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

    // whether should log into console trace logs from recursive objects scan
    var trace = false;

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

    /**
     * Enables/disables trace logs
     */
    this.enableTrace = function(enable) {
        trace = enable;
    };

    this.$get = ['$log',
        function($log) {
            return new function RefCache() {
                var cache = {};
                this.cache = cache;

                function CacheEntry(id) {
                    this.id = id;
                    this.scopes = {};
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
                 * Adds object recursively to the reference cache
                 * @param object {object,object[]} Object or array to add
                 * @param scopeId {number|object} Related scope id or null
                 * @param visitedIds {object} For internal recursive usage
                 */
                function addR(object, scopeId, visitedIds) {
                    visitedIds = visitedIds || {};

                    // this function will fill scopes for cache entry depending on scopeId
                    function fillScopes(cacheEntry) {
                        if (typeof(scopeId) != 'object')
                            cacheEntry.scopes[scopeId] = true;
                        else
                            angular.forEach(scopeId, function(value, key) {
                                cacheEntry.scopes[key] = true;
                            });
                    }

                    // array part
                    if (isArray(object)) {
                        var array = [];
                        angular.forEach(object, function(o) {
                            array.push(addR(o, scopeId, visitedIds));
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

                    var cacheEntry = id ? cache[id] : null;

                    if (cacheEntry && id && visitedIds[id]) {
                        if (visitedIds[id].indexOf(object)>-1)
                            return cacheEntry.reference;
                        visitedIds[id].push(object);
                    } else
                        visitedIds[id] = [object];

                    // add new reference
                    if (!cacheEntry && id) {
                        // object not in cache
                        cacheEntry = new CacheEntry(id);
                        cacheEntry.reference = object;
                        cache[id] = cacheEntry;
                    } else if (cacheEntry && !scopeId) {
                        // object in cache but no scope provided (async) - load scopes from the object
                        // that is already in cache (but only top level object)
                        scopeId = angular.extend({}, cacheEntry.scopes);
                    }

                    var ref = object;

                    if (cacheEntry) {
                        fillScopes(cacheEntry);
                        ref = cacheEntry.reference;
                        extendFunc(ref, object);
                    }

                    for (var prop in ref)
                        if (prop.substr(0, 1) != '$') // skip special properties
                            ref[prop] = addR(ref[prop], scopeId, visitedIds);

                    if (trace && cacheEntry)
                        $log.debug('provider:refTracker', 'scope', scopeId, 'update object', id, ref, 'with refcount',
                            Object.keys(cacheEntry.scopes).length);

                    return ref;
                }

                /**
                 * Removes objects references related to the scope
                 * @param scopeId {string} Related scope id
                 */
                this.cleanup = function(scopeId) {
                    $log.debug('provider:refTracker', 'beginning scope', scopeId, 'cleanup with cache size',
                        Object.keys(cache).length);

                    angular.forEach(cache, function(cacheEntry, id) {

                        if (cacheEntry.scopes[scopeId]) { // this object belongs to scope being removed

                            if (trace)
                                $log.debug('provider:refTracker', 'scope', scopeId, 'remove object reference', id,
                                    cacheEntry.reference, 'with refcount', Object.keys(cacheEntry.scopes).length,
                                    Object.keys(cacheEntry.scopes).length==1 ? '(cleanup)' : '(preserve)');

                            delete cacheEntry.scopes[scopeId];

                            if (!Object.keys(cacheEntry.scopes).length)
                                delete cache[id];
                        }

                    });

                    $log.debug('provider:refTracker', 'finishing scope', scopeId, 'cleanup with cache size',
                        Object.keys(cache).length);
                };

                /**
                 * Adds new object reference to cache
                 * @param object {object} Object to add (will be added recursively)
                 * @param scopeId {string} Related scope id
                 * @returns {object} referenced object
                 */
                this.addReference = function(object, scopeId) {
                    var objectInfo = isArray(object) ? 'array with '+object.length+' elements' : object;

                    if (scopeId)
                        $log.debug('provider:refTracker', 'beginning add reference', objectInfo, 'to scope', scopeId,
                            'with cache size', Object.keys(cache).length);
                    else
                        $log.debug('provider:refTracker', 'beginning add reference', objectInfo, 'to existing scopes',
                            'with cache size', Object.keys(cache).length);

                    if (!isObjectOrArray(object))
                        return object;
                    var ret = addR(object, scopeId);

                    if (scopeId)
                        $log.debug('provider:refTracker', 'finishing add reference', objectInfo, 'to scope', scopeId,
                            'with cache size', Object.keys(cache).length);
                    else
                        $log.debug('provider:refTracker', 'finishing add reference', objectInfo, 'to existing scopes',
                            'with cache size', Object.keys(cache).length);

                    return ret;
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
                 * @return {boolean} True if the reference entity has been found in refCache, false otherwise
                 */
                this.async = function(identity, event, callback) {
                    callback = callback || function(object, event) {
                        extendFunc(object, event);
                    };

                    event = event || identity;

                    var ref = this.findReference(identity);
                    if (ref) {
                        // now we may extend the referenced object with new data
                        callback(ref, event);

                        // and add extended object to the cache again
                        this.addReference(ref);

                        return true;
                    }

                    return false;
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

            /**
             * Creates new object reference and adds it to the $scope as $scope.propName
             * @param propName {string} Scope property name
             * @param object {object|object[]} Object to add
             * @return {object} Managed object
             */
            this.set = function(propName, object) {
                object = refCache.addReference(object, $scope.$id);
                $scope[propName] = object;
                return object;
            };

            /**
             * This function needs to be called if you join new object not to the scope directly (for that is set()),
             * but to the object already set in managed scope and tracked by reftracker. If such new reference
             * is created in existing object, this function adds new reference to the object withing the scope.
             * @param object {object|object[]} Newly created object joined to already managed reference
             */
            this.add = function(object) {
                return refCache.addReference(object, $scope.$id);
            };

            /**
             * refCache cleanup function on scope destroy
             */
            $scope.$on('$destroy', function() {
                refCache.cleanup($scope.$id);
            });
        }

    }
]);
