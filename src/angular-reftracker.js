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

                function isObject(object) {
                    return object && typeof object === "object" && !Array.isArray(object);
                }

                /**
                 * Adds new object reference to cache
                 * @param {object} object Object to add (will be added recursively)
                 * @param {string} method If the reference is already created, defines the method of reference update
                 *                        operation, that may be 'merge' (will merge new objects into old, default) or
                 *                        'replace' (will clean the previous references and use only new object
                 *                        properties).
                 * @returns {object} referenced object
                 */
                this.addReference = function(object, method) {
                    method = method || 'merge';

                    // TODOLF impl
                    console.log('add reference', object);
                };

                /**
                 * Removes the object reference from cache
                 * @param {object} object Object to remove (will be removed recursively)
                 */
                this.removeReference = function(object) {
                    // TODOLF impl
                    console.log('remove reference', object);
                }

            };
        }
    ];

});

/**
 * Managed references scope
 */
refTracker.factory('refScope', ['refCache',
    function(refCache) {

        /**
         * Managed references scope constructor
         * @param {object} $scope scope to join
         */
        return function RefScope($scope) {
            this.referenced = [];

            var $this = this;

            // remove all references when scope dies
            $scope.$on('$destroy', function() {
                angular.forEach($this.referenced, function(object) {
                    refCache.removeReference(object);
                });
            });

            /**
             * Function for adding objects to $scope
             * @param {string} prop After execution the object appears in $scope.prop
             * @param {object} object Object to add to $scope
             */
            this.add = function(prop, object) {
                // TODOLF what if the existing scope object is replaced? remove prop from refCache and referenced first (!)
                var reference = refCache.addReference(object);
                $this.referenced.push(reference);
                $scope[prop] = reference;
            }

        }

    }
]);
