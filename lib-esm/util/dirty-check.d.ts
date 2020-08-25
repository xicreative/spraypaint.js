import { SpraypaintBase } from "../model";
import { IncludeScope } from "../scope";
declare class DirtyChecker<T extends SpraypaintBase> {
    model: T;
    constructor(model: T);
    checkRelation(relationName: string, relatedModel: SpraypaintBase): boolean;
    check(relationships?: IncludeScope): boolean;
    dirtyAttributes(): import("../model").ModelAttrChanges<import("./omit").Omit<T, "rollback" | "reset" | "attributes" | "destroy" | "id" | "temp_id" | "stale" | "storeKey" | "onDeferredDestroy" | "onDeferredUpdate" | "afterSync" | "relationships" | "klass" | "isType" | "isPersisted" | "_onSyncRelationships" | "_onStoreChange" | "unlisten" | "listen" | "syncRelationships" | "isMarkedForDestruction" | "isMarkedForDisassociation" | "stored" | "typedAttributes" | "relationship" | "assignAttributes" | "setMeta" | "relationshipResourceIdentifiers" | "fromJsonapi" | "resourceIdentifier" | "errors" | "hasError" | "clearErrors" | "isDirty" | "changes" | "hasDirtyRelation" | "dup" | "save" | "resetRelationTracking" | "links" | "assignLinks">>;
    private _isUnpersisted;
    private _hasDirtyAttributes;
    private _hasDirtyRelationships;
    private _eachRelatedObject;
}
export default DirtyChecker;
