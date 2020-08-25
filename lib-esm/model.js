import * as tslib_1 from "tslib";
import { ValidationErrorBuilder } from "./util/validation-error-builder";
import { refreshJWT } from "./util/refresh-jwt";
import relationshipIdentifiersFor from "./util/relationship-identifiers";
import { Request, ResponseError } from "./request";
import { WritePayload } from "./util/write-payload";
import { CredentialStorage, InMemoryStorageBackend } from "./credential-storage";
import { IDMap } from "./id-map";
import { deserialize, deserializeInstance } from "./util/deserialize";
import DirtyChecker from "./util/dirty-check";
import { Scope } from "./scope";
import { JsonapiTypeRegistry } from "./jsonapi-type-registry";
import { camelize, underscore, dasherize } from "inflected";
import { logger as defaultLogger } from "./logger";
import { MiddlewareStack } from "./middleware-stack";
import { EventBus } from "./event-bus";
import { cloneDeep } from "./util/clonedeep";
import { nonenumerable } from "./util/decorators";
export var applyModelConfig = function (ModelClass, config) {
    var k;
    config = tslib_1.__assign({}, config); // clone since we're going to mutate it
    // Handle all JWT configuration at once since it's run-order dependent
    // We'll delete each key we encounter then pass the rest off to
    // a loop for assigning other arbitrary options
    if (config.credentialStorageBackend) {
        ModelClass.credentialStorageBackend = config.credentialStorageBackend;
        delete config.jwtStorage;
    }
    if (config.jwtStorage) {
        ModelClass.jwtStorage = config.jwtStorage;
        delete config.jwtStorage;
    }
    if (config.jwt) {
        ModelClass.setJWT(config.jwt);
        delete config.jwt;
    }
    for (k in config) {
        if (config.hasOwnProperty(k)) {
            ModelClass[k] = config[k];
        }
    }
    if (ModelClass.isBaseClass === undefined) {
        ModelClass.setAsBase();
    }
    else if (ModelClass.isBaseClass === true) {
        ModelClass.isBaseClass = false;
    }
};
var SpraypaintBase = /** @class */ (function () {
    function SpraypaintBase(attrs) {
        this.stale = false;
        this.storeKey = "";
        this.relationships = {};
        this._persisted = false;
        this._markedForDestruction = false;
        this._markedForDisassociation = false;
        this._originalRelationships = {};
        this._errors = {};
        this._initializeAttributes();
        this._initializeLinks();
        this.assignAttributes(attrs);
        this._originalAttributes = cloneDeep(this._attributes);
        this._originalLinks = cloneDeep(this._links);
        this._originalRelationships = this.relationshipResourceIdentifiers(Object.keys(this.relationships));
    }
    Object.defineProperty(SpraypaintBase, "credentialStorage", {
        get: function () {
            return this._credentialStorage;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(SpraypaintBase, "jwtStorage", {
        get: function () {
            return this._jwtStorage;
        },
        set: function (val) {
            if (val !== this._jwtStorage) {
                this._jwtStorage = val;
                this.credentialStorageBackend = this._credentialStorageBackend;
            }
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(SpraypaintBase, "credentialStorageBackend", {
        get: function () {
            return this._credentialStorageBackend;
        },
        set: function (backend) {
            this._credentialStorageBackend = backend;
            this._credentialStorage = new CredentialStorage(this.jwtStorage || "jwt", this._credentialStorageBackend);
        },
        enumerable: true,
        configurable: true
    });
    SpraypaintBase.initializeCredentialStorage = function () {
        if (this.jwtStorage && typeof localStorage !== "undefined") {
            this.credentialStorageBackend = localStorage;
        }
        else {
            this.credentialStorageBackend = new InMemoryStorageBackend();
        }
    };
    SpraypaintBase.fromJsonapi = function (resource, payload) {
        return deserialize(this.typeRegistry, resource, payload);
    };
    SpraypaintBase.inherited = function (subclass) {
        subclass.parentClass = this;
        subclass.currentClass = subclass;
        subclass.prototype.klass = subclass;
        subclass.attributeList = cloneDeep(subclass.attributeList);
        subclass.linkList = cloneDeep(subclass.linkList);
    };
    SpraypaintBase.setAsBase = function () {
        this.isBaseClass = true;
        this.jsonapiType = undefined;
        if (!this.typeRegistry) {
            this.typeRegistry = new JsonapiTypeRegistry(this);
        }
        if (!this.middlewareStack) {
            this._middlewareStack = new MiddlewareStack();
        }
        if (!this._IDMap) {
            this._IDMap = new IDMap();
        }
    };
    SpraypaintBase.isSubclassOf = function (maybeSuper) {
        var current = this.currentClass;
        while (current) {
            if (current === maybeSuper) {
                return true;
            }
            current = current.parentClass;
        }
        return false;
    };
    Object.defineProperty(SpraypaintBase, "baseClass", {
        get: function () {
            var current = this.currentClass;
            while (current) {
                if (current.isBaseClass) {
                    return current;
                }
                current = current.parentClass;
            }
            return undefined;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(SpraypaintBase, "store", {
        get: function () {
            if (this.baseClass === undefined) {
                throw new Error("No base class for " + this.name);
            }
            return this.baseClass._IDMap;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(SpraypaintBase, "typeRegistry", {
        get: function () {
            if (this.baseClass === undefined) {
                throw new Error("No base class for " + this.name);
            }
            return this.baseClass._typeRegistry;
        },
        set: function (registry) {
            if (!this.isBaseClass) {
                throw new Error("Cannot set a registry on a non-base class");
            }
            this._typeRegistry = registry;
        },
        enumerable: true,
        configurable: true
    });
    SpraypaintBase.registerType = function () {
        if (!this.jsonapiType) {
            return;
        }
        var existingType = this.typeRegistry.get(this.jsonapiType);
        if (existingType) {
            // Don't try to register a type of we're looking
            // at a subclass. Otherwise we'll make a register
            // call which will fail in order to get a helpful
            // error message from the registry
            if (this.isSubclassOf(existingType)) {
                return;
            }
        }
        this.typeRegistry.register(this.jsonapiType, this);
    };
    SpraypaintBase.extend = function (options) {
        var Subclass = /** @class */ (function (_super) {
            tslib_1.__extends(Subclass, _super);
            function Subclass() {
                return _super !== null && _super.apply(this, arguments) || this;
            }
            return Subclass;
        }((this)));
        this.inherited(Subclass);
        var attrs = {};
        if (options.attrs) {
            for (var key in options.attrs) {
                if (options.attrs.hasOwnProperty(key)) {
                    var attr = options.attrs[key];
                    if (!attr.name) {
                        attr.name = key;
                    }
                    attr.owner = Subclass;
                    attrs[key] = attr;
                }
            }
        }
        Subclass.attributeList = Object.assign({}, Subclass.attributeList, attrs);
        Subclass.linkList = Subclass.linkList.slice();
        applyModelConfig(Subclass, options.static || {});
        Subclass.registerType();
        if (options.methods) {
            for (var methodName in options.methods) {
                if (options.methods.hasOwnProperty(methodName)) {
                    ;
                    Subclass.prototype[methodName] = options.methods[methodName];
                }
            }
        }
        return Subclass;
    };
    SpraypaintBase.prototype._initializeAttributes = function () {
        this._attributes = {};
        this._copyPrototypeDescriptors();
    };
    SpraypaintBase.prototype._initializeLinks = function () {
        this._links = {};
    };
    /*
     * VueJS, along with a few other frameworks rely on objects being "reactive". In practice, this
     * means that when passing an object into an context where you would need change detection, vue
     * will inspect it for any enumerable properties that exist and might be depended on in templates
     * and other functions that will trigger changes.  In the case of vue, it intentionally avoids
     * resolving properties on the prototype chain and instead determines which it should override
     * using `Object.hasOwnProperty()`.  To get proper observability, we need to move all attribute
     * methods plus a few other utility getters to the object itself.
     */
    SpraypaintBase.prototype._copyPrototypeDescriptors = function () {
        var _this = this;
        var attrs = this.klass.attributeList;
        for (var key in attrs) {
            if (attrs.hasOwnProperty(key)) {
                var attr = attrs[key];
                Object.defineProperty(this, key, attr.descriptor());
            }
        }
        ;
        [
            "errors",
            "isPersisted",
            "isMarkedForDestruction",
            "isMarkedForDisassociation"
        ].forEach(function (property) {
            var descriptor = Object.getOwnPropertyDescriptor(SpraypaintBase.prototype, property);
            if (descriptor) {
                Object.defineProperty(_this, property, descriptor);
            }
        });
    };
    SpraypaintBase.prototype.isType = function (jsonapiType) {
        return this.klass.jsonapiType === jsonapiType;
    };
    Object.defineProperty(SpraypaintBase.prototype, "isPersisted", {
        get: function () {
            return this._persisted;
        },
        set: function (val) {
            this._persisted = val;
            if (val)
                this.reset();
        },
        enumerable: true,
        configurable: true
    });
    SpraypaintBase.prototype.onSyncRelationships = function () {
        var _this = this;
        if (this._onSyncRelationships)
            return this._onSyncRelationships;
        this._onSyncRelationships = function (event, relationships) {
            _this.relationships = relationships;
        };
        return this._onSyncRelationships;
    };
    SpraypaintBase.prototype.onStoreChange = function () {
        var _this = this;
        if (this._onStoreChange)
            return this._onStoreChange;
        this._onStoreChange = function (event, attrs) {
            var diff = {};
            // Update all non-dirty attributes
            Object.keys(attrs).forEach(function (k) {
                var self = _this;
                var changes = _this.changes();
                var attrDef = _this.klass.attributeList[k];
                if (attrDef.dirtyChecker(self[k], attrs[k]) && !changes[k]) {
                    diff[k] = [self[k], attrs[k]];
                    self[k] = attrs[k];
                    // ensure this property is not marked as dirty
                    self._originalAttributes[k] = attrs[k];
                }
            });
            // fire afterSync hook if applicable
            var hasDiff = Object.keys(diff).length > 0;
            if (hasDiff && typeof _this.afterSync !== "undefined") {
                _this.afterSync(diff);
            }
        };
        return this._onStoreChange;
    };
    SpraypaintBase.prototype.unlisten = function () {
        var _this = this;
        if (!this.klass.sync)
            return;
        if (this.storeKey) {
            EventBus.removeEventListener(this.storeKey, this.onStoreChange());
            EventBus.removeEventListener(this.storeKey + "-sync-relationships", this.onSyncRelationships());
        }
        Object.keys(this.relationships).forEach(function (k) {
            var related = _this.relationships[k];
            if (related) {
                if (Array.isArray(related)) {
                    related.forEach(function (r) { return r.unlisten(); });
                }
                else {
                    related.unlisten();
                }
            }
        });
    };
    SpraypaintBase.prototype.listen = function () {
        if (!this.klass.sync)
            return;
        if (!this._onStoreChange) {
            // not already registered
            EventBus.addEventListener(this.storeKey, this.onStoreChange());
            EventBus.addEventListener(this.storeKey + "-sync-relationships", this.onSyncRelationships());
        }
    };
    SpraypaintBase.prototype.syncRelationships = function () {
        EventBus.dispatch(this.storeKey + "-sync-relationships", {}, this.relationships);
    };
    SpraypaintBase.prototype.reset = function () {
        if (this.klass.sync) {
            this.klass.store.updateOrCreate(this);
            this.listen();
        }
        this._originalAttributes = cloneDeep(this._attributes);
        this._originalRelationships = this.relationshipResourceIdentifiers(Object.keys(this.relationships));
    };
    SpraypaintBase.prototype.rollback = function () {
        this._attributes = cloneDeep(this._originalAttributes);
    };
    Object.defineProperty(SpraypaintBase.prototype, "isMarkedForDestruction", {
        get: function () {
            return this._markedForDestruction;
        },
        set: function (val) {
            this._markedForDestruction = val;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(SpraypaintBase.prototype, "isMarkedForDisassociation", {
        get: function () {
            return this._markedForDisassociation;
        },
        set: function (val) {
            this._markedForDisassociation = val;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(SpraypaintBase.prototype, "attributes", {
        get: function () {
            return this._attributes;
        },
        set: function (attrs) {
            this._attributes = {};
            this.assignAttributes(attrs);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(SpraypaintBase.prototype, "stored", {
        get: function () {
            return this.klass.store.find(this);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(SpraypaintBase.prototype, "typedAttributes", {
        /*
         * This is a (hopefully) temporary method for typescript users.
         *
         * Currently the attributes() setter takes an arbitrary hash which
         * may or may not include valid attributes. In non-strict mode, it
         * silently drops those that it doesn't know. This is all perfectly fine
         * from a functionality point, but it means we can't correctly type
         * the attributes() getter return object, as it must match the setter's
         * type. I propose we change the type definition to require sending
         * abitrary hashes through the assignAttributes() method instead.
         */
        get: function () {
            return this._attributes;
        },
        enumerable: true,
        configurable: true
    });
    SpraypaintBase.prototype.relationship = function (name) {
        return this.relationships[name];
    };
    SpraypaintBase.prototype.assignAttributes = function (attrs) {
        if (!attrs) {
            return;
        }
        for (var key in attrs) {
            if (attrs.hasOwnProperty(key)) {
                var attributeName = key;
                attributeName = this.klass.deserializeKey(key);
                if (key === "id" || this.klass.attributeList[attributeName]) {
                    ;
                    this[attributeName] = attrs[key];
                }
                else if (this.klass.strictAttributes) {
                    throw new Error("Unknown attribute: " + key);
                }
            }
        }
    };
    SpraypaintBase.prototype.setMeta = function (metaObj) {
        this.__meta__ = metaObj;
    };
    SpraypaintBase.prototype.relationshipResourceIdentifiers = function (relationNames) {
        return relationshipIdentifiersFor(this, relationNames);
    };
    SpraypaintBase.prototype.fromJsonapi = function (resource, payload, includeDirective) {
        if (includeDirective === void 0) { includeDirective = {}; }
        return deserializeInstance(this, resource, payload, includeDirective);
    };
    Object.defineProperty(SpraypaintBase.prototype, "resourceIdentifier", {
        get: function () {
            if (this.klass.jsonapiType === undefined) {
                throw new Error("Cannot build resource identifier for class. No JSONAPI Type specified.");
            }
            return {
                id: this.id,
                type: this.klass.jsonapiType
            };
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(SpraypaintBase.prototype, "errors", {
        get: function () {
            return this._errors;
        },
        set: function (errs) {
            this._errors = errs;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(SpraypaintBase.prototype, "hasError", {
        get: function () {
            return Object.keys(this._errors).length > 1;
        },
        enumerable: true,
        configurable: true
    });
    SpraypaintBase.prototype.clearErrors = function () {
        this.errors = {};
    };
    SpraypaintBase.prototype.isDirty = function (relationships) {
        var dc = new DirtyChecker(this);
        return dc.check(relationships);
    };
    SpraypaintBase.prototype.changes = function () {
        var dc = new DirtyChecker(this);
        return dc.dirtyAttributes();
    };
    SpraypaintBase.prototype.hasDirtyRelation = function (relationName, relatedModel) {
        var dc = new DirtyChecker(this);
        return !this.isPersisted || dc.checkRelation(relationName, relatedModel);
    };
    SpraypaintBase.prototype.dup = function () {
        var attrs = Object.assign({}, this.attributes, this.relationships);
        var cloned = new this.klass(attrs);
        cloned.id = this.id;
        cloned.isPersisted = this.isPersisted;
        cloned.isMarkedForDestruction = this.isMarkedForDestruction;
        cloned.isMarkedForDisassociation = this.isMarkedForDisassociation;
        cloned.errors = Object.assign({}, this.errors);
        cloned.links = Object.assign({}, this.links);
        return cloned;
    };
    /*
     *
     * Model Persistence Methods
     *
     */
    SpraypaintBase.fetchOptions = function () {
        var _a;
        var options = {
            credentials: "same-origin",
            headers: (_a = {
                    Accept: "application/vnd.api+json"
                },
                _a["Content-Type"] = "application/vnd.api+json",
                _a)
        };
        if (this.clientApplication) {
            options.headers["Client-Application"] = this.clientApplication;
        }
        var jwt = this.getJWT();
        if (jwt) {
            options.headers.Authorization = this.generateAuthHeader(jwt);
        }
        return options;
    };
    SpraypaintBase.url = function (id) {
        var endpoint = this.endpoint || "/" + this.jsonapiType;
        var base = "" + this.fullBasePath() + endpoint;
        if (id) {
            base = base + "/" + id;
        }
        return base;
    };
    SpraypaintBase.fullBasePath = function () {
        return "" + this.baseUrl + this.apiNamespace;
    };
    Object.defineProperty(SpraypaintBase, "middlewareStack", {
        get: function () {
            if (this.baseClass) {
                var stack = this.baseClass._middlewareStack;
                // Normally we want to use the middleware stack defined on the baseClass, but in the event
                // that our subclass has overridden one or the other, we create a middleware stack that
                // replaces the normal filters with the class override.
                if (this.beforeFetch || this.afterFetch) {
                    var before_1 = this.beforeFetch
                        ? [this.beforeFetch]
                        : stack.beforeFilters;
                    var after_1 = this.afterFetch ? [this.afterFetch] : stack.afterFilters;
                    return new MiddlewareStack(before_1, after_1);
                }
                else {
                    return stack;
                }
            }
            else {
                // Shouldn't ever get here, as this should only happen on SpraypaintBase
                return new MiddlewareStack();
            }
        },
        set: function (stack) {
            this._middlewareStack = stack;
        },
        enumerable: true,
        configurable: true
    });
    SpraypaintBase.scope = function () {
        return new Scope(this);
    };
    SpraypaintBase.first = function () {
        return this.scope().first();
    };
    SpraypaintBase.all = function () {
        return this.scope().all();
    };
    SpraypaintBase.find = function (id) {
        return this.scope().find(id);
    };
    SpraypaintBase.where = function (clause) {
        return this.scope().where(clause);
    };
    SpraypaintBase.page = function (pageNum) {
        return this.scope().page(pageNum);
    };
    SpraypaintBase.per = function (size) {
        return this.scope().per(size);
    };
    SpraypaintBase.extraParams = function (clause) {
        return this.scope().extraParams(clause);
    };
    SpraypaintBase.extraFetchOptions = function (options) {
        return this.scope().extraFetchOptions(options);
    };
    SpraypaintBase.order = function (clause) {
        return this.scope().order(clause);
    };
    SpraypaintBase.select = function (clause) {
        return this.scope().select(clause);
    };
    SpraypaintBase.selectExtra = function (clause) {
        return this.scope().selectExtra(clause);
    };
    SpraypaintBase.stats = function (clause) {
        return this.scope().stats(clause);
    };
    SpraypaintBase.includes = function (clause) {
        return this.scope().includes(clause);
    };
    SpraypaintBase.merge = function (obj) {
        return this.scope().merge(obj);
    };
    SpraypaintBase.setJWT = function (token) {
        this.credentialStorage.setJWT(token);
    };
    SpraypaintBase.getJWT = function () {
        return this.credentialStorage.getJWT();
    };
    Object.defineProperty(SpraypaintBase, "jwt", {
        get: function () {
            return this.getJWT();
        },
        set: function (token) {
            this.setJWT(token);
        },
        enumerable: true,
        configurable: true
    });
    SpraypaintBase.generateAuthHeader = function (jwt) {
        return "Token token=\"" + jwt + "\"";
    };
    SpraypaintBase.getJWTOwner = function () {
        this.logger.warn("SpraypaintBase#getJWTOwner() is deprecated. Use #baseClass property instead");
        return this.baseClass;
    };
    SpraypaintBase.serializeKey = function (key) {
        switch (this.keyCase.server) {
            case "dash": {
                return dasherize(underscore(key));
            }
            case "snake": {
                return underscore(key);
            }
            case "camel": {
                return camelize(underscore(key), false);
            }
        }
    };
    SpraypaintBase.deserializeKey = function (key) {
        switch (this.keyCase.client) {
            case "dash": {
                return dasherize(underscore(key));
            }
            case "snake": {
                return underscore(key);
            }
            case "camel": {
                return camelize(underscore(key), false);
            }
        }
    };
    SpraypaintBase.prototype.destroy = function () {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var url, verb, request, response, err_1, base;
            var _this = this;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        url = this.klass.url(this.id);
                        verb = "delete";
                        request = new Request(this._middleware(), this.klass.logger);
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, request.delete(url, this._fetchOptions())];
                    case 2:
                        response = _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        err_1 = _a.sent();
                        throw err_1;
                    case 4:
                        if (!(response.status === 202)) return [3 /*break*/, 6];
                        return [4 /*yield*/, this._handleAcceptedResponse(response, this.onDeferredDestroy)];
                    case 5: return [2 /*return*/, _a.sent()];
                    case 6:
                        base = this.klass.baseClass;
                        base.store.destroy(this);
                        return [4 /*yield*/, this._handleResponse(response, function () {
                                _this.isPersisted = false;
                            })];
                    case 7: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    SpraypaintBase.prototype.save = function (options) {
        if (options === void 0) { options = {}; }
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var url, verb, request, payload, response, scope, json, err_2;
            var _this = this;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        url = this.klass.url();
                        verb = "post";
                        request = new Request(this._middleware(), this.klass.logger, {
                            patchAsPost: this.klass.patchAsPost
                        });
                        payload = new WritePayload(this, options.with);
                        if (this.isPersisted) {
                            url = this.klass.url(this.id);
                            verb = "patch";
                        }
                        if (options.returnScope) {
                            scope = options.returnScope;
                            if (scope.model !== this.klass) {
                                throw new Error("returnScope must be a scope of type Scope<" + this.klass.name + ">");
                            }
                            url = url + "?" + scope.toQueryParams();
                        }
                        this.clearErrors();
                        json = payload.asJSON();
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, request[verb](url, json, this._fetchOptions())];
                    case 2:
                        response = _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        err_2 = _a.sent();
                        throw err_2;
                    case 4:
                        if (!(response.status === 202 || response.status === 204)) return [3 /*break*/, 6];
                        return [4 /*yield*/, this._handleAcceptedResponse(response, this.onDeferredUpdate)];
                    case 5: return [2 /*return*/, _a.sent()];
                    case 6: return [4 /*yield*/, this._handleResponse(response, function () {
                            _this.fromJsonapi(response.jsonPayload.data, response.jsonPayload, payload.includeDirective);
                            payload.postProcess();
                        })];
                    case 7: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    SpraypaintBase.prototype._handleAcceptedResponse = function (response, callback) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var responseObject;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (response.jsonPayload && callback) {
                            responseObject = this.klass.fromJsonapi(response.jsonPayload.data, response.jsonPayload);
                            callback(responseObject);
                        }
                        return [4 /*yield*/, this._handleResponse(response, function () { })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    SpraypaintBase.prototype._handleResponse = function (response, callback) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            return tslib_1.__generator(this, function (_a) {
                refreshJWT(this.klass, response);
                if (response.status === 422) {
                    try {
                        ValidationErrorBuilder.apply(this, response.jsonPayload);
                    }
                    catch (e) {
                        throw new ResponseError(response, "validation failed", e);
                    }
                    return [2 /*return*/, false];
                }
                else {
                    callback();
                    return [2 /*return*/, true];
                }
                return [2 /*return*/];
            });
        });
    };
    SpraypaintBase.prototype._fetchOptions = function () {
        return this.klass.fetchOptions();
    };
    SpraypaintBase.prototype._middleware = function () {
        return this.klass.middlewareStack;
    };
    // Todo:
    // * needs to recurse the directive
    // * remove the corresponding code from isPersisted and handle here (likely
    // only an issue with test setup)
    // * Make all calls go through resetRelationTracking();
    SpraypaintBase.prototype.resetRelationTracking = function (includeDirective) {
        this._originalRelationships = this.relationshipResourceIdentifiers(Object.keys(includeDirective));
    };
    Object.defineProperty(SpraypaintBase.prototype, "links", {
        get: function () {
            return this._links;
        },
        set: function (links) {
            this._links = {};
            this.assignLinks(links);
        },
        enumerable: true,
        configurable: true
    });
    SpraypaintBase.prototype.assignLinks = function (links) {
        if (!links)
            return;
        for (var key in links) {
            var attributeName = this.klass.deserializeKey(key);
            if (this.klass.linkList.indexOf(attributeName) > -1) {
                this._links[attributeName] = links[key];
            }
        }
    };
    SpraypaintBase.baseUrl = "http://please-set-a-base-url.com";
    SpraypaintBase.apiNamespace = "/";
    SpraypaintBase.keyCase = { server: "snake", client: "camel" };
    SpraypaintBase.strictAttributes = false;
    SpraypaintBase.logger = defaultLogger;
    SpraypaintBase.sync = false;
    SpraypaintBase.clientApplication = null;
    SpraypaintBase.patchAsPost = false;
    SpraypaintBase.attributeList = {};
    SpraypaintBase.linkList = [];
    SpraypaintBase.currentClass = SpraypaintBase;
    SpraypaintBase._jwtStorage = "jwt";
    /*
     *
     * This is to allow for sane type checking in collaboration with the
     * isModelClass function exported below.  It is very hard to find out
     * whether something is a class of a certain type or subtype
     * (as opposed to an instance of that class), so we set a magic prop on
     * this for use around the codebase. For example, if you have a function:
     *
     * ``` typescript
     * function(arg : typeof SpraypaintBase | { foo : string }) {
     *   if(arg.isSpraypaintModel) {
     *     let modelClass : typeof SpraypaintBase = arg
     *   }
     * }
     * ```
     *
     */
    SpraypaintBase.isSpraypaintModel = true;
    tslib_1.__decorate([
        nonenumerable
    ], SpraypaintBase.prototype, "afterSync", void 0);
    tslib_1.__decorate([
        nonenumerable
    ], SpraypaintBase.prototype, "relationships", void 0);
    tslib_1.__decorate([
        nonenumerable
    ], SpraypaintBase.prototype, "klass", void 0);
    tslib_1.__decorate([
        nonenumerable
    ], SpraypaintBase.prototype, "_persisted", void 0);
    tslib_1.__decorate([
        nonenumerable
    ], SpraypaintBase.prototype, "_markedForDestruction", void 0);
    tslib_1.__decorate([
        nonenumerable
    ], SpraypaintBase.prototype, "_markedForDisassociation", void 0);
    tslib_1.__decorate([
        nonenumerable
    ], SpraypaintBase.prototype, "_originalRelationships", void 0);
    tslib_1.__decorate([
        nonenumerable
    ], SpraypaintBase.prototype, "_attributes", void 0);
    tslib_1.__decorate([
        nonenumerable
    ], SpraypaintBase.prototype, "_originalAttributes", void 0);
    tslib_1.__decorate([
        nonenumerable
    ], SpraypaintBase.prototype, "_links", void 0);
    tslib_1.__decorate([
        nonenumerable
    ], SpraypaintBase.prototype, "_originalLinks", void 0);
    tslib_1.__decorate([
        nonenumerable
    ], SpraypaintBase.prototype, "__meta__", void 0);
    tslib_1.__decorate([
        nonenumerable
    ], SpraypaintBase.prototype, "_errors", void 0);
    return SpraypaintBase;
}());
export { SpraypaintBase };
;
SpraypaintBase.prototype.klass = SpraypaintBase;
SpraypaintBase.initializeCredentialStorage();
export var isModelClass = function (arg) {
    if (!arg) {
        return false;
    }
    return arg.currentClass && arg.currentClass.isSpraypaintModel;
};
export var isModelInstance = function (arg) {
    if (!arg) {
        return false;
    }
    return isModelClass(arg.constructor.currentClass);
};
//# sourceMappingURL=model.js.map